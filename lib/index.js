/**
 * dsh-volcengine-usage — Node half
 *
 * Discovers the Volcano Engine gateway provider from DSH's own services and
 * proxies usage-API calls for the browser half.
 *
 * Discovery order (most reliable first):
 *   1. DSH `settings` service  — ctx.settings.describe() / get(ns)
 *   2. settings file scan      — settings.yaml, settings.yaml.imported, …
 *   3. DSH `credentials` svc   — resolved key (falls back to .credentials.yaml)
 *
 * Nothing is resolved at load time: config is read lazily per request, so the
 * plugin keeps working after provider settings change and never blocks boot.
 *
 * Routes:
 *   GET /volcengine-usage/config        → { available, gatewayRoot, … }
 *   GET /volcengine-usage/proxy?path=…  → gateway passthrough (API key stays server-side)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { load as parseYaml } from 'js-yaml'

export const ROUTE_PREFIX = '/volcengine-usage'
export const CONFIG_PATH = `${ROUTE_PREFIX}/config`
export const PROXY_PATH = `${ROUTE_PREFIX}/proxy`

const PROXY_TIMEOUT_MS = 15000
const CONFIG_TTL_MS = 30000        // provider config cache
const KEY_TTL_MS = 60000           // resolved credential cache

/** Files that may carry the settings document, newest DSH layout first. */
const SETTINGS_FILENAMES = [
  'settings.yaml',
  'settings.yaml.imported',
  'settings.yml',
  'settings.yaml.bak',
  'settings.json',
]

// ---------------------------------------------------------------- DSH home

/**
 * Locate the DSH home directory: the first candidate holding a settings
 * document (any known filename) or a profiles directory. Handles profile
 * node_modules installs, global installs and development checkouts.
 */
function dshHome() {
  const candidates = []
  if (process.env.DSH_HOME) candidates.push(process.env.DSH_HOME)
  candidates.push(join(homedir(), '.dsh'))

  let dir = import.meta.dirname
  for (let i = 0; i < 8; i++) {
    candidates.push(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  for (const candidate of candidates) {
    try {
      if (SETTINGS_FILENAMES.some((f) => existsSync(join(candidate, f)))) return candidate
      if (existsSync(join(candidate, 'profiles'))) return candidate
    } catch { /* unreadable candidate — try the next */ }
  }
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

// ---------------------------------------------------------------- candidates

/**
 * Collect gateway candidates from one settings namespace value.
 * Understands both layouts:
 *   A. `{ providers: { <name>: { baseURL, apiKeyEnv } } }`   (llm-pi-ai style)
 *   B. `{ baseURL, apiKeyEnv }`                              (direct style)
 */
function collectCandidates(nsValue, ns, out) {
  if (nsValue === null || typeof nsValue !== 'object') return

  const providers = nsValue.providers
  if (providers !== null && typeof providers === 'object') {
    for (const [name, profile] of Object.entries(providers)) {
      if (profile === null || typeof profile !== 'object') continue
      const baseURL = profile.baseURL || profile.baseUrl
      if (typeof baseURL !== 'string' || baseURL === '') continue
      const apiKeyEnv = typeof profile.apiKeyEnv === 'string' ? profile.apiKeyEnv : null
      const apiKey = typeof profile.apiKey === 'string' ? profile.apiKey : null
      if (apiKeyEnv === null && apiKey === null) continue
      const models = Array.isArray(profile.models)
        ? profile.models.map((m) => (m && typeof m === 'object' ? m.id : m)).filter((id) => typeof id === 'string')
        : []
      out.push({
        source: `${ns}.providers.${name}`,
        providerName: name, namespace: ns,
        baseURL: baseURL.replace(/\/+$/, ''),
        apiKeyEnv, apiKey, api: profile.api ?? null, models,
        score: scoreCandidate(baseURL, apiKeyEnv ?? apiKey, profile.api, models.length),
      })
    }
  }

  const direct = nsValue.baseURL || nsValue.baseUrl
  if (typeof direct === 'string' && direct !== '') {
    const apiKeyEnv = typeof nsValue.apiKeyEnv === 'string' ? nsValue.apiKeyEnv : null
    const apiKey = typeof nsValue.apiKey === 'string' ? nsValue.apiKey : null
    if (apiKeyEnv !== null || apiKey !== null) {
      out.push({
        source: `${ns}.baseURL`,
        providerName: ns, namespace: ns,
        baseURL: direct.replace(/\/+$/, ''),
        apiKeyEnv, apiKey, api: null, models: [],
        score: scoreCandidate(direct, apiKeyEnv ?? apiKey, null, 0) - 4,
      })
    }
  }
}

/** Prefer real Volcano Engine gateways, OpenAI-compatible routes and rich model lists. */
function scoreCandidate(baseURL, keyRef, api, modelCount) {
  let score = 0
  if (keyRef) score += 10
  if (typeof api === 'string' && api.includes('openai')) score += 8
  score += Math.min(modelCount, 10)
  if (/\/v[13]$/i.test(baseURL)) score += 3
  if (/volceapi\.com/i.test(baseURL)) score += 15
  return score
}

/** Derive the gateway root by dropping a trailing version segment. */
function gatewayRootOf(baseURL) {
  const stripped = baseURL
    .replace(/\/v[13](?:\/|$)/i, (m) => (m.endsWith('/') ? '/' : ''))
    .replace(/\/+$/, '')
  return stripped === '' ? baseURL : stripped
}

/** Pick the highest-scoring candidate. */
function bestOf(candidates) {
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  return { ...best, gatewayRoot: gatewayRootOf(best.baseURL) }
}

// ---------------------------------------------------------------- discovery

/** 1. Ask the DSH settings service (authoritative, file-layout independent). */
function discoverViaSettings(ctx) {
  const settings = typeof ctx.get === 'function' ? ctx.get('settings') : undefined
  if (settings === undefined) return null

  const candidates = []
  try {
    if (typeof settings.describe === 'function') {
      for (const descriptor of settings.describe({ redactSecrets: true })) {
        if (!descriptor || typeof descriptor.ns !== 'string') continue
        collectCandidates(descriptor.value, descriptor.ns, candidates)
      }
    }
    if (candidates.length === 0 && typeof settings.get === 'function') {
      for (const ns of ['llm-pi-ai', 'dsh-llm-deepseek', 'llm-deepseek']) {
        try { collectCandidates(settings.get(ns), ns, candidates) } catch { /* unregistered */ }
      }
    }
  } catch { return null }

  return bestOf(candidates)
}

/** 2. Scan on-disk settings documents (fallback when no settings service). */
function discoverViaFiles(home) {
  const candidates = []
  const files = []

  for (const name of SETTINGS_FILENAMES) {
    const path = join(home, name)
    if (existsSync(path)) files.push(path)
  }
  // per-profile settings documents, when present
  try {
    const profilesDir = join(home, 'profiles')
    if (existsSync(profilesDir)) {
      for (const entry of readdirSync(profilesDir)) {
        for (const name of SETTINGS_FILENAMES) {
          const path = join(profilesDir, entry, name)
          if (existsSync(path)) files.push(path)
        }
      }
    }
  } catch { /* ignore */ }

  for (const file of files) {
    try {
      const doc = parseYaml(readFileSync(file, 'utf8'))
      if (doc === null || typeof doc !== 'object') continue
      for (const [ns, nsValue] of Object.entries(doc)) collectCandidates(nsValue, ns, candidates)
    } catch { /* unparsable document — skip */ }
  }

  return bestOf(candidates)
}

// ---------------------------------------------------------------- credentials

/** Read the `refs` map of a credentials document. */
function readCredentialRefs(home) {
  for (const name of ['.credentials.yaml', '.credentials.yml', 'credentials.yaml']) {
    const file = join(home, name)
    if (!existsSync(file)) continue
    try {
      const doc = parseYaml(readFileSync(file, 'utf8'))
      if (doc && typeof doc === 'object' && doc.refs && typeof doc.refs === 'object') {
        return Object.fromEntries(Object.entries(doc.refs).filter(([, v]) => typeof v === 'string'))
      }
    } catch { /* unparsable — try the next candidate */ }
  }
  return {}
}

/** Resolve one credential reference through the DSH credentials service, then the file. */
async function resolveCredential(ctx, ref, home) {
  try {
    const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
    if (credentials !== undefined && typeof credentials.resolve === 'function') {
      const resolved = await credentials.resolve(ref)
      if (resolved && typeof resolved.value === 'string' && resolved.value !== '') return resolved.value
    }
  } catch { /* fall through to the file */ }
  return readCredentialRefs(home)[ref] ?? ''
}

// ---------------------------------------------------------------- HTTP helpers

function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra })
  res.end(JSON.stringify(body))
}

function sendError(res, status, message) {
  sendJson(res, status, { error: { message, type: 'error', code: `http_${status}` } })
}

/** Forward one GET to the gateway and normalize the outcome. */
async function proxyGet(gatewayRoot, apiKey, targetPath, query) {
  const qs = query.toString()
  const url = `${gatewayRoot}${targetPath}${qs ? `?${qs}` : ''}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json', 'User-Agent': 'dsh-volcengine-usage/0.2' },
      signal: controller.signal,
    })
    const text = await response.text()
    let body = null
    try { body = text ? JSON.parse(text) : null } catch { body = null }
    if (body === null) return { ok: false, status: response.status, message: `网关返回了非 JSON 响应（HTTP ${response.status}）` }
    if (!response.ok) {
      const detail = body?.error?.message ?? body?.message ?? `HTTP ${response.status}`
      return { ok: false, status: response.status, message: detail }
    }
    return { ok: true, status: response.status, body }
  } catch (error) {
    if (error && error.name === 'AbortError') return { ok: false, status: 504, message: '网关请求超时（15 秒）' }
    return { ok: false, status: 502, message: `网关请求失败：${error instanceof Error ? error.message : String(error)}` }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------- plugin

export const name = 'dsh-volcengine-usage'
export const inject = ['webServer']

export function apply(ctx) {
  const home = dshHome()

  // Short-lived caches: the panel polls once a minute, and re-reading settings
  // plus credentials on every request is unnecessary work.
  let configCache = null
  let configCachedAt = 0
  let keyCache = null
  let keyCachedAt = 0
  let lastError = null

  function resolveConfig() {
    const now = Date.now()
    if (configCache !== null && now - configCachedAt < CONFIG_TTL_MS) return configCache

    const found = discoverViaSettings(ctx) ?? discoverViaFiles(home)
    configCachedAt = now
    if (found === null) {
      lastError = '未能从 DSH 设置中发现 LLM 网关 provider。请先在「设置 → 模型」中配置提供方（需包含 baseURL 与 apiKeyEnv）。'
      configCache = null
      return null
    }
    lastError = null
    configCache = found
    keyCache = null
    return found
  }

  async function resolveKey(config) {
    if (config.apiKey) return config.apiKey
    if (!config.apiKeyEnv) return ''
    const now = Date.now()
    if (keyCache !== null && now - keyCachedAt < KEY_TTL_MS) return keyCache
    const key = await resolveCredential(ctx, config.apiKeyEnv, home)
    keyCache = key
    keyCachedAt = now
    return key
  }

  ctx.effect(() => {
    const webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (webServer === undefined) return

    const disposers = [
      // ---- panel bootstrap: connection state + provider info (never the key) ----
      webServer.register({
        kind: 'exact',
        path: CONFIG_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') { sendJson(res, 405, { error: 'use GET' }, { allow: 'GET' }); return }
          const config = resolveConfig()
          if (config === null) { sendJson(res, 200, { available: false, error: lastError }); return }
          const key = await resolveKey(config)
          sendJson(res, 200, {
            available: true,
            gatewayRoot: config.gatewayRoot,
            providerName: config.providerName,
            namespace: config.namespace,
            source: config.source,
            models: config.models,
            credentialConfigured: key !== '',
          })
        },
      }),

      // ---- gateway passthrough (the API key never leaves this process) ----
      webServer.register({
        kind: 'prefix',
        path: PROXY_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') { sendJson(res, 405, { error: 'use GET' }, { allow: 'GET' }); return }

          const config = resolveConfig()
          if (config === null) { sendError(res, 503, lastError ?? '未找到网关配置'); return }

          const apiKey = await resolveKey(config)
          if (apiKey === '') {
            sendError(res, 503, config.apiKeyEnv
              ? `凭据「${config.apiKeyEnv}」未配置：请在 DSH「设置 → 模型」中填写该提供方的 API Key。`
              : '该提供方未配置 API Key。')
            return
          }

          const url = new URL(req.url ?? '', 'http://dsh.internal')
          const targetPath = url.searchParams.get('path') ?? '/v1/usage/summary'
          url.searchParams.delete('path')

          const result = await proxyGet(config.gatewayRoot, apiKey, targetPath, url.searchParams)
          if (!result.ok) { sendError(res, result.status, result.message); return }
          sendJson(res, result.status, result.body)
        },
      }),
    ]

    return () => disposers.forEach((dispose) => dispose())
  }, 'volcengine-usage: config + proxy routes')
}
