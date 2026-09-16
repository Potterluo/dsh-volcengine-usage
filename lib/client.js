/**
 * dsh-volcengine-usage Client bundle v2
 * 浏览器端：在页面右下角悬浮显示火山引擎网关额度消耗
 *
 * 主题适配：使用 DSH 平台 --dsw-alias-* CSS 变量，自动适配所有主题。
 * Credit 估算：按日分段 × 模型生效系数 ÷ 1e6（同 BlueRegion Usage）。
 * 限额：日提醒360/日预警480/日封禁600 / 周封禁2500 / 月封禁5000（可配置，存 localStorage）
 */
window.__ModuleLoader__.load({
  id: 'dsh-volcengine-usage',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // ========== CSS（使用 DSH 平台主题变量，适配所有主题）==========
    var CSS =
`[data-vu-body] {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
  font-family: var(--dsw-font-family, system-ui, -apple-system, sans-serif);
  line-height: 1.5; user-select: none; -webkit-user-select: none;
  font-size: 13px;
  color: var(--dsw-alias-label-primary, #1a1c26);
}
[data-vu-toggle] {
  width: 38px; height: 38px;
  border-radius: 10px;
  border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12));
  background: var(--dsw-alias-button-floating-fill, #fff);
  color: var(--dsw-alias-label-secondary, #6b7080);
  cursor: pointer;
  display: grid; place-items: center;
  font-size: 16px;
  box-shadow: var(--dsw-shadow-lv2, 0 2px 8px rgba(0,0,0,.08));
  transition: transform .1s ease, box-shadow .1s ease;
}
[data-vu-toggle]:hover { transform: scale(1.07); box-shadow: var(--dsw-shadow-lv3, 0 4px 14px rgba(0,0,0,.1)); }
[data-vu-toggle]:active { transform: scale(.92); }
[data-vu-panel] {
  position: absolute; right: 0; bottom: 46px;
  width: 360px; max-height: 560px; overflow-y: auto;
  background: var(--dsw-alias-button-floating-fill, #fff);
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12));
  border-radius: 14px;
  box-shadow: var(--dsw-shadow-lv3, 0 12px 40px rgba(0,0,0,.16));
  display: none; padding: 14px;
  transition: height .18s ease;
}
[data-vu-panel].open { display: block; }
[data-vu-panel]::-webkit-scrollbar { width: 4px; }
[data-vu-panel]::-webkit-scrollbar-track { background: transparent; }
[data-vu-panel]::-webkit-scrollbar-thumb { background: var(--dsw-alias-scrollbar-bg-l1, rgba(128,128,128,.12)); border-radius: 2px; }

/* Header */
.vu-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.vu-hdr-l { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 14px; color: var(--dsw-alias-label-primary); }
.vu-hdr-ico { color: var(--dsw-alias-brand-primary, #4a6cf7); flex-shrink: 0; }
.vu-badge {
  font-size: 10px; padding: 2px 8px; border-radius: 6px; font-weight: 500;
  background: var(--dsw-alias-state-success-tertiary, rgba(46,160,67,.1));
  color: var(--dsw-alias-state-success-primary, #3fb950);
}
.vu-badge.err {
  background: var(--dsw-alias-state-warn-tertiary, rgba(210,153,34,.1));
  color: var(--dsw-alias-state-warn-primary, #d29922);
}

/* Tabs */
.vu-tabs { display: flex; gap: 2px; margin-bottom: 10px; background: var(--dsw-alias-bg-base, rgba(0,0,0,.02)); border-radius: 8px; padding: 2px; }
.vu-tab {
  flex: 1; padding: 5px 0; border: none; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-tertiary, #8b90a0);
  cursor: pointer; font-size: 12px; font-weight: 500; font-family: inherit;
  transition: all .1s;
}
.vu-tab:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.05)); }
.vu-tab.active {
  background: var(--dsw-alias-button-info-fill, #4a6cf7);
  color: var(--dsw-alias-label-primary-foreground, #fff);
  font-weight: 600;
  box-shadow: var(--dsw-shadow-lv1, 0 1px 3px rgba(0,0,0,.12));
}

/* KPI grid */
.vu-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 8px; }
.vu-kpi {
  background: var(--dsw-alias-bg-base, rgba(0,0,0,.02));
  border-radius: 8px; padding: 7px 10px;
}
.vu-kpi-full { grid-column: 1 / -1; }
.vu-kpi-lbl { font-size: 10px; color: var(--dsw-alias-label-tertiary); margin-bottom: 1px; letter-spacing: .01em; }
.vu-kpi-val { font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; }
.vu-kpi-val .vu-un { font-size: 10px; font-weight: 400; color: var(--dsw-alias-label-tertiary); margin-left: 2px; }

/* Credit card */
.vu-cc {
  background: var(--dsw-alias-bg-base, rgba(0,0,0,.02));
  border-radius: 9px; padding: 10px 12px; margin-bottom: 8px;
}
.vu-cc-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.vu-cc-val { font-size: 18px; font-weight: 650; font-variant-numeric: tabular-nums; }
.vu-cc-val .vu-un { font-size: 11px; font-weight: 400; color: var(--dsw-alias-label-tertiary); margin-left: 2px; }
.vu-cc-bar { flex: 1; height: 6px; background: var(--dsw-alias-scrollbar-bg-l1, rgba(128,128,128,.1)); border-radius: 99px; overflow: hidden; }
.vu-cc-fill { height: 100%; border-radius: 99px; transition: width .3s, background .3s; }
.vu-cc-fill.safe { background: var(--dsw-alias-state-success-primary, #3fb950); }
.vu-cc-fill.warn { background: var(--dsw-alias-state-warn-primary, #d29922); }
.vu-cc-fill.danger { background: var(--dsw-alias-state-error-primary, #f85149); }
.vu-cc-fill.over { background: var(--dsw-alias-state-error-primary, #f85149); }

/* Limit badges */
.vu-ll { display: flex; flex-wrap: wrap; gap: 3px 6px; margin-top: 5px; align-items: center; }
.vu-ll-item {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  font-variant-numeric: tabular-nums; white-space: nowrap; display: inline-flex; align-items: center; gap: 3px;
}
.vu-ll-item.ok { background: var(--dsw-alias-state-success-tertiary, rgba(46,160,67,.1)); color: var(--dsw-alias-state-success-primary, #3fb950); }
.vu-ll-item.warn { background: var(--dsw-alias-state-warn-tertiary, rgba(210,153,34,.1)); color: var(--dsw-alias-state-warn-primary, #d29922); }
.vu-ll-item.danger { background: rgba(248,81,73,.1); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #f85149) 12%, transparent); color: var(--dsw-alias-state-error-primary, #f85149); }
.vu-ll-item.over { background: rgba(248,81,73,.16); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #f85149) 18%, transparent); color: var(--dsw-alias-state-error-primary, #f85149); font-weight: 600; }
.vu-ll-remain { font-size: 10px; color: var(--dsw-alias-label-tertiary); margin-left: auto; }

/* Limit config */
.vu-lc-btn {
  font-size: 10px; color: var(--dsw-alias-label-tertiary); cursor: pointer;
  padding: 1px 6px; border-radius: 4px; background: var(--dsw-alias-bg-base);
  border: 1px dashed var(--dsw-elevation-stroke-color, rgba(128,128,128,.12));
  display: inline-block; margin-top: 4px;
}
.vu-lc-btn:hover { background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.05)); }
.vu-lc-form { display: none; margin-top: 7px; padding: 10px; background: var(--dsw-alias-bg-base); border-radius: 8px; }
.vu-lc-form.open { display: block; }
.vu-lc-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-bottom: 5px; }
.vu-lc-fld label { display: block; font-size: 9px; color: var(--dsw-alias-label-tertiary); margin-bottom: 1px; }
.vu-lc-fld input { width: 100%; box-sizing: border-box; padding: 3px 5px; border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12)); border-radius: 4px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 11px; font-family: inherit; }
.vu-lc-actions { display: flex; gap: 5px; }
.vu-lc-actions button { padding: 3px 9px; border: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.12)); border-radius: 5px; background: var(--dsw-alias-button-floating-fill); color: var(--dsw-alias-label-primary); cursor: pointer; font-size: 10px; font-family: inherit; }
.vu-lc-actions button:hover { background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.05)); }
.vu-lc-actions .vu-pri { background: var(--dsw-alias-button-info-fill, #4a6cf7); color: #fff; border-color: transparent; }
.vu-lc-actions .vu-pri:hover { filter: brightness(1.08); }

/* Model list */
.vu-mh { font-size: 10px; color: var(--dsw-alias-label-tertiary); margin-bottom: 3px; }
.vu-mr { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 11px; border-bottom: 1px solid var(--dsw-elevation-stroke-color, rgba(128,128,128,.05)); }
.vu-mr-last { border-bottom: none; }
.vu-mn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; color: var(--dsw-alias-label-primary); }
.vu-mt { font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--dsw-alias-label-secondary); }

/* Loading / Error */
.vu-load { text-align: center; padding: 24px 0; color: var(--dsw-alias-label-tertiary); font-size: 12px; }
.vu-err { text-align: center; padding: 20px 0; color: var(--dsw-alias-state-error-primary, #f85149); font-size: 12px; }

/* Footer */
.vu-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 7px; padding-top: 6px; font-size: 10px; color: var(--dsw-alias-label-tertiary); }
.vu-foot button { background: none; border: none; color: var(--dsw-alias-label-tertiary); cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: inherit; }
.vu-foot button:hover { background: var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,.05)); color: var(--dsw-alias-label-primary); }

@media (max-width: 480px) { [data-vu-panel] { width: calc(100vw - 28px); right: 0; bottom: 50px; } }

/* 面板展开动画 */
@keyframes vu-pop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
[data-vu-panel].open { animation: vu-pop .16s ease-out; }
/* 内容区域刷新时的淡入（tab 切换/数据更新） */
@keyframes vu-fade { from { opacity: .25; } to { opacity: 1; } }
.vu-content { animation: vu-fade .18s ease-out; }
`

    // ========== 工具 ==========
    function abbr(n) {
      if (n == null || !isFinite(n)) return '--'
      var a = Math.abs(n)
      return a >= 1e9 ? (n/1e9).toFixed(2)+'B' : a >= 1e6 ? (n/1e6).toFixed(2)+'M' : a >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(Math.round(n))
    }
    function full(n) { return (n == null || !isFinite(n)) ? '--' : n.toLocaleString() }
    function pct(v) { return (v == null || !isFinite(v)) ? '--' : (v*100).toFixed(1)+'%' }
    function toNum(v) { if (v===null||v===undefined||v==='') return null; var n=Number(v); return (!isFinite(n)||n<0)?null:n }
    function clip(n) { return (n==null||!isFinite(n))?'--':n.toFixed(2) }
    function int(n) { return (n==null||!isFinite(n))?'--':Math.round(n).toLocaleString() }

    function todayStr() { return new Date().toISOString().slice(0,10) }

    var STORAGE_KEY = 'vu-limits.v2'
    var DEFAULTS = { dailyWarning:360, dailyAlert:480, dailyBlock:600, weeklyBlock:2500, monthlyBlock:5000 }

    function loadLimits() { try { var r=localStorage.getItem(STORAGE_KEY); if(!r)return null; var o=JSON.parse(r); return o&&typeof o==='object'?o:null }catch{} }
    function saveLimits(l) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)) }catch{} }

    // ========== 数据 ==========
    async function proxyGet(path, params) {
      var u = '/volcengine-usage/proxy?path=' + encodeURIComponent(path)
      if (params) for (var k in params) if (params[k]!=null) u += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k])
      var r = await fetch(u)
      if (!r.ok) { var e; try { e=await r.json() }catch{}; throw new Error(e?.error?.message||'HTTP '+r.status) }
      return r.json()
    }

    // 直接 fetch config（不走 proxy，因为 config 是插件自身的端点）
    async function fetchConfig() {
      var r = await fetch('/volcengine-usage/config')
      if (!r.ok) return null
      return r.json()
    }

    // ========== Credit 估算（同 BlueRegion Usage：按日分段 × 生效系数 ÷ 1e6）==========
    function creditOn(modelId, dateStr, creditMap, creditHistMap) {
      var hist = creditHistMap[modelId]
      if (hist && hist.length && dateStr) {
        var v = null
        for (var i = 0; i < hist.length; i++) { if (hist[i].from <= dateStr) v = hist[i].credit; else break }
        if (v !== null) return v
      }
      var cur = creditMap[modelId]; return (cur==null)?null:cur
    }

    function modelCreditUsage(r, creditMap, creditHistMap) {
      var sum = 0, has = false
      if (r.daily && r.daily.length) {
        for (var i = 0; i < r.daily.length; i++) {
          var c = creditOn(r.model, r.daily[i].date, creditMap, creditHistMap)
          if (c !== null) { has = true; sum += (r.daily[i].total_tokens || 0) * c / 1e6 }
        }
        return has ? sum : null
      }
      var c = creditOn(r.model, todayStr(), creditMap, creditHistMap)
      return (c !== null) ? ((r.total_tokens || 0) * c / 1e6) : null
    }

    function sumCredit(list, creditMap, creditHistMap) {
      var sum = 0, has = false
      if (list) for (var i = 0; i < list.length; i++) {
        var v = modelCreditUsage(list[i], creditMap, creditHistMap)
        if (v !== null) { has = true; sum += v }
      }
      return has ? sum : null
    }

    // ========== SVG 图标 ==========
    var SVG_METER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg>'
    var SVG_LIGHTNING = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'

    // ========== 插件入口 ==========
    function apply(ctx) {
      if (document.querySelector('[data-vu-body]')) return function(){}

      var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style)

      var host = document.createElement('div'); host.setAttribute('data-vu-body', '')
      var toggle = document.createElement('button'); toggle.setAttribute('data-vu-toggle', '')
      toggle.innerHTML = SVG_LIGHTNING; toggle.title = '火山引擎网关额度消耗'
      host.appendChild(toggle)

      var panel = document.createElement('div'); panel.setAttribute('data-vu-panel', '')
      host.appendChild(panel); document.body.appendChild(host)

      var state = {
        open: false, config: null, period: 'today',
        summary: null, byModel: null, models: null,
        creditMap: {}, creditHistMap: {},
        loading: false, error: null, lastUpdated: null,
        limits: Object.assign({}, DEFAULTS, loadLimits() || {}),
      }

      // ---- 渲染 ----
      function render() {
        if (state.error) {
          panel.innerHTML = '<div class="vu-err">⚠ '+state.error+'</div>'; return
        }

        var cfg = state.config, s = state.summary, ml = state.byModel, lim = state.limits
        var credit = sumCredit(ml, state.creditMap, state.creditHistMap)
        var totalTok = s?.data ? (s.data.req_tokens||0)+(s.data.rsp_tokens||0) : 0

        // Header
        var html = '<div class="vu-hdr"><div class="vu-hdr-l">'+SVG_METER+'<span>火山引擎·额度消耗</span></div><span class="vu-badge'+(cfg?.available?'':' err')+'">'+(cfg?.available?'已连接':'未连接')+'</span></div>'

        // Tabs
        var PS = {today:'今日',week:'本周',month:'本月'}
        html += '<div class="vu-tabs">'
        for (var p in PS) html += '<button class="vu-tab'+(state.period===p?' active':'')+'" data-p="'+p+'">'+PS[p]+'</button>'
        html += '</div>'

        // KPI
        html += '<div class="vu-kpis">'
        if (s?.data) {
          var d=s.data, unc=Math.max((d.req_tokens||0)-(d.cached_tokens||0),0), cac=d.cached_tokens||0, rsp=d.rsp_tokens||0, req=d.request_count||0, cr=d.req_tokens>0?d.cached_tokens/d.req_tokens:null
          html += '<div class="vu-kpi"><div class="vu-kpi-lbl">输入(未缓存)</div><div class="vu-kpi-val">'+abbr(unc)+'<span class="vu-un">tok</span></div></div>'
            +'<div class="vu-kpi"><div class="vu-kpi-lbl">输入(缓存)</div><div class="vu-kpi-val">'+abbr(cac)+'<span class="vu-un">tok</span></div></div>'
            +'<div class="vu-kpi"><div class="vu-kpi-lbl">输出</div><div class="vu-kpi-val">'+abbr(rsp)+'<span class="vu-un">tok</span></div></div>'
            +'<div class="vu-kpi"><div class="vu-kpi-lbl">请求</div><div class="vu-kpi-val">'+full(req)+'</div></div>'
            +'<div class="vu-kpi vu-kpi-full" style="display:flex;justify-content:space-between"><span style="color:var(--dsw-alias-label-tertiary);font-size:10px">缓存率 '+pct(cr)+'</span><span style="color:var(--dsw-alias-label-tertiary);font-size:10px">总量 '+abbr(totalTok)+' tok</span></div>'
          // 移除环比徽章（较昨日/较上周/较上月），避免不同周期高度不一致导致切换跳动
        } else if (state.loading) html += '<div class="vu-load" style="grid-column:1/-1">加载中…</div>'; else html += '<div class="vu-load" style="grid-column:1/-1">暂无数据</div>'
        html += '</div>'

        // Credit card
        if (credit !== null && isFinite(credit)) {
          var limitVal=null, limitLabel=''
          if (state.period==='today') { limitVal=lim.dailyBlock; limitLabel='日' }
          else if (state.period==='week') { limitVal=lim.weeklyBlock; limitLabel='周' }
          else if (state.period==='month') { limitVal=lim.monthlyBlock; limitLabel='月' }

          var barPct = limitVal>0 ? Math.min(credit/limitVal*100,100) : 0
          var barCls = 'safe'
          if (limitVal>0 && credit>=limitVal) barCls='over'
          else if (state.period==='today' && limitVal>0) {
            if (credit>=lim.dailyAlert) barCls='over'
            else if (credit>=lim.dailyWarning) barCls='warn'
          } else if (limitVal>0 && credit>=limitVal*0.8) barCls='warn'

          html += '<div class="vu-cc">'
            +'<div class="vu-cc-top">'
            +'<span class="vu-cc-val">'+clip(credit)+'<span class="vu-un">Credit</span></span>'
            +'<div class="vu-cc-bar"><div class="vu-cc-fill '+barCls+'" style="width:'+barPct+'%"></div></div>'
            +'<span style="font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap">'+(''+clip(limitVal))+'</span>'
            +'</div>'
            +'<div class="vu-ll">'

          // Limit badges per period
          if (state.period==='today') {
            html += liBdg('提醒', lim.dailyWarning, credit, 'ok')
              + liBdg('预警', lim.dailyAlert, credit, 'warn')
              + liBdg('封禁', lim.dailyBlock, credit, 'danger')
          } else if (state.period==='week') html += liBdg('封禁', lim.weeklyBlock, credit, 'danger')
          else html += liBdg('封禁', lim.monthlyBlock, credit, 'danger')

          // Remaining
          if (limitVal>0) { var rm=Math.max(limitVal-credit,0); html += '<span class="vu-ll-remain">剩余 '+clip(rm)+' ('+(rm/limitVal*100).toFixed(0)+'%)</span>' }
          html += '</div>'

          // Config button + form
          html += '<span class="vu-lc-btn" id="vu-lc">⚙ 配置</span>'
            +'<div class="vu-lc-form" id="vu-lcf">'
            +'<div class="vu-lc-grid">'
            +'<div class="vu-lc-fld"><label>日提醒</label><input id="l-dw" type="number" value="'+(lim.dailyWarning||'')+'"></div>'
            +'<div class="vu-lc-fld"><label>日预警</label><input id="l-da" type="number" value="'+(lim.dailyAlert||'')+'"></div>'
            +'<div class="vu-lc-fld"><label>日封禁</label><input id="l-db" type="number" value="'+(lim.dailyBlock||'')+'"></div>'
            +'<div class="vu-lc-fld"><label>周封禁</label><input id="l-wb" type="number" value="'+(lim.weeklyBlock||'')+'"></div>'
            +'<div class="vu-lc-fld"><label>月封禁</label><input id="l-mb" type="number" value="'+(lim.monthlyBlock||'')+'"></div>'
            +'</div><div class="vu-lc-actions">'
            +'<button class="vu-pri" id="l-sv">保存</button><button id="l-ca">取消</button>'
            +'</div></div></div>'
        }

        function liBdg(lbl, val, used, cls) {
          if (val==null) return ''
          var over = used>=val
          return '<span class="vu-ll-item '+(over?'over':cls)+'">'+lbl+' '+int(val)+(over?' ✕':'')+'</span>'
        }

        // Model TOP5
        if (ml?.length) {
          html += '<div class="vu-mh">模型 TOP5</div>'
          var top = ml.slice(0,5)
          for (var i=0;i<top.length;i++) {
            var mt = (top[i].req_tokens||0)+(top[i].rsp_tokens||0)
            html += '<div class="vu-mr'+(i===top.length-1?' vu-mr-last':'')+'"><span class="vu-mn" title="'+top[i].model+'">'+top[i].model+'</span><span class="vu-mt">'+abbr(mt)+' tok</span></div>'
          }
        }

        // Footer
        var ts = state.lastUpdated ? new Date(state.lastUpdated).toLocaleTimeString() : '--'
        html += '<div class="vu-foot"><span>更新 '+ts+'</span><button id="vu-rf">⟳</button></div>'

        panel.innerHTML = '<div class="vu-content">' + html + '</div>'
        bindUI(); fitHeight()
      }

      function bindUI() {
        // Period switching
        panel.querySelectorAll('.vu-tab').forEach(function(el){
          el.addEventListener('click',function(){ var p=this.getAttribute('data-p'); if(p!==state.period){state.period=p;refresh()} })
        })
        // Refresh button
        var rf=panel.querySelector('#vu-rf'); if(rf) rf.addEventListener('click',function(){this.disabled=true;refresh().then(()=>{this.disabled=false})})
        // Limit config
        var lc=panel.querySelector('#vu-lc'), lf=panel.querySelector('#vu-lcf')
        if(lc&&lf) lc.addEventListener('click',function(){lf.classList.toggle('open')})
        panel.querySelector('#l-ca')?.addEventListener('click',function(){lf?.classList.remove('open')})
        panel.querySelector('#l-sv')?.addEventListener('click',function(){
          var nw=toNum(panel.querySelector('#l-dw')?.value), na=toNum(panel.querySelector('#l-da')?.value), nb=toNum(panel.querySelector('#l-db')?.value), nw2=toNum(panel.querySelector('#l-wb')?.value), nm=toNum(panel.querySelector('#l-mb')?.value)
          var nx={dailyWarning:nw,dailyAlert:na,dailyBlock:nb,weeklyBlock:nw2,monthlyBlock:nm}
          state.limits=nx; saveLimits(nx); lf.classList.remove('open'); render()
        })
      }

      // ---- 高度平滑过渡 ----
      var prevHeight = null
      function fitHeight() {
        if (!open) return
        // 测量自然高度
        panel.style.height = ''
        var h = Math.min(panel.scrollHeight, 560)
        if (prevHeight !== null && Math.abs(prevHeight - h) > 2) {
          // 从旧高度过渡到新高度
          panel.style.height = prevHeight + 'px'
          void panel.offsetHeight
          panel.style.height = h + 'px'
        } else {
          panel.style.height = h + 'px'
        }
        prevHeight = h
      }
      var refreshing = false
      async function refresh() {
        if (refreshing) return
        refreshing = true; state.loading = true; state.error = null
        try {
          var w = state.period
          var jobs = [proxyGet('/v1/usage/summary',{window:w}), proxyGet('/v1/usage/by-model',{window:w})]
          // 首次加载取 /config（连接状态，直接 fetch 不走 proxy）和 /v1/models（credit 系数）
          if (!state.config) jobs.push(fetchConfig())
          if (!state.models) jobs.push(proxyGet('/v1/models'))
          var results = await Promise.allSettled(jobs)
          var i2 = 0
          if (results[i2].status==='fulfilled') state.summary=results[i2].value; else state.error='用量加载失败'; i2++
          if (results[i2].status==='fulfilled') state.byModel=results[i2].value.data||[]; else if(!state.error) state.error='模型明细加载失败'; i2++
          if (!state.config) {
            // config 失败不阻塞用量面板，仅影响连接徽标
            if (results[i2]?.status==='fulfilled') state.config=results[i2].value
            i2++
          }
          if (!state.models && results[i2]?.status==='fulfilled') {
            state.models=results[i2].value.data||[]
            var cm={}, ch={}
            for (var i=0;i<state.models.length;i++) { var m=state.models[i]; if(m.id){cm[m.id]=m.credit!=null?m.credit:null; ch[m.id]=m.credit_history||[]} }
            state.creditMap=cm; state.creditHistMap=ch
          }
          state.lastUpdated = Date.now()
        } catch (err) { state.error=err instanceof Error?err.message:String(err) }
        state.loading=false; refreshing=false; render()
      }

      var open = false
      function openPanel() { open=true; panel.classList.add('open'); prevHeight=null; requestAnimationFrame(function(){ fitHeight(); if(!state.summary) refresh() }) }
      function closePanel() { open=false; panel.classList.remove('open') }
      toggle.addEventListener('click', function(e){ e.stopPropagation(); if(open){closePanel()}else{openPanel()} })
      // 点击面板外部（非 host 区域）自动收起
      document.addEventListener('click', function(e){ if(open && !host.contains(e.target)) closePanel() })
      // 面板内点击不冒泡到 document（防误关）
      panel.addEventListener('click', function(e){ e.stopPropagation() })
      var autoInt = setInterval(function(){ if(open&&!refreshing) refresh() }, 60000)

      return function dispose(){ clearInterval(autoInt); host.remove(); style.remove() }
    }

    exports.name = 'dsh-volcengine-usage'
    exports.apply = apply
    return module.exports
  }
})