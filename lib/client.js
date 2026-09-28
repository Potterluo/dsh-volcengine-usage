/**
 * dsh-volcengine-usage — client bundle
 *
 * Floating usage panel for the Volcano Engine gateway, rendered into the DSH
 * Web GUI. Self-contained DOM (no framework), themed through DSH's own
 * `--dsw-alias-*` custom properties so it follows every light/dark/custom theme.
 *
 * Design notes:
 *  - The panel has a STABLE content height: the model list reserves five rows,
 *    so switching period never shifts the layout (no height animation, no
 *    forced reflow → no jank).
 *  - The API key never reaches the browser; all gateway calls go through the
 *    Node half's same-origin proxy.
 */
window.__ModuleLoader__.load({
  id: 'dsh-volcengine-usage',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // ================================================================ CSS
    var CSS = `
[data-vu-root] {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
  font-family: var(--dsw-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 12px; line-height: 1.45; color: var(--dsw-alias-label-primary, #1a1c26);
  -webkit-user-select: none; user-select: none;
}
[data-vu-root] * { box-sizing: border-box; }

/* ---- launcher ---- */
[data-vu-launch] {
  width: 36px; height: 36px; display: grid; place-items: center;
  border-radius: 11px; cursor: pointer;
  border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.14));
  background: var(--dsw-alias-button-floating-fill, #fff);
  color: var(--dsw-alias-label-secondary, #5c6273);
  box-shadow: var(--dsw-shadow-lv2, 0 2px 8px rgba(0,0,0,.08));
  transition: transform .14s cubic-bezier(.2,.8,.3,1), box-shadow .14s, color .14s;
}
[data-vu-launch]:hover {
  transform: translateY(-1px); color: var(--dsw-alias-label-primary, #1a1c26);
  box-shadow: var(--dsw-shadow-lv3, 0 6px 18px rgba(0,0,0,.14));
}
[data-vu-launch]:active { transform: scale(.94); }

/* ---- panel shell ---- */
[data-vu-panel] {
  position: absolute; right: 0; bottom: 44px;
  width: 336px; max-height: min(70vh, 560px); overflow-y: auto; overflow-x: hidden;
  padding: 14px;
  border-radius: 15px;
  background: var(--dsw-alias-button-floating-fill, #fff);
  border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.14));
  box-shadow: var(--dsw-shadow-lv3, 0 12px 40px rgba(0,0,0,.16));
  backdrop-filter: blur(20px) saturate(1.3);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  display: none;
  transform-origin: bottom right;
}
[data-vu-panel].open { display: block; animation: vu-in .15s cubic-bezier(.2,.8,.3,1); }
@keyframes vu-in { from { opacity: 0; transform: translateY(4px) scale(.985); } to { opacity: 1; transform: none; } }
[data-vu-panel]::-webkit-scrollbar { width: 5px; }
[data-vu-panel]::-webkit-scrollbar-thumb { background: var(--dsw-alias-scrollbar-bg-l1, rgba(128,128,128,.18)); border-radius: 3px; }
[data-vu-panel]::-webkit-scrollbar-track { background: transparent; }

/* content swap: opacity only (cheap, GPU-composited, no reflow) */
.vu-swap { animation: vu-fade .14s ease-out; }
@keyframes vu-fade { from { opacity: .45; } to { opacity: 1; } }

/* ---- header ---- */
.vu-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 11px; }
.vu-head-t { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; letter-spacing: -.01em; }
.vu-pill {
  display: inline-flex; align-items: center; gap: 4px;
  height: 18px; padding: 0 7px; border-radius: 9px;
  font-size: 10px; font-weight: 500; white-space: nowrap;
}
.vu-pill::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.vu-pill.on { background: var(--dsw-alias-state-success-tertiary, rgba(46,160,67,.1)); color: var(--dsw-alias-state-success-primary, #2ea043); }
.vu-pill.off { background: var(--dsw-alias-state-warn-tertiary, rgba(210,153,34,.1)); color: var(--dsw-alias-state-warn-primary, #b7791f); }

/* ---- segmented period control ---- */
.vu-seg { display: flex; gap: 2px; padding: 2px; margin-bottom: 12px; border-radius: 9px; background: var(--dsw-alias-bg-base, rgba(128,128,128,.07)); }
.vu-seg button {
  flex: 1; height: 24px; border: 0; border-radius: 7px; cursor: pointer;
  background: transparent; color: var(--dsw-alias-label-tertiary, #8b90a0);
  font: inherit; font-size: 11px; font-weight: 500;
  transition: background .12s, color .12s;
}
.vu-seg button:hover { color: var(--dsw-alias-label-primary, #1a1c26); }
.vu-seg button.on {
  background: var(--dsw-alias-button-floating-fill, #fff);
  color: var(--dsw-alias-label-primary, #1a1c26); font-weight: 600;
  box-shadow: var(--dsw-shadow-lv1, 0 1px 3px rgba(0,0,0,.1));
}

/* ---- credit hero ---- */
.vu-hero { padding: 11px 12px; margin-bottom: 10px; border-radius: 11px; background: var(--dsw-alias-bg-base, rgba(128,128,128,.05)); }
.vu-hero-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.vu-hero-lbl { font-size: 10px; color: var(--dsw-alias-label-tertiary, #8b90a0); letter-spacing: .02em; }
.vu-hero-num { font-size: 21px; font-weight: 650; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.vu-hero-num small { font-size: 11px; font-weight: 400; color: var(--dsw-alias-label-tertiary, #8b90a0); margin-left: 3px; letter-spacing: 0; }
.vu-bar { height: 4px; margin: 9px 0 8px; border-radius: 2px; background: var(--dsw-alias-scrollbar-bg-l1, rgba(128,128,128,.14)); overflow: hidden; }
.vu-bar > i { display: block; height: 100%; border-radius: 2px; background: var(--dsw-alias-state-success-primary, #2ea043); transition: width .25s ease-out, background .25s; }
.vu-bar > i.warn { background: var(--dsw-alias-state-warn-primary, #d29922); }
.vu-bar > i.over { background: var(--dsw-alias-state-error-primary, #f85149); }
.vu-chips { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.vu-chip { height: 18px; padding: 0 7px; border-radius: 9px; font-size: 10px; font-variant-numeric: tabular-nums; display: inline-flex; align-items: center; }
.vu-chip.ok { background: var(--dsw-alias-state-success-tertiary, rgba(46,160,67,.1)); color: var(--dsw-alias-state-success-primary, #2ea043); }
.vu-chip.warn { background: var(--dsw-alias-state-warn-tertiary, rgba(210,153,34,.1)); color: var(--dsw-alias-state-warn-primary, #b7791f); }
.vu-chip.bad { background: rgba(248,81,73,.12); color: var(--dsw-alias-state-error-primary, #f85149); font-weight: 600; }
.vu-chip.tool { background: transparent; border: 1px dashed var(--dsw-elevation-stroke-color, rgba(128,128,128,.24)); color: var(--dsw-alias-label-tertiary, #8b90a0); cursor: pointer; }
.vu-chip.tool:hover { color: var(--dsw-alias-label-primary, #1a1c26); border-style: solid; }
.vu-remain { margin-left: auto; font-size: 10px; color: var(--dsw-alias-label-tertiary, #8b90a0); font-variant-numeric: tabular-nums; }

/* ---- limit editor ---- */
.vu-edit { display: none; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12)); }
.vu-edit.open { display: grid; }
.vu-edit label { display: block; font-size: 9px; color: var(--dsw-alias-label-tertiary, #8b90a0); margin-bottom: 3px; }
.vu-edit input {
  width: 100%; height: 24px; padding: 0 6px; border-radius: 6px; font: inherit; font-size: 11px;
  border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.18));
  background: var(--dsw-alias-bg-base, rgba(128,128,128,.05)); color: var(--dsw-alias-label-primary, #1a1c26);
}
.vu-edit input:focus { outline: 2px solid var(--dsw-alias-button-info-fill, #4a6cf7); outline-offset: -1px; }
.vu-edit-actions { grid-column: 1 / -1; display: flex; gap: 6px; margin-top: 2px; }
.vu-edit-actions button {
  height: 24px; padding: 0 12px; border-radius: 7px; cursor: pointer; font: inherit; font-size: 11px;
  border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.18));
  background: transparent; color: var(--dsw-alias-label-primary, #1a1c26);
}
.vu-edit-actions button.pri { background: var(--dsw-alias-button-info-fill, #4a6cf7); color: #fff; border-color: transparent; font-weight: 500; }
.vu-edit-actions button:hover { filter: brightness(.97); }

/* ---- metrics strip ---- */
.vu-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; padding: 9px 0; border-top: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12)); border-bottom: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12)); }
.vu-metric { text-align: center; }
.vu-metric-k { font-size: 9px; color: var(--dsw-alias-label-tertiary, #8b90a0); margin-bottom: 2px; }
.vu-metric-v { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.vu-metric-v em { font-style: normal; font-size: 9px; font-weight: 400; color: var(--dsw-alias-label-tertiary, #8b90a0); margin-left: 1px; }
.vu-sub { display: flex; justify-content: space-between; padding: 7px 2px 9px; font-size: 10px; color: var(--dsw-alias-label-tertiary, #8b90a0); }
.vu-sub b { font-weight: 600; color: var(--dsw-alias-label-secondary, #5c6273); }

/* ---- model list (fixed 5 rows: stable height across periods) ---- */
.vu-models-k { font-size: 10px; color: var(--dsw-alias-label-tertiary, #8b90a0); margin-bottom: 5px; }
.vu-models { min-height: 106px; }
.vu-row { display: flex; align-items: center; gap: 8px; height: 21px; font-size: 11px; }
.vu-row-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vu-row-bar { flex: none; width: 42px; height: 3px; border-radius: 2px; background: var(--dsw-alias-scrollbar-bg-l1, rgba(128,128,128,.14)); overflow: hidden; }
.vu-row-bar > i { display: block; height: 100%; border-radius: 2px; background: var(--dsw-alias-button-info-fill, #4a6cf7); opacity: .75; }
.vu-row-num { flex: none; width: 52px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary, #5c6273); }

/* ---- brand mark ---- */
.vu-mark { display: block; flex: none; }
.vu-head-t .vu-mark { width: 15px; height: 15px; }
[data-vu-launch] .vu-mark { width: 18px; height: 18px; }

/* ---- footer ---- */
.vu-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12)); font-size: 10px; color: var(--dsw-alias-label-tertiary, #8b90a0); }
.vu-refresh { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; border-radius: 6px; padding: 2px 6px; font-variant-numeric: tabular-nums; }
.vu-refresh:hover { background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.08)); color: var(--dsw-alias-label-primary, #1a1c26); }
.vu-refresh.spin svg { animation: vu-spin .8s linear infinite; }
@keyframes vu-spin { to { transform: rotate(360deg); } }

/* ---- states ---- */
.vu-note { padding: 10px 12px; border-radius: 10px; font-size: 11px; line-height: 1.6; }
.vu-note.err { background: rgba(248,81,73,.09); color: var(--dsw-alias-state-error-primary, #f85149); }
.vu-note.warn { background: var(--dsw-alias-state-warn-tertiary, rgba(210,153,34,.1)); color: var(--dsw-alias-state-warn-primary, #b7791f); }
.vu-note button { margin-top: 7px; height: 24px; padding: 0 12px; border-radius: 7px; cursor: pointer; font: inherit; font-size: 11px; border: 1px solid currentColor; background: transparent; color: inherit; }
.vu-skeleton { height: 34px; border-radius: 8px; margin-bottom: 8px; background: linear-gradient(90deg, var(--dsw-alias-bg-base, rgba(128,128,128,.07)) 25%, var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.12)) 37%, var(--dsw-alias-bg-base, rgba(128,128,128,.07)) 63%); background-size: 400% 100%; animation: vu-sk 1.3s ease-in-out infinite; }
@keyframes vu-sk { from { background-position: 100% 0; } to { background-position: 0 0; } }

@media (prefers-reduced-motion: reduce) {
  [data-vu-panel].open, .vu-swap, .vu-skeleton, .vu-refresh.spin svg { animation: none !important; }
}
`

    // ================================================================ icons
    // Volcano Engine brand mark — the official favicon (assets/volcengine-mark-64.png),
    // inlined so the bundle stays self-contained. Re-embed with scripts/embed-logo.mjs.
    // "Volcano Engine" and its logo are trademarks of Beijing Volcano Engine Technology Co., Ltd.;
    // this project is unaffiliated and uses the mark only to identify the service it measures.
    var ICON_BRAND = '<img class="vu-mark" alt="" src="data:image/png;base64,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">'
    var ICON_REFRESH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>'

    // ================================================================ helpers
    function abbr(n) {
      if (n === null || n === undefined || !isFinite(n)) return '--'
      var a = Math.abs(n)
      if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'
      if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M'
      if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K'
      return String(Math.round(n))
    }
    function num(n) { return (n === null || n === undefined || !isFinite(n)) ? '--' : Number(n).toLocaleString() }
    function credit(n) { return (n === null || n === undefined || !isFinite(n)) ? '--' : Number(n).toFixed(2) }
    function rate(v) { return (v === null || v === undefined || !isFinite(v)) ? '--' : (v * 100).toFixed(1) + '%' }
    function toNum(v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return (!isFinite(n) || n < 0) ? null : n }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] }) }

    var LIMIT_KEY = 'vu.limits.v3'
    var LIMIT_DEFAULTS = { dailyWarning: 360, dailyAlert: 480, dailyBlock: 600, weeklyBlock: 2500, monthlyBlock: 5000 }
    var PERIODS = [['today', '今日'], ['week', '本周'], ['month', '本月']]
    var BLOCK_KEY = { today: 'dailyBlock', week: 'weeklyBlock', month: 'monthlyBlock' }

    function loadLimits() {
      try {
        var raw = localStorage.getItem(LIMIT_KEY)
        if (!raw) return null
        var parsed = JSON.parse(raw)
        return (parsed && typeof parsed === 'object') ? parsed : null
      } catch { return null }
    }
    function saveLimits(v) { try { localStorage.setItem(LIMIT_KEY, JSON.stringify(v)) } catch { /* private mode */ } }

    // ================================================================ transport
    async function getJson(url) {
      var response = await fetch(url)
      var body = null
      try { body = await response.json() } catch { body = null }
      if (!response.ok) throw new Error((body && body.error && body.error.message) || ('HTTP ' + response.status))
      if (body === null) throw new Error('网关返回了空响应')
      return body
    }
    function proxy(path, params) {
      var url = '/volcengine-usage/proxy?path=' + encodeURIComponent(path)
      if (params) for (var k in params) if (params[k] !== undefined && params[k] !== null) url += '&' + k + '=' + encodeURIComponent(params[k])
      return getJson(url)
    }
    function config() { return getJson('/volcengine-usage/config') }

    // ================================================================ credit model
    // Credit = Σ over days (day total tokens × coefficient effective that day) ÷ 1e6,
    // using each model's credit_history — the BlueRegion Usage contract.
    function creditForDay(model, day, current, history) {
      if (history && history.length && day) {
        var v = null
        for (var i = 0; i < history.length; i++) { if (history[i].from <= day) v = history[i].credit; else break }
        if (v !== null && v !== undefined) return v
      }
      return (current === undefined) ? null : current
    }
    function modelCredit(row, current, history) {
      var sum = 0, found = false
      if (row.daily && row.daily.length) {
        for (var i = 0; i < row.daily.length; i++) {
          var c = creditForDay(row.model, row.daily[i].date, current[row.model], history[row.model])
          if (c !== null) { found = true; sum += (row.daily[i].total_tokens || 0) * c / 1e6 }
        }
        return found ? sum : null
      }
      var c0 = creditForDay(row.model, null, current[row.model], history[row.model])
      return (c0 === null) ? null : ((row.total_tokens || 0) * c0 / 1e6)
    }
    function totalCredit(rows, current, history) {
      var sum = 0, found = false
      for (var i = 0; i < (rows || []).length; i++) {
        var v = modelCredit(rows[i], current, history)
        if (v !== null) { found = true; sum += v }
      }
      return found ? sum : null
    }

    // ================================================================ plugin
    function apply(ctx) {
      if (document.querySelector('[data-vu-root]')) return function () { }

      var style = document.createElement('style')
      style.textContent = CSS
      document.head.appendChild(style)

      var root = document.createElement('div')
      root.setAttribute('data-vu-root', '')

      var launch = document.createElement('button')
      launch.setAttribute('data-vu-launch', '')
      launch.type = 'button'
      launch.title = '火山引擎用量'
      launch.innerHTML = ICON_BRAND
      root.appendChild(launch)

      var panel = document.createElement('div')
      panel.setAttribute('data-vu-panel', '')
      root.appendChild(panel)
      document.body.appendChild(root)

      var state = {
        open: false, period: 'today',
        cfg: null, summary: null, rows: null,
        creditCurrent: {}, creditHistory: {},
        loading: false, error: null, updatedAt: 0,
        limits: Object.assign({}, LIMIT_DEFAULTS, loadLimits() || {}),
      }

      // ---------------------------------------------------------- render
      function renderHead() {
        var on = !!(state.cfg && state.cfg.available)
        return '<div class="vu-head">' +
          '<span class="vu-head-t">' + ICON_BRAND + '<span>火山引擎用量</span></span>' +
          '<span class="vu-pill ' + (on ? 'on' : 'off') + '">' + (on ? '已连接' : '未连接') + '</span>' +
          '</div>'
      }

      function renderPeriods() {
        var html = '<div class="vu-seg">'
        for (var i = 0; i < PERIODS.length; i++) {
          var key = PERIODS[i][0]
          html += '<button type="button" data-period="' + key + '" class="' + (state.period === key ? 'on' : '') + '">' + PERIODS[i][1] + '</button>'
        }
        return html + '</div>'
      }

      function renderCredit() {
        var used = totalCredit(state.rows, state.creditCurrent, state.creditHistory)
        var limits = state.limits
        var block = toNum(limits[BLOCK_KEY[state.period]]) 
        var pct = (block && used !== null) ? Math.min(used / block * 100, 100) : 0
        var tone = 'ok'
        if (used !== null) {
          if (state.period === 'today') {
            if (toNum(limits.dailyBlock) !== null && used >= limits.dailyBlock) tone = 'bad'
            else if (toNum(limits.dailyAlert) !== null && used >= limits.dailyAlert) tone = 'warn'
            else if (toNum(limits.dailyWarning) !== null && used >= limits.dailyWarning) tone = 'warn'
          } else if (block && used >= block) tone = 'bad'
          else if (block && used >= block * 0.8) tone = 'warn'
        }
        var barClass = tone === 'bad' ? 'over' : (tone === 'warn' ? 'warn' : '')

        var html = '<div class="vu-hero">' +
          '<div class="vu-hero-top">' +
          '<span class="vu-hero-lbl">CREDIT 用量（估算）</span>' +
          '<span class="vu-hero-num">' + credit(used) + (block ? '<small>/ ' + num(block) + '</small>' : '') + '</span>' +
          '</div>' +
          '<div class="vu-bar"><i class="' + barClass + '" style="width:' + pct + '%"></i></div>' +
          '<div class="vu-chips">'

        function chip(label, value) {
          if (value === null || value === undefined) return ''
          var hit = used !== null && used >= value
          var cls = hit ? 'bad' : (label === '提醒' ? 'ok' : 'warn')
          return '<span class="vu-chip ' + cls + '">' + label + ' ' + num(value) + (hit ? ' ✕' : '') + '</span>'
        }
        if (state.period === 'today') {
          html += chip('提醒', toNum(limits.dailyWarning)) + chip('预警', toNum(limits.dailyAlert)) + chip('封禁', toNum(limits.dailyBlock))
        } else if (state.period === 'week') {
          html += chip('封禁', toNum(limits.weeklyBlock))
        } else {
          html += chip('封禁', toNum(limits.monthlyBlock))
        }
        if (block && used !== null) {
          var remain = Math.max(block - used, 0)
          html += '<span class="vu-remain">剩余 ' + credit(remain) + '</span>'
        }
        html += '<span class="vu-chip tool" data-open-edit>⚙ 限额</span>'
        html += '</div>'

        // limit editor
        var l = state.limits
        html += '<div class="vu-edit" data-edit>' +
          '<div><label>日提醒</label><input type="number" min="0" data-l="dailyWarning" value="' + (l.dailyWarning ?? '') + '"></div>' +
          '<div><label>日预警</label><input type="number" min="0" data-l="dailyAlert" value="' + (l.dailyAlert ?? '') + '"></div>' +
          '<div><label>日封禁</label><input type="number" min="0" data-l="dailyBlock" value="' + (l.dailyBlock ?? '') + '"></div>' +
          '<div><label>周封禁</label><input type="number" min="0" data-l="weeklyBlock" value="' + (l.weeklyBlock ?? '') + '"></div>' +
          '<div><label>月封禁</label><input type="number" min="0" data-l="monthlyBlock" value="' + (l.monthlyBlock ?? '') + '"></div>' +
          '<div class="vu-edit-actions"><button type="button" class="pri" data-save>保存</button><button type="button" data-cancel>取消</button></div>' +
          '</div>'

        return html + '</div>'
      }

      function renderMetrics() {
        var d = state.summary && state.summary.data
        if (!d) return '<div class="vu-metrics">' + skeleton() + '</div>'
        var cached = d.cached_tokens || 0
        var uncached = Math.max((d.req_tokens || 0) - cached, 0)
        var out = d.rsp_tokens || 0
        var cacheRate = d.req_tokens > 0 ? cached / d.req_tokens : null
        return '<div class="vu-metrics">' +
          metric('输入', uncached, 'tok') +
          metric('缓存', cached, 'tok') +
          metric('输出', out, 'tok') +
          metric('请求', d.request_count || 0, '') +
          '</div>' +
          '<div class="vu-sub"><span>缓存命中 <b>' + rate(cacheRate) + '</b></span><span>总量 <b>' + abbr((d.req_tokens || 0) + out) + '</b> tok</span></div>'
      }

      function metric(label, value, unit) {
        return '<div class="vu-metric"><div class="vu-metric-k">' + label + '</div>' +
          '<div class="vu-metric-v">' + abbr(value) + (unit ? '<em>' + unit + '</em>' : '') + '</div></div>'
      }

      function skeleton() {
        return '<div style="grid-column:1/-1"><div class="vu-skeleton" style="height:22px"></div></div>'
      }

      function renderModels() {
        var rows = state.rows || []
        var html = '<div class="vu-models-k">模型用量 TOP5</div><div class="vu-models">'
        var tops = rows.slice(0, 5)
        var max = 0
        for (var i = 0; i < tops.length; i++) {
          var t = (tops[i].req_tokens || 0) + (tops[i].rsp_tokens || 0)
          if (t > max) max = t
        }
        for (var j = 0; j < tops.length; j++) {
          var row = tops[j]
          var total = (row.req_tokens || 0) + (row.rsp_tokens || 0)
          var width = max > 0 ? Math.max(total / max * 100, 3) : 0
          html += '<div class="vu-row" title="' + esc(row.model) + '">' +
            '<span class="vu-row-name">' + esc(row.model) + '</span>' +
            '<span class="vu-row-bar"><i style="width:' + width + '%"></i></span>' +
            '<span class="vu-row-num">' + abbr(total) + '</span>' +
            '</div>'
        }
        // reserve five rows so the panel height never changes between periods
        for (var k = tops.length; k < 5; k++) html += '<div class="vu-row"></div>'
        return html + '</div>'
      }

      function renderFoot() {
        var time = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '--'
        var spinning = state.loading ? ' spin' : ''
        return '<div class="vu-foot"><span>更新于 ' + time + '</span>' +
          '<span class="vu-refresh' + spinning + '" data-refresh>' + ICON_REFRESH +
          '<span>' + (state.loading ? '刷新中' : Math.max(countdown, 0) + 's') + '</span></span></div>'
      }

      function render() {
        if (state.cfg === null && state.error === null) {
          panel.innerHTML = '<div class="vu-swap">' + renderHead() + '<div class="vu-skeleton"></div><div class="vu-skeleton"></div><div class="vu-skeleton"></div></div>'
          bind()
          return
        }

        if (state.cfg && state.cfg.available === false) {
          panel.innerHTML = '<div class="vu-swap">' + renderHead() +
            '<div class="vu-note warn">' + esc(state.cfg.error || '未能发现网关配置') +
            '<br><button type="button" data-refresh>重新检测</button></div></div>'
          bind()
          return
        }

        var body
        if (state.error) {
          body = '<div class="vu-note err">' + esc(state.error) + '<br><button type="button" data-refresh>重试</button></div>'
        } else {
          body = renderCredit() + renderMetrics() + renderModels()
        }

        panel.innerHTML = '<div class="vu-swap">' + renderHead() + renderPeriods() + body + renderFoot() + '</div>'
        bind()
      }

      // ---------------------------------------------------------- events
      function bind() {
        var segs = panel.querySelectorAll('.vu-seg button')
        for (var i = 0; i < segs.length; i++) {
          segs[i].addEventListener('click', function () {
            var next = this.getAttribute('data-period')
            if (next === state.period) return
            state.period = next
            state.summary = null
            state.rows = null
            render()
            refresh()
          })
        }

        var refreshBtn = panel.querySelector('[data-refresh]')
        if (refreshBtn) refreshBtn.addEventListener('click', function () { refresh() })

        var edit = panel.querySelector('[data-edit]')
        var opener = panel.querySelector('[data-open-edit]')
        if (opener && edit) opener.addEventListener('click', function () { edit.classList.toggle('open') })

        var cancel = panel.querySelector('[data-cancel]')
        if (cancel && edit) cancel.addEventListener('click', function () { edit.classList.remove('open') })

        var save = panel.querySelector('[data-save]')
        if (save) save.addEventListener('click', function () {
          var next = {}
          var inputs = panel.querySelectorAll('[data-l]')
          for (var n = 0; n < inputs.length; n++) next[inputs[n].getAttribute('data-l')] = toNum(inputs[n].value)
          state.limits = Object.assign({}, LIMIT_DEFAULTS, next)
          saveLimits(state.limits)
          render()
        })
      }

      // ---------------------------------------------------------- data
      var refreshing = false
      var countdown = 60

      async function refresh() {
        if (refreshing) return
        refreshing = true
        countdown = 60
        state.loading = true
        state.error = null
        render()

        try {
          if (state.cfg === null) state.cfg = await config()

          if (state.cfg && state.cfg.available === false) {
            state.loading = false
            refreshing = false
            render()
            return
          }

          var period = state.period
          var jobs = [
            proxy('/v1/usage/summary', { window: period }),
            proxy('/v1/usage/by-model', { window: period }),
          ]
          if (Object.keys(state.creditCurrent).length === 0) jobs.push(proxy('/v1/models'))

          var results = await Promise.allSettled(jobs)

          if (results[0].status === 'fulfilled' && results[0].value) state.summary = results[0].value
          else state.error = (results[0].reason && results[0].reason.message) || '用量数据加载失败'

          if (results[1].status === 'fulfilled' && results[1].value) state.rows = results[1].value.data || []
          else if (!state.error) state.error = (results[1].reason && results[1].reason.message) || '模型明细加载失败'

          if (results[2] && results[2].status === 'fulfilled' && results[2].value) {
            var models = results[2].value.data || []
            var current = {}, history = {}
            for (var i = 0; i < models.length; i++) {
              var m = models[i]
              if (!m || !m.id) continue
              current[m.id] = (m.credit === undefined) ? null : m.credit
              history[m.id] = Array.isArray(m.credit_history) ? m.credit_history : []
            }
            state.creditCurrent = current
            state.creditHistory = history
          }

          state.updatedAt = Date.now()
        } catch (error) {
          state.error = (error && error.message) || String(error)
        }

        state.loading = false
        refreshing = false
        render()
      }

      // ---------------------------------------------------------- lifecycle
      function open() {
        state.open = true
        panel.classList.add('open')
        render()
        refresh()
      }
      function close() {
        state.open = false
        panel.classList.remove('open')
      }

      launch.addEventListener('click', function (event) {
        event.stopPropagation()
        if (state.open) close(); else open()
      })
      panel.addEventListener('click', function (event) { event.stopPropagation() })
      document.addEventListener('click', function (event) {
        if (state.open && !root.contains(event.target)) close()
      })

      var autoTimer = setInterval(function () {
        if (state.open && !refreshing) refresh()
      }, 60000)

      var tickTimer = setInterval(function () {
        if (!state.open || state.loading) return
        countdown -= 1
        if (countdown <= 0) countdown = 60
        var el = panel.querySelector('[data-refresh] > span:last-child')
        if (el) el.textContent = countdown + 's'
      }, 1000)

      function onVisible() {
        if (document.visibilityState === 'visible' && state.open && !refreshing) refresh()
      }
      document.addEventListener('visibilitychange', onVisible)

      function dispose() {
        clearInterval(autoTimer)
        clearInterval(tickTimer)
        document.removeEventListener('visibilitychange', onVisible)
        root.remove()
        style.remove()
      }

      return dispose
    }

    exports.name = 'dsh-volcengine-usage'
    exports.apply = apply
    return module.exports
  },
})
