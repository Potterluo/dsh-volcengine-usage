/**
 * dsh-volcengine-usage Node half
 *
 * 自动发现 DSH 中的 LLM 网关 provider 配置（不限命名空间、不限 provider 名），
 * 解析 API Key，注册代理路由供 client 查询网关 usage 接口。
 *
 * 发现算法：
 *   1. 扫描 settings.yaml 所有顶层命名空间，找形如：
 *      - llm-pi-ai.providers.<任一名>.baseURL + apiKeyEnv
 *      - 任意命名空间.baseURL + apiKeyEnv（如 dsh-llm-deepseek）
 *   2. 评分优选：有 apiKeyEnv/Key + 有 api(openai-completions) + 模型多 → 分高
 *   3. 若自动发现失败，可尝试手动覆盖：
 *      用户可将想要的 provider 名（如 "voice"）设为自定义 setting
 *
 * Routes:
 *   GET /volcengine-usage/config  → 网关基本信息
 *   GET /volcengine-usage/proxy?path=...  → 代理调用网关
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { load as parseYaml } from 'js-yaml'

export const ROUTE_PREFIX = '/volcengine-usage'
export const CONFIG_PATH = `${ROUTE_PREFIX}/config`
export const PROXY_PATH = `${ROUTE_PREFIX}/proxy`
const PROXY_TIMEOUT_MS = 15000

/**
 * 探测 DSH 主目录：返回第一个存在 settings.yaml 的候选路径。
 * 插件可能从不同位置加载（profile node_modules / 全局安装 / 开发目录），
 * 硬编码某一级相对路径不可靠，因此依次尝试：
 *   1. 环境变量 DSH_HOME
 *   2. 用户主目录 ~/.dsh
 *   3. 从插件目录逐级向上找（兼容任意嵌套深度）
 */
function dshHome() {
  const candidates = []
  if (process.env.DSH_HOME) candidates.push(process.env.DSH_HOME)
  candidates.push(join(homedir(), '.dsh'))

  // 向上遍历插件所在目录树（最多 8 级，覆盖 profile node_modules 等深嵌套）
  let dir = import.meta.dirname
  for (let i = 0; i < 8; i++) {
    candidates.push(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  for (const candidate of candidates) {
    try {
      if (existsSync(join(candidate, 'settings.yaml'))) return candidate
    } catch { /* 忽略不可读路径 */ }
  }
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

// ---- 自动发现 provider 配置 ----

/**
 * 扫描 settings.yaml，找出最可能的目标网关 provider。
 * 返回值：{ baseURL, gatewayRoot, apiKeyEnv, apiKeyDirect, models, providerId, providerName, namespace, foundBy } | null
 */
function discoverProvider(home) {
  const settingsFile = join(home, 'settings.yaml')
  if (!existsSync(settingsFile)) return { error: `settings.yaml 不存在于 ${home}` }

  let doc
  try { doc = parseYaml(readFileSync(settingsFile, 'utf8')) }
  catch (e) { return { error: `settings.yaml 解析失败: ${e instanceof Error ? e.message : String(e)}` } }
  if (typeof doc !== 'object' || doc === null) return { error: 'settings.yaml 内容不是合法的 YAML 对象' }

  const candidates = []

  for (const [ns, nsValue] of Object.entries(doc)) {
    if (typeof nsValue !== 'object' || nsValue === null) continue

    // 模式 A: llm-pi-ai.providers.<name> 风格
    if (typeof nsValue.providers === 'object' && nsValue.providers !== null) {
      for (const [name, profile] of Object.entries(nsValue.providers)) {
        if (typeof profile !== 'object' || profile === null) continue
        const baseURL = profile.baseURL || profile.baseUrl
        if (!baseURL) continue
        const apiKeyEnv = profile.apiKeyEnv
        const apiKeyDirect = profile.apiKey
        const api = profile.api
        if (!apiKeyEnv && !apiKeyDirect) continue

        const models = Array.isArray(profile.models) ? profile.models.map(m => m.id || m) : []
        let score = 0
        if (apiKeyEnv || apiKeyDirect) score += 10
        if (api === 'openai-completions' || (typeof api === 'string' && api.includes('openai'))) score += 8
        if (models.length > 0) score += Math.min(models.length, 10)
        // /v1 结尾更可能是 OpenAI 兼容网关
        if (/\/v[13]$/i.test(baseURL)) score += 3
        // 火山引擎 API 网关
        if (/volceapi\.com/i.test(baseURL)) score += 15

        candidates.push({
          namespace: ns, providerName: name, baseURL: String(baseURL).replace(/\/+$/, ''),
          apiKeyEnv, apiKeyDirect, api, models, score,
          foundBy: `llm-pi-ai style: ${ns}.providers.${name}`,
        })
      }
    }

    // 模式 B: 直接 <ns>.baseURL + apiKeyEnv（简化风格）
    const directBaseURL = nsValue.baseURL || nsValue.baseUrl
    if (directBaseURL) {
      const apiKeyEnv = nsValue.apiKeyEnv
      const apiKeyDirect = nsValue.apiKey
      if (apiKeyEnv || apiKeyDirect) {
        let directScore = 6
        if (/volceapi\.com/i.test(directBaseURL)) directScore += 15
        candidates.push({
          namespace: ns, providerName: ns, baseURL: String(directBaseURL).replace(/\/+$/, ''),
          apiKeyEnv, apiKeyDirect, api: null, models: [], score: directScore,
          foundBy: `direct style: ${ns}.baseURL`,
        })
      }
    }
  }

  if (candidates.length === 0) {
    return {
      error: 'settings.yaml 中未找到任何 LLM 网关 provider 配置。\n' +
        '期望的配置格式（在 settings.yaml 中）：\n' +
        '  llm-pi-ai:\n' +
        '    providers:\n' +
        '      你的提供商名:\n' +
        '        baseURL: https://你的网关地址/v1\n' +
        '        apiKeyEnv: YOUR_API_KEY_REF\n' +
        '（或通过 DSH 设置面板 > 模型 > 添加提供方来配置）',
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  const gatewayRoot = best.baseURL
    .replace(/\/v[13](?:\/|$)/i, (m) => m.endsWith('/') ? '/' : '')
    .replace(/\/+$/, '')

  return {
    baseURL: best.baseURL,
    gatewayRoot,
    apiKeyEnv: best.apiKeyEnv || null,
    apiKeyDirect: best.apiKeyDirect || null,
    models: best.models,
    providerId: best.providerName,
    providerName: best.providerName,
    namespace: best.namespace,
    foundBy: best.foundBy,
    debug: `top candidate: ${best.foundBy} (score ${best.score})`,
  }
}

// ---- 凭证读取 ----

function readCredentials(home) {
  const credFile = join(home, '.credentials.yaml')
  if (!existsSync(credFile)) return {}
  try {
    const doc = parseYaml(readFileSync(credFile, 'utf8'))
    if (typeof doc !== 'object' || doc === null) return {}
    if (typeof doc.refs !== 'object' || doc.refs === null) return {}
    const out = {}
    for (const [key, val] of Object.entries(doc.refs)) {
      if (typeof val === 'string') out[key] = val
    }
    return out
  } catch { return {} }
}

async function resolveApiKey(ctx, apiKeyEnv, fallback) {
  try {
    const creds = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
    if (creds && typeof creds.resolve === 'function') {
      const result = await creds.resolve(apiKeyEnv)
      if (result && typeof result.value === 'string' && result.value.length > 0) return result.value
    }
  } catch { /* 回退到文件读取 */ }
  return fallback
}

// ---- HTTP 辅助 ----

function json(res, status, body, extra = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra,
  })
  res.end(JSON.stringify(body))
}
function errorJson(res, status, message) {
  json(res, status, { error: { message, type: 'error', code: `http_${status}` } })
}

async function proxyRequest(gatewayBaseUrl, apiKey, req, res) {
  const urlObj = new URL(req.url ?? '', 'http://dsh.internal')
  const targetPath = urlObj.searchParams.get('path') || '/v1/usage/summary'
  urlObj.searchParams.delete('path')
  const queryString = urlObj.searchParams.toString()
  const target = `${gatewayBaseUrl}${targetPath}${queryString ? '?' + queryString : ''}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const resp = await fetch(target, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'dsh-volcengine-usage/0.1',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await resp.json()
      json(res, resp.status, resp.ok ? body : { error: body, status: resp.status })
    } else {
      const text = await resp.text()
      json(res, resp.status, resp.ok
        ? { data: text }
        : { error: { message: `gateway returned ${resp.status}`, detail: text.slice(0, 200) }, status: resp.status })
    }
  } catch (err) {
    clearTimeout(timer)
    if (err && typeof err === 'object' && err.name === 'AbortError') {
      errorJson(res, 504, '网关请求超时')
    } else {
      errorJson(res, 502, `网关请求失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

// ---- 插件入口 ----

export const name = 'dsh-volcengine-usage'
export const inject = ['webServer']

export function apply(ctx) {
  const home = dshHome()
  const discovery = discoverProvider(home)

  ctx.effect(() => {
    const webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (webServer === undefined) return

    if (!discovery || discovery.error) {
      const errMsg = discovery?.error || '未知错误'
      return webServer.register({
        kind: 'exact',
        path: CONFIG_PATH,
        handler: async (req, res) => {
          json(res, 200, { available: false, error: errMsg })
        },
      })
    }

    // 读取凭证：优先 direct apiKey，其次 apiKeyEnv
    let apiKey = discovery.apiKeyDirect || ''
    const creds = readCredentials(home)
    if (!apiKey && discovery.apiKeyEnv) apiKey = creds[discovery.apiKeyEnv] || ''
    const gatewayBaseURL = discovery.gatewayRoot

    let resolvedApiKey = apiKey
    if (discovery.apiKeyEnv) {
      resolveApiKey(ctx, discovery.apiKeyEnv, apiKey).then(key => { resolvedApiKey = key })
    }

    const disposers = [
      // CONFIG
      webServer.register({
        kind: 'exact',
        path: CONFIG_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') { json(res, 405, { error: 'use GET' }, { allow: 'GET' }); return }
          json(res, 200, {
            available: true,
            gatewayRoot: discovery.gatewayRoot,
            providerId: discovery.providerId,
            providerName: discovery.providerName,
            namespace: discovery.namespace,
            models: discovery.models,
            modelsCount: discovery.models.length,
            foundBy: discovery.foundBy,
          })
        },
      }),

      // PROXY
      webServer.register({
        kind: 'prefix',
        path: PROXY_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') { json(res, 405, { error: 'use GET' }, { allow: 'GET' }); return }
          let key = resolvedApiKey
          if (!key && !apiKey && discovery.apiKeyEnv) {
            key = await resolveApiKey(ctx, discovery.apiKeyEnv, creds[discovery.apiKeyEnv] || '')
            resolvedApiKey = key
          }
          if (!key) {
            const hint = discovery.apiKeyEnv
              ? `凭证引用 "${discovery.apiKeyEnv}" (检查 DSH 凭证设置或 .credentials.yaml)`
              : '未配置 API Key'
            errorJson(res, 502, `无法获取 API Key：${hint}`)
            return
          }
          await proxyRequest(gatewayBaseURL, key, req, res)
        },
      }),
    ]

    return () => disposers.forEach(d => d())
  }, 'volcengine-usage: proxy & config routes')
}