/**
 * Regenerate docs/screenshot.png from the REAL client bundle.
 *
 * Mounts lib/client.js in a headless browser against mock gateway payloads, so
 * the README image can never drift from the shipped UI. The same run is a smoke
 * test: it fails when the bundle throws or renders no rows.
 *
 * Usage: node scripts/screenshot.mjs
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'docs', 'screenshot.png')
const WIDTH = 400
const HEIGHT = 560

const MOCK = {
  config: {
    available: true,
    gatewayRoot: 'https://xxxxxxxx.apigateway-cn-beijing.volceapi.com',
    providerName: 'voice', namespace: 'llm-pi-ai', source: 'llm-pi-ai.providers.voice',
    models: ['deepseek-v4.1-flash'], credentialConfigured: true,
  },
  summary: {
    data: { req_tokens: 3471257, rsp_tokens: 13687, cached_tokens: 2684544, cache_hit_rate: 0.7734, request_count: 9 },
  },
  byModel: {
    data: [
      { model: 'deepseek-v4.1-flash', req_tokens: 3120840, rsp_tokens: 11820, total_tokens: 3132660, daily: [{ date: '2026-09-28', total_tokens: 3132660 }] },
      { model: 'deepseek-v4-pro', req_tokens: 268140, rsp_tokens: 1290, total_tokens: 269430, daily: [{ date: '2026-09-28', total_tokens: 269430 }] },
      { model: 'doubao-seed-2.1-pro', req_tokens: 82277, rsp_tokens: 577, total_tokens: 82854, daily: [{ date: '2026-09-28', total_tokens: 82854 }] },
      { model: 'qwen3.8-max', req_tokens: 21044, rsp_tokens: 0, total_tokens: 21044, daily: [{ date: '2026-09-28', total_tokens: 21044 }] },
    ],
  },
  models: {
    data: [
      { id: 'deepseek-v4.1-flash', credit: 0.33, credit_history: [{ from: '2026-08-01', credit: 0.28 }, { from: '2026-09-14', credit: 0.33 }] },
      { id: 'deepseek-v4-pro', credit: 0.99, credit_history: [{ from: '2026-08-01', credit: 0.99 }] },
      { id: 'doubao-seed-2.1-pro', credit: 1.85, credit_history: [{ from: '2026-08-01', credit: 1.85 }] },
      { id: 'qwen3.8-max', credit: 2.84, credit_history: [{ from: '2026-08-01', credit: 2.84 }] },
    ],
  },
}

const PAGE = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>dsh-volcengine-usage</title>
<style>
  html,body{margin:0}
  body{min-height:100vh;padding:22px;display:flex;justify-content:center;align-items:flex-start;
       background:linear-gradient(150deg,#eef1f6 0%,#e3e8f1 100%);
       font-family:system-ui,-apple-system,"Segoe UI","PingFang SC",sans-serif}
  /* Screenshot chrome only: unhook the panel from the viewport corner and
     settle it immediately (the real UI animates in; a still must not be caught
     mid-fade). */
  [data-vu-root]{position:static !important;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:10px}
  [data-vu-panel]{position:static !important;display:block !important;animation:none !important;opacity:1 !important}
  .vu-swap{animation:none !important;opacity:1 !important}
</style></head><body>
<script>
  window.__errors=[]
  window.onerror=function(m,s,l,c){window.__errors.push(String(m)+' @'+l+':'+c)}
  window.__ModuleLoader__={load:function(r){window.__reg=r}}
  var MOCK=${JSON.stringify(MOCK)}
  window.fetch=function(url){
    var u=decodeURIComponent(String(url)),body=null
    if(u.indexOf('/volcengine-usage/config')===0)body=MOCK.config
    else if(u.indexOf('/v1/usage/summary')!==-1)body=MOCK.summary
    else if(u.indexOf('/v1/usage/by-model')!==-1)body=MOCK.byModel
    else if(u.indexOf('/v1/models')!==-1)body=MOCK.models
    return Promise.resolve({ok:true,status:200,json:function(){return Promise.resolve(body)}})
  }
<\/script>
<script src="/client.js"><\/script>
<script>
  try{
    var mod=window.__reg.factory(function(spec){throw new Error('unexpected require: '+spec)})
    mod.apply({})
    document.querySelector('[data-vu-launch]').click()
  }catch(e){window.__errors.push('mount: '+e.message)}
<\/script></body></html>`

const clientBundle = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')

const server = createServer((req, res) => {
  if (req.url === '/client.js') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' })
    res.end(clientBundle)
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(PAGE)
})

const PORT = 9470 + Math.floor(Math.random() * 300)
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve))

/** First browser that exists on this machine. */
function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]
  return candidates.find((path) => existsSync(path)) ?? null
}

const browser = findBrowser()
if (browser === null) {
  console.error('[screenshot] no Edge/Chrome found — skipping')
  server.close()
  process.exit(0)
}

const profile = join(tmpdir(), 'vu-shot-' + PORT)
rmSync(OUT, { force: true })

const child = spawn(browser, [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars',
  '--virtual-time-budget=5000',
  '--user-data-dir=' + profile,
  `--screenshot=${OUT}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  `http://127.0.0.1:${PORT}/`,
], { stdio: ['ignore', 'ignore', 'pipe'] })

let browserLog = ''
child.stderr?.on('data', (chunk) => { browserLog += chunk })

// Chromium may hand the work to a child process and exit early, so poll for the
// artifact rather than trusting the exit code.
const deadline = Date.now() + 25000
while (Date.now() < deadline) {
  if (existsSync(OUT) && readFileSync(OUT).length > 2000) break
  await new Promise((resolve) => setTimeout(resolve, 250))
}
child.kill()
server.close()
try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }) } catch { /* browser may still hold it */ }

if (!existsSync(OUT)) {
  console.error(`[screenshot] browser produced no image. log: ${browserLog.trim() || '(empty)'}`)
  process.exit(1)
}

const bytes = readFileSync(OUT).length
if (bytes < 2000) {
  console.error(`[screenshot] image looks empty (${bytes} bytes)`)
  process.exit(1)
}
console.log(`[screenshot] wrote docs/screenshot.png (${(bytes / 1024).toFixed(1)} KB, ${WIDTH}x${HEIGHT} @2x)`)
