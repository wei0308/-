// 投資助手：所有資料存在這台裝置的 localStorage，行情來自 Twelve Data（使用者自己的 API 金鑰）
const KEY = "invest-helper-v1";
const CACHE_KEY = "invest-helper-cache-v1";
const CACHE_MIN = 15;

const DEFAULT = {
  settings: { apiKey: "", capitalTWD: 86000, fx: 32.48, riskPct: 2, levCapPct: 5, stockCapPct: 20, corePct: 80 },
  holdings: [],
  rules: [],
  events: [],
  journal: [],
  check: { symbol: "", stop: "", items: {} }
};

const CHECKS = [
  ["stop", "停損價", "停損價寫在上面，依據是支撐、ATR 或基本面；用停損市價單"],
  ["reason", "買進理由", "一句話寫得出來，不是「別人說」"],
  ["health", "公司體檢", "自由現金流、負債／EBITDA、客戶集中都看過"],
  ["trend", "趨勢", "價格在 20 日均線上方，均線往上"],
  ["event", "事件", "近期沒有財報、FOMC、CPI、非農；有的話等事件後"],
  ["size", "股數", "用計算機算過：願意虧的錢 ÷ 停損距離"],
  ["cap", "部位上限", "沒有超過單一個股或槓桿商品的上限"],
  ["exit", "出場規則", "停利或減碼價、時間出場日都寫好了"],
  ["lev", "槓桿商品", "如果是槓桿商品：只做短線、不帶過財報"],
  ["fail", "失敗理由", "寫得出這筆交易可能失敗的 3 個理由"]
];

const HEALTH = [
  ["growth", "營收成長（%）", v => v > 0, "Income Statement"],
  ["netMargin", "淨利率（%）", v => v >= 10, "Margins"],
  ["fcf", "自由現金流（億美元）", v => v > 0, "Cash Flow"],
  ["debtEbitda", "負債／EBITDA（倍）", v => v < 3, "Financial Position"],
  ["netCash", "淨現金（億美元）", v => v >= 0, "Balance Sheet"],
  ["pe", "本益比（倍）", v => v > 0 && v < 30, "Valuation Ratios"]
];

let S = load();
let view = "dash";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (v, d = 2) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d) + "%";

function load() {
  try { return Object.assign(structuredClone(DEFAULT), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return structuredClone(DEFAULT); }
}
function save(fromSync) {
  if (!fromSync) S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("無法儲存：瀏覽器拒絕寫入"); }
  if (!fromSync && (fbOn() || Sync.on())) { clearTimeout(save.t); save.t = setTimeout(syncPush, fbOn() ? 1500 : 3000); }
}
const fbOn = () => !!(window.FB && FB.user);
async function syncPush() {
  try { fbOn() ? await FB.push(S) : await Sync.push(S); } catch (e) { toast("同步失敗：" + e.message); }
}
function applyRemote(remote, quiet) {
  const key = S.settings.apiKey;
  S = Object.assign(structuredClone(DEFAULT), remote);
  S.settings.apiKey = S.settings.apiKey || key;
  save(true);
  if (!quiet) toast("已從雲端更新資料");
  VIEWS[view]();
}
// Firebase：登入後比較一次，之後靠即時監聽
async function fbReconcile(quiet) {
  try {
    const remote = await FB.pull();
    if (remote && (remote.updatedAt || 0) > (S.updatedAt || 0)) applyRemote(remote, quiet);
    else if (!remote || (S.updatedAt || 0) > (remote.updatedAt || 0)) { await FB.push(S); if (!quiet) toast("已上傳到雲端"); }
    else if (!quiet) toast("已經是最新");
  } catch (e) { toast("同步失敗：" + e.message); }
}
window.addEventListener("fb-auth", e => { if (e.detail) fbReconcile(true); if (view === "settings") VIEWS.settings(); });
window.addEventListener("fb-remote", e => { if ((e.detail.updatedAt || 0) > (S.updatedAt || 0)) applyRemote(e.detail); });
// 打開 App 時：雲端比較新就下載，本機比較新就上傳
async function syncNow(quiet) {
  if (fbOn()) return fbReconcile(quiet);
  if (!Sync.on()) return;
  try {
    const remote = await Sync.pull();
    if (remote && (remote.updatedAt || 0) > (S.updatedAt || 0)) {
      const key = S.settings.apiKey;
      S = Object.assign(structuredClone(DEFAULT), remote);
      S.settings.apiKey = key;
      save(true);
      const c = Sync.cfg(); c.last = Date.now(); Sync.setCfg(c);
      if (!quiet) toast("已從雲端更新資料");
      VIEWS[view]();
    } else if (!remote || (S.updatedAt || 0) > (remote.updatedAt || 0)) {
      await Sync.push(S);
      if (!quiet) toast("已上傳到雲端");
    } else if (!quiet) toast("已經是最新");
  } catch (e) { toast("同步失敗：" + e.message); }
}
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2200); }

// ===== 行情 =====
function cacheGet() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; } }
function cacheSet(c) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {} }

async function series(symbol, force) {
  const c = cacheGet(), hit = c[symbol];
  // ver 2 起有成交量和 150 天資料；舊版快取直接重抓
  if (!force && hit && hit.ver === 2 && Date.now() - hit.t < CACHE_MIN * 60000) return hit;
  if (isTW(symbol)) return twSeries(symbol, c);
  if (!S.settings.apiKey) throw new Error("請先到「設定」填入 Twelve Data API 金鑰");
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=150&apikey=${encodeURIComponent(S.settings.apiKey)}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status === "error" || !j.values) throw new Error(j.message || "抓不到資料");
  const bars = j.values.map(v => ({ d: v.datetime, o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +v.volume || 0 })).reverse();
  c[symbol] = { t: Date.now(), bars, ver: 2 };
  cacheSet(c);
  return c[symbol];
}

// 台股（上市、上櫃、ETF）：代號是 4–6 位數字，可加一個英文字母，例如 0050、2330、00878、00632R
const isTW = s => /^\d{4,6}[A-Z]?$/.test(s);
// FinMind 免費台股日 K，不需要金鑰
async function twSeries(symbol, c) {
  const start = new Date(Date.now() - 230 * 864e5).toISOString().slice(0, 10);
  const r = await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${encodeURIComponent(symbol)}&start_date=${start}`);
  const j = await r.json();
  if (j.status !== 200 || !j.data || !j.data.length) throw new Error(j.msg && j.msg !== "success" ? j.msg : "抓不到這支台股的資料");
  const bars = j.data.filter(d => d.close > 0).map(d => ({ d: d.date, o: d.open, h: d.max, l: d.min, c: d.close, v: d.Trading_Volume }));
  c[symbol] = { t: Date.now(), bars, ver: 2, tw: true };
  cacheSet(c);
  return c[symbol];
}

// 美東時間今天是否還在盤中：最後一根若是今天且未到 16:00，就當作盤中價，前一根才是收盤
function nyNow() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: +g("hour") };
}
function analyze(bars) {
  const ny = nyNow(), lastBar = bars[bars.length - 1];
  const live = lastBar.d === ny.date && ny.hour < 16;
  const closed = live ? bars.slice(0, -1) : bars;
  const lastClose = closed[closed.length - 1];
  const prevClose = closed[closed.length - 2];
  const price = lastBar.c;
  const s5 = Ind.sma(bars, 5), s10 = Ind.sma(bars, 10), s20 = Ind.sma(bars, 20), rsiArr = Ind.rsi(closed);
  const ma20 = Ind.last(Ind.sma(closed, 20)), ma10 = Ind.last(Ind.sma(closed, 10)), ma5 = Ind.last(Ind.sma(closed, 5));
  const rsi = Ind.last(rsiArr), atr = Ind.last(Ind.atr(closed)), m = Ind.macd(closed);
  return {
    bars, s5, s10, s20, rsiArr, histArr: m.hist,
    live, price, lastClose: lastClose.c, lastCloseDate: lastClose.d,
    chg: live ? (price / lastClose.c - 1) * 100 : (lastClose.c / prevClose.c - 1) * 100,
    ma5, ma10, ma20, rsi, atr, atrPct: atr / lastClose.c * 100, hist: Ind.last(m.hist), macd: Ind.last(m.macd),
    low52: Math.min(...closed.map(b => b.l))
  };
}

// ===== 規則判斷 =====
const KINDS = { closeBelow: "收盤跌破", closeAbove: "收盤站上", priceBelow: "價格跌破", priceAbove: "價格漲到" };
function ruleStatus(rule, a) {
  if (!a) return { cls: "off", txt: "沒有資料" };
  const v = +rule.value, below = rule.kind.endsWith("Below");
  const ref = rule.kind.startsWith("close") ? a.lastClose : a.price;
  const hit = below ? ref < v : ref >= v;
  const dist = (v / ref - 1) * 100;
  if (hit) return { cls: "hit", txt: "已觸發", dist };
  if (Math.abs(dist) <= 3) return { cls: "near", txt: `接近 ${pct(dist)}`, dist };
  return { cls: "ok", txt: `距離 ${pct(dist)}`, dist };
}

// ===== 畫面 =====
const VIEWS = {};
function go(v) {
  view = v;
  document.querySelectorAll(".tab").forEach(t => t.toggleAttribute("aria-current", t.dataset.view === v));
  if (document.querySelector(`.tab[data-view="${v}"]`)) document.querySelector(`.tab[data-view="${v}"]`).setAttribute("aria-current", "page");
  VIEWS[v]();
  $("#main").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => go(t.dataset.view)));

// --- 總覽 ---
VIEWS.dash = async function (force) {
  const m = $("#main");
  const syms = [...new Set([...S.holdings.map(h => h.symbol), ...S.rules.map(r => r.symbol)])].filter(Boolean);
  m.innerHTML = `<h1>總覽</h1><p class="sub">持倉、規則和指標。資料每 ${CACHE_MIN} 分鐘最多更新一次。</p>
    <div class="row" style="margin-bottom:16px"><button class="btn" id="refresh">更新行情</button><span class="muted" id="status"></span></div>
    <div class="stack" id="dashBody"><div class="card"><p>載入中…</p></div></div>`;
  $("#refresh").onclick = () => VIEWS.dash(true);
  if (!syms.length) {
    $("#dashBody").innerHTML = `<div class="banner info">還沒有持倉。到「設定」新增持倉和規則，或貼上備份資料匯入。</div>`;
    return;
  }
  const A = {}, errs = [];
  for (const s of syms) {
    const h = S.holdings.find(x => x.symbol === s);
    // 先抓即時行情；抓不到才用手動價格
    try { A[s] = analyze((await series(s, force)).bars); }
    catch (e) {
      if (h && h.manualPrice) A[s] = { manual: true, live: false, price: +h.manualPrice, lastClose: +h.manualPrice };
      else errs.push(`${s}：${e.message}`);
    }
  }
  const c = cacheGet();
  const times = syms.map(s => c[s]?.t).filter(Boolean);
  $("#status").textContent = times.length ? `資料時間 ${new Date(Math.min(...times)).toLocaleString("zh-TW", { hour12: false })}` : "";

  const hits = S.rules.filter(r => !r.done && ruleStatus(r, A[r.symbol]).cls === "hit");
  let html = "";
  if (hits.length) html += `<div class="banner hit">⚠ ${hits.length} 條規則已觸發：${hits.map(r => esc(r.action)).join("；")}</div>`;
  if (errs.length) html += `<div class="banner warn">${errs.map(esc).join("<br>")}</div>`;

  // 配置
  const fx = +S.settings.fx || 32.5;
  let core = 0, sat = 0;
  const hv = S.holdings.map(h => {
    const a = A[h.symbol];
    const price = a ? a.price : null;
    const valTWD = price == null ? null : price * h.shares * (h.currency === "TWD" ? 1 : fx);
    if (valTWD != null) (h.type === "核心" ? (core += valTWD) : (sat += valTWD));
    return { h, a, price, valTWD };
  });
  const tot = core + sat;
  if (hv.some(x => x.valTWD == null)) {
    html += `<div class="banner warn">有持倉還沒有價格，配置比例先不顯示。</div>`;
  } else if (tot > 0) {
    const cp = core / tot * 100;
    html += `<div class="card"><div class="row between"><h2>配置</h2><span class="muted">總市值約 NT$${fmt(tot, 0)}</span></div>
      <div class="bar" role="img" aria-label="核心 ${cp.toFixed(0)}%，衛星 ${(100 - cp).toFixed(0)}%"><i style="width:${cp}%;background:var(--accent)"></i><i style="width:${100 - cp}%;background:var(--bad)"></i></div>
      <div class="row between"><span>核心 <b class="num">${cp.toFixed(0)}%</b>（目標 ${S.settings.corePct}%）</span><span>衛星 <b class="num">${(100 - cp).toFixed(0)}%</b>（目標 ${100 - S.settings.corePct}%）</span></div>
      ${Math.abs(cp - S.settings.corePct) > 5 ? `<span class="chip near">偏離目標超過 5%，定期定額先買核心</span>` : `<span class="chip ok">在目標範圍內</span>`}</div>`;
  }

  // 持倉卡
  html += `<div class="grid2">` + hv.map(({ h, a, price, valTWD }) => {
    const cost = h.avgCost * h.shares, mv = price == null ? null : price * h.shares;
    const pnl = mv == null ? null : mv - cost;
    const capTWD = S.settings.capitalTWD;
    const expo = valTWD == null ? null : valTWD * (h.leverage || 1) / capTWD * 100;
    const cap = h.type === "核心" ? null : (h.leverage || 1) > 1 ? S.settings.levCapPct : S.settings.stockCapPct;
    const trend = a && !a.manual && a.ma20 ? (a.lastClose >= a.ma20 ? `<span class="chip ok">20 日均線上方</span>` : `<span class="chip bad">20 日均線下方</span>`) : "";
    const myRules = S.rules.filter(r => r.symbol === h.symbol || r.for === h.symbol);
    return `<div class="card">
      <div class="row between"><h2>${esc(h.symbol)} <span class="muted">${esc(h.type)}${h.leverage > 1 ? ` · ${h.leverage} 倍槓桿` : ""}</span></h2><div class="row">${trend}${a && !a.manual ? `<button class="btn ghost sm" data-ta="${esc(h.symbol)}">技術分析</button>` : ""}</div></div>
      <div class="row between"><div><div class="big">${price == null ? "—" : fmt(price)}</div><span class="muted">${!a ? "" : a.manual ? "手動價格" : (a.live ? "盤中" : "收盤 " + a.lastCloseDate) + " · " + pct(a.chg)}</span></div>
        <div style="text-align:right"><div class="num" style="color:${pnl >= 0 ? "var(--good)" : "var(--bad)"};font-weight:600">${pnl == null ? "—" : (pnl >= 0 ? "+" : "−") + fmt(Math.abs(pnl))}</div><span class="muted">${pnl == null ? "" : pct(pnl / cost * 100)}</span></div></div>
      <div class="kv"><div><span>股數／均價</span><b>${h.shares}／${fmt(h.avgCost)}</b></div><div><span>回本價</span><b>${fmt(h.avgCost)}</b></div>
        <div><span>實際曝險</span><b style="color:${cap != null && expo > cap ? "var(--bad)" : "inherit"}">${expo == null ? "—" : expo.toFixed(0) + "%"}</b></div><div><span>上限</span><b>${cap == null ? "核心不設限" : cap + "%"}</b></div></div>
      ${a && !a.manual ? priceChart(a, h, myRules.filter(r => r.symbol === h.symbol)) + indicatorStrip(a) : ""}
      ${a ? ruler(h, a, myRules.filter(r => r.symbol === h.symbol)) : ""}
      ${myRules.length ? `<div class="rules">${myRules.map(r => ruleRow(r, A[r.symbol])).join("")}</div>` : ""}
    </div>`;
  }).join("") + `</div>`;

  // 不屬於持倉的規則（例如用 ORCL 判斷 ORCU）
  const other = S.rules.filter(r => !S.holdings.some(h => h.symbol === r.symbol || r.for === h.symbol));
  if (other.length) html += `<div class="card"><h2>其他規則</h2><div class="rules">${other.map(r => ruleRow(r, A[r.symbol])).join("")}</div></div>`;

  // 事件
  const today = new Date().toISOString().slice(0, 10);
  const ev = S.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  if (ev.length) html += `<div class="card"><h2>接下來的事件</h2>${ev.map(e => `<div class="row between"><span>${esc(e.title)}</span><span class="num muted">${esc(e.date)}（${Math.ceil((new Date(e.date) - new Date(today)) / 864e5)} 天）</span></div>`).join("")}</div>`;
  $("#dashBody").innerHTML = html;
  document.querySelectorAll("[data-ta]").forEach(b => b.onclick = () => { TAV.sym = b.dataset.ta; go("ta"); });
};
function ruleRow(r, a) {
  const st = r.done ? { cls: "off", txt: "已完成" } : ruleStatus(r, a);
  const ref = a ? (r.kind.startsWith("close") ? `收盤 ${fmt(a.lastClose)}` : `現價 ${fmt(a.price)}`) : "";
  return `<div class="rule"><div>${esc(r.symbol)} ${KINDS[r.kind]} ${fmt(+r.value)}<small>${esc(r.action)}${ref ? " · " + ref : ""}</small></div><span class="chip ${st.cls}">${st.txt}</span></div>`;
}

// --- 圖表 ---
// 價格圖：最近 60 根 K 線＋5／10／20 日均線＋均價與規則價位線
function priceChart(a, h, rules) {
  const N = Math.min(60, a.bars.length), off = a.bars.length - N, B = a.bars.slice(off);
  const W = 600, H = 300, ml = 6, mr = 70, mt = 14, mb = 26, pw = W - ml - mr, ph = H - mt - mb;
  let lo = Math.min(...B.map(b => b.l)), hi = Math.max(...B.map(b => b.h));
  const lines = [{ v: +h.avgCost, c: "var(--accent)", t: "均價" }, ...rules.map(r => ({ v: +r.value, c: r.kind.endsWith("Below") ? "var(--bad)" : "var(--good)", t: KINDS[r.kind].slice(-2) }))];
  const span = hi - lo;
  lines.forEach(l => { if (l.v >= lo - span * 0.35 && l.v <= hi + span * 0.35) { lo = Math.min(lo, l.v); hi = Math.max(hi, l.v); } });
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const y = v => mt + (hi - v) / (hi - lo) * ph, bw = pw / N, x = i => ml + bw * i + bw / 2, cw = Math.max(1.5, bw * 0.6);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(h.symbol)} 最近 ${N} 天 K 線與均線">`;
  const step = niceStep(hi - lo);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) s += `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${W - mr + 4}" y="${y(v) + 4}" class="ax">${fmt(v)}</text>`;
  B.forEach((b, i) => {
    const col = b.c >= b.o ? "var(--good)" : "var(--bad)";
    s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(b.h)}" y2="${y(b.l)}" stroke="${col}" stroke-width="1"/><rect x="${x(i) - cw / 2}" y="${y(Math.max(b.o, b.c))}" width="${cw}" height="${Math.max(1, Math.abs(y(b.o) - y(b.c)))}" fill="${col}" rx="1"/>`;
    if (i % 15 === 0) s += `<text x="${x(i)}" y="${H - 4}" class="ax" text-anchor="middle">${b.d.slice(5)}</text>`;
  });
  [[a.s5, "#eb6834"], [a.s10, "#6250d6"], [a.s20, "var(--accent)"]].forEach(([arr, c]) => {
    const pts = arr.slice(off).map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(" ");
    if (pts) s += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.6" opacity=".9"/>`;
  });
  lines.forEach(l => {
    if (l.v < lo) s += `<text x="${W - mr - 4}" y="${H - mb - 4}" class="lb" text-anchor="end" style="fill:${l.c}">↓ ${l.t} ${fmt(l.v)}</text>`;
    else if (l.v > hi) s += `<text x="${W - mr - 4}" y="${mt + 10}" class="lb" text-anchor="end" style="fill:${l.c}">↑ ${l.t} ${fmt(l.v)}</text>`;
    else s += `<line x1="${ml}" x2="${W - mr}" y1="${y(l.v)}" y2="${y(l.v)}" stroke="${l.c}" stroke-dasharray="5 4" stroke-width="1.3"/><text x="${ml + 4}" y="${y(l.v) - 4}" class="lb" style="fill:${l.c}">${l.t} ${fmt(l.v)}</text>`;
  });
  return s + `</svg><div class="legend"><span><i style="background:#eb6834"></i>5 日</span><span><i style="background:#6250d6"></i>10 日</span><span><i style="background:var(--accent)"></i>20 日均線</span></div>`;
}
function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r / 4))); return [1, 2, 5, 10].map(m => m * p).find(t => r / t <= 6); }

// 指標條：RSI 儀表、MACD 柱狀、ATR 占股價
function indicatorStrip(a) {
  const r = a.rsi, rcol = r >= 70 ? "var(--bad)" : r <= 30 ? "var(--good)" : "var(--ink)";
  const rsiG = `<svg viewBox="0 0 200 26" class="mini" role="img" aria-label="RSI ${fmt(r, 1)}"><rect x="0" y="9" width="200" height="8" rx="4" fill="var(--bg)"/><rect x="60" y="9" width="80" height="8" fill="var(--accent-soft)"/>
    <line x1="60" x2="60" y1="5" y2="21" stroke="var(--muted)"/><line x1="140" x2="140" y1="5" y2="21" stroke="var(--muted)"/><circle cx="${r * 2}" cy="13" r="6" fill="${rcol}" stroke="var(--surface)" stroke-width="2"/></svg>`;
  const H = a.histArr.slice(-30), mx = Math.max(...H.map(Math.abs)) || 1, bw = 200 / H.length;
  const macdG = `<svg viewBox="0 0 200 40" class="mini" role="img" aria-label="MACD 柱狀體最近 30 天"><line x1="0" x2="200" y1="20" y2="20" stroke="var(--line)"/>${H.map((v, i) => `<rect x="${i * bw + 1}" y="${v >= 0 ? 20 - v / mx * 18 : 20}" width="${bw - 2}" height="${Math.max(1, Math.abs(v) / mx * 18)}" fill="${v >= 0 ? "var(--good)" : "var(--bad)"}" rx="1"/>`).join("")}</svg>`;
  const ap = Math.min(a.atrPct, 25);
  const atrG = `<svg viewBox="0 0 200 26" class="mini" role="img" aria-label="ATR 占股價 ${a.atrPct.toFixed(0)}%"><rect x="0" y="9" width="200" height="8" rx="4" fill="var(--bg)"/><rect x="0" y="9" width="${ap / 25 * 200}" height="8" rx="4" fill="${a.atrPct > 10 ? "var(--warn)" : "var(--accent)"}"/></svg>`;
  return `<div class="ind">
    <div><div class="row between"><span class="muted">RSI</span><b class="num" style="color:${rcol}">${fmt(r, 1)}</b></div>${rsiG}<span class="muted">30 偏冷 · 70 偏熱</span></div>
    <div><div class="row between"><span class="muted">MACD 柱</span><b class="num" style="color:${a.hist >= 0 ? "var(--good)" : "var(--bad)"}">${fmt(a.hist, 3)}</b></div>${macdG}<span class="muted">${a.hist >= 0 ? "動能偏多" : "動能偏空"}${Math.abs(H[H.length - 1]) > Math.abs(H[H.length - 2] || 0) ? "，擴大中" : "，收斂中"}</span></div>
    <div><div class="row between"><span class="muted">ATR</span><b class="num">${fmt(a.atr)}（${a.atrPct.toFixed(0)}%）</b></div>${atrG}<span class="muted">一天正常波動 ±${fmt(a.atr)}</span></div></div>`;
}

// 價位尺：現價在停損、減碼、回本之間的位置
function ruler(h, a, rules) {
  const marks = [{ v: a.price, t: "現價", c: "var(--ink)", now: true }, { v: +h.avgCost, t: "均價", c: "var(--accent)" },
    ...rules.map(r => ({ v: +r.value, t: KINDS[r.kind].slice(-2), c: r.kind.endsWith("Below") ? "var(--bad)" : "var(--good)" }))];
  if (marks.length < 3) return "";
  const lo = Math.min(...marks.map(m => m.v)), hi = Math.max(...marks.map(m => m.v)), W = 600, pad = 60;
  const x = v => pad + (v - lo) / (hi - lo || 1) * (W - pad * 2);
  // 太接近的價位合併成一個標籤，避免文字重疊
  const groups = [];
  [...marks].sort((p, q) => p.v - q.v).forEach(m => {
    const g = groups[groups.length - 1];
    if (g && x(m.v) - x(g[g.length - 1].v) < 70) g.push(m); else groups.push([m]);
  });
  let s = `<svg viewBox="0 0 ${W} 100" class="chart" role="img" aria-label="現價和規則價位的相對位置"><line x1="${pad}" x2="${W - pad}" y1="50" y2="50" stroke="var(--line)" stroke-width="8" stroke-linecap="round"/>`;
  const stopM = marks.find(m => m.c === "var(--bad)");
  if (stopM) s += `<line x1="${x(stopM.v)}" x2="${x(a.price)}" y1="50" y2="50" stroke="var(--bad-soft)" stroke-width="8"/>`;
  groups.forEach((g, i) => {
    const up = i % 2 === 0, gx = x(g[0].v), anchor = gx < 120 ? "start" : gx > W - 120 ? "end" : "middle", tx = anchor === "start" ? gx - 10 : anchor === "end" ? gx + 10 : gx;
    g.forEach(m => s += `<circle cx="${x(m.v)}" cy="50" r="${m.now ? 10 : 8}" fill="${m.c}" stroke="var(--surface)" stroke-width="3"/>`);
    s += `<text x="${tx}" y="${up ? 26 : 88}" text-anchor="${anchor}" class="lb" style="fill:${g.find(m => m.now) ? "var(--ink)" : g[0].c}">${g.map(m => `${m.t} ${fmt(m.v)}`).join(" · ")}</text>`;
  });
  return `<div><span class="muted">價位尺</span>${s}</svg></div>`;
}

// --- 計算機 ---
VIEWS.calc = function () {
  const st = S.settings;
  const capUSD = (st.capitalTWD / st.fx).toFixed(0);
  $("#main").innerHTML = `<h1>ATR 部位計算機</h1><p class="sub">先決定最多虧多少，再用 ATR 放停損，最後才算股數。</p>
  <div class="stack"><div class="card">
    <div class="row"><label style="flex:1">代號<input id="c-sym" placeholder="例如 ORCU" autocapitalize="characters"></label><button class="btn" id="c-fetch" style="align-self:end">自動抓價格和 ATR</button></div>
    <div class="fields">
      <label>總投資資金（美元）<input id="c-cap" type="number" inputmode="decimal" value="${capUSD}"></label>
      <label>單筆最多虧（%）<input id="c-risk" type="number" inputmode="decimal" step="0.5" value="${st.riskPct}"></label>
      <label>買進價<input id="c-entry" type="number" inputmode="decimal" step="0.01"></label>
      <label>ATR（14 日）<input id="c-atr" type="number" inputmode="decimal" step="0.01"></label>
      <label>停損距離＝幾倍 ATR<input id="c-mult" type="number" inputmode="decimal" step="0.5" value="2"></label>
      <label>槓桿倍數<select id="c-lev"><option value="1">1（一般股票、ETF）</option><option value="2">2</option><option value="3">3</option></select></label>
    </div></div>
    <div class="card" id="c-out"></div></div>`;
  const calc = () => {
    const cap = +$("#c-cap").value, risk = cap * +$("#c-risk").value / 100, e = +$("#c-entry").value, atr = +$("#c-atr").value, mult = +$("#c-mult").value, lev = +$("#c-lev").value;
    if (!(e > 0 && atr > 0)) { $("#c-out").innerHTML = `<p>填入買進價和 ATR，或按「自動抓價格和 ATR」。</p>`; return; }
    const dist = atr * mult, stop = e - dist, byRisk = Math.floor(risk / dist);
    const capPct = lev > 1 ? st.levCapPct : st.stockCapPct, byCap = Math.floor(cap * capPct / 100 / lev / e);
    const sh = Math.min(byRisk, byCap);
    $("#c-out").innerHTML = `<p>最多可以買</p><div class="big">${sh.toLocaleString()} 股</div>
      <div class="kv"><div><span>停損價</span><b>${stop > 0 ? fmt(stop) : "—"}</b></div><div><span>停損距離</span><b>${fmt(dist)}（${(dist / e * 100).toFixed(1)}%）</b></div>
      <div><span>願意虧</span><b>$${fmt(risk)}</b></div><div><span>部位金額</span><b>$${fmt(sh * e)}</b></div></div>
      <div class="rules"><div class="rule"><div>依風險（${$("#c-risk").value}%）<small>願意虧的錢 ÷ 停損距離</small></div><b class="num">${byRisk} 股</b></div>
      <div class="rule"><div>依部位上限（${capPct}%${lev > 1 ? `，曝險 × ${lev}` : ""}）<small>總資金 × 上限 ÷ 槓桿 ÷ 價格</small></div><b class="num">${byCap} 股</b></div></div>
      <p class="muted">取兩者比較小的。${stop <= 0 ? "停損距離比股價還大，這個商品的波動對這筆資金來說太大。" : ""}</p>`;
  };
  ["c-cap", "c-risk", "c-entry", "c-atr", "c-mult", "c-lev"].forEach(id => $("#" + id).addEventListener("input", calc));
  $("#c-fetch").onclick = async () => {
    const s = $("#c-sym").value.trim().toUpperCase(); if (!s) return toast("先輸入代號");
    try { const a = analyze((await series(s)).bars); $("#c-entry").value = a.price.toFixed(2); $("#c-atr").value = a.atr.toFixed(2); calc(); toast(`${s} 現價 ${fmt(a.price)}，ATR ${fmt(a.atr)}`); }
    catch (e) { toast(e.message); }
  };
  const pre = VIEWS.calc.pre;
  if (pre) { $("#c-sym").value = pre.sym; $("#c-entry").value = pre.entry.toFixed(2); $("#c-atr").value = pre.atr.toFixed(2); VIEWS.calc.pre = null; }
  calc();
};

// --- 下單檢查 ---
VIEWS.check = function () {
  const c = S.check;
  $("#main").innerHTML = `<h1>下單前檢查</h1><p class="sub">停損價是第一個欄位。沒有停損價、或還有沒打勾的項目，就不下單。</p>
  <div class="stack"><div class="card"><div class="fields">
    <label>代號<input id="k-sym" value="${esc(c.symbol)}" autocapitalize="characters"></label>
    <label>停損價（必填）<input id="k-stop" type="number" inputmode="decimal" step="0.01" value="${esc(c.stop)}"></label></div></div>
    <div class="card">${CHECKS.map(([k, t, d]) => `<label class="check"><input type="checkbox" data-k="${k}" ${c.items[k] ? "checked" : ""}><span><b>${t}</b><small>${d}</small></span></label>`).join("")}</div>
    <div class="card" id="k-res"></div></div>`;
  const upd = () => {
    c.symbol = $("#k-sym").value.trim().toUpperCase(); c.stop = $("#k-stop").value;
    document.querySelectorAll("[data-k]").forEach(b => c.items[b.dataset.k] = b.checked);
    save();
    const n = CHECKS.filter(([k]) => c.items[k]).length, ok = n === CHECKS.length && +c.stop > 0;
    $("#k-res").innerHTML = `<div class="row between"><h2>${n} / ${CHECKS.length} 項</h2>${ok ? `<span class="chip ok">可以下單</span>` : `<span class="chip bad">還不能下單</span>`}</div>
      ${!(+c.stop > 0) ? `<p>還沒填停損價。</p>` : ""}
      <div class="row"><button class="btn" id="k-j" ${ok ? "" : "disabled"}>建立交易日誌草稿</button><button class="btn ghost" id="k-clear">清除重來</button></div>
      <div class="row"><button class="btn ghost sm" id="k-health">打開公司體檢</button><button class="btn ghost sm" id="k-ta">打開技術分析</button></div>`;
    $("#k-health").onclick = () => go("health");
    $("#k-ta").onclick = () => { if (c.symbol) TAV.sym = c.symbol; go("ta"); };
    $("#k-j").onclick = () => { S.journal.unshift({ id: uid(), date: new Date().toISOString().slice(0, 10), symbol: c.symbol, stop: c.stop, reason: "", source: "", notes: [], exit: {} }); S.check = { symbol: "", stop: "", items: {} }; save(); toast("已建立日誌草稿"); go("journal"); };
    $("#k-clear").onclick = () => { S.check = { symbol: "", stop: "", items: {} }; save(); VIEWS.check(); };
  };
  document.querySelectorAll("#main input").forEach(i => i.addEventListener("input", upd));
  upd();
};

// --- 公司體檢 ---
VIEWS.health = function () {
  $("#main").innerHTML = `<h1>公司體檢</h1><p class="sub">到 StockAnalysis 的 Statistics 分頁查數字，填進來看紅綠燈。</p>
  <div class="stack"><div class="card"><div class="row"><label style="flex:1">代號<input id="h-sym" placeholder="例如 ORCL" autocapitalize="characters"></label><a class="btn ghost" id="h-link" href="https://stockanalysis.com/" target="_blank" rel="noopener" style="align-self:end;text-decoration:none">打開 StockAnalysis</a></div></div>
  <div class="card">${HEALTH.map(([k, t, , where]) => `<div class="row between"><label style="flex:1">${t}<small class="muted">在「${where}」區塊</small><input data-h="${k}" type="number" inputmode="decimal" step="0.01"></label><span class="chip off" id="hc-${k}" style="align-self:end;margin-bottom:8px">—</span></div>`).join("")}
    <label class="check"><input type="checkbox" id="h-conc"><span><b>客戶集中</b><small>單一客戶占營收或訂單很大比例（看年報風險段落、新聞）</small></span></label>
    <label class="check"><input type="checkbox" id="h-rating"><span><b>最近有信評調降或大型增資</b></span></label></div>
  <div class="card" id="h-res"></div></div>`;
  const upd = () => {
    const s = $("#h-sym").value.trim().toLowerCase();
    $("#h-link").href = s ? `https://stockanalysis.com/stocks/${encodeURIComponent(s)}/statistics/` : "https://stockanalysis.com/";
    let red = 0, filled = 0;
    HEALTH.forEach(([k, , good]) => {
      const el = $(`[data-h="${k}"]`), chip = $("#hc-" + k);
      if (el.value === "") { chip.className = "chip off"; chip.textContent = "—"; return; }
      filled++; const g = good(+el.value); if (!g) red++;
      chip.className = "chip " + (g ? "ok" : "bad"); chip.textContent = g ? "健康" : "警訊";
    });
    if ($("#h-conc").checked) red++; if ($("#h-rating").checked) red++;
    $("#h-res").innerHTML = filled ? `<div class="row between"><h2>${red} 個警訊</h2>${red === 0 ? `<span class="chip ok">財務面沒有明顯紅燈</span>` : red <= 2 ? `<span class="chip near">要找出市場在擔心甚麼</span>` : `<span class="chip bad">不適合用槓桿，頂多小部位</span>`}</div><p class="muted">對照：Oracle 在 2026/11 有 自由現金流 −287 億、負債／EBITDA 4.48、淨現金 −1,321 億、客戶集中、信評調降，至少 5 個警訊。</p>` : `<p>填入數字後，這裡會顯示結論。</p>`;
  };
  document.querySelectorAll("#main input").forEach(i => i.addEventListener("input", upd));
  upd();
};

// --- 日誌 ---
VIEWS.journal = function () {
  $("#main").innerHTML = `<h1>交易日誌</h1><p class="sub">進場前填上半部，出場後補下半部。流程評分只看有沒有照規則。</p>
  <div class="row" style="margin-bottom:16px"><button class="btn" id="j-new">新增一筆</button></div>
  <div class="stack">${S.journal.length ? S.journal.map(jCard).join("") : `<div class="banner info">還沒有日誌。可以從「下單檢查」建立草稿。</div>`}</div>`;
  $("#j-new").onclick = () => { S.journal.unshift({ id: uid(), date: new Date().toISOString().slice(0, 10), symbol: "", notes: [], exit: {} }); save(); VIEWS.journal(); };
  document.querySelectorAll("[data-jf]").forEach(el => el.addEventListener("change", () => {
    const e = S.journal.find(x => x.id === el.dataset.id), [a, b] = el.dataset.jf.split(".");
    if (b) { e[a] = e[a] || {}; e[a][b] = el.value; } else e[a] = el.value;
    save(); toast("已儲存");
  }));
  document.querySelectorAll("[data-jn]").forEach(b => b.onclick = () => {
    const e = S.journal.find(x => x.id === b.dataset.jn), t = document.getElementById("jn-" + b.dataset.jn);
    if (!t.value.trim()) return;
    e.notes.push({ date: new Date().toISOString().slice(0, 10), text: t.value.trim(), followed: document.getElementById("jf-" + b.dataset.jn).value });
    save(); VIEWS.journal();
  });
  document.querySelectorAll("[data-jdel]").forEach(b => b.onclick = () => {
    if (b.dataset.armed) { S.journal = S.journal.filter(x => x.id !== b.dataset.jdel); save(); VIEWS.journal(); }
    else { b.dataset.armed = "1"; b.textContent = "再按一次確認刪除"; }
  });
};
function jCard(e) {
  const f = (k, label, type = "text") => `<label>${label}<input data-id="${e.id}" data-jf="${k}" type="${type}" value="${esc(k.includes(".") ? (e[k.split(".")[0]] || {})[k.split(".")[1]] : e[k])}"></label>`;
  const t = (k, label) => `<label>${label}<textarea data-id="${e.id}" data-jf="${k}">${esc(k.includes(".") ? (e[k.split(".")[0]] || {})[k.split(".")[1]] : e[k])}</textarea></label>`;
  return `<details class="card" ${e.symbol ? "" : "open"}><summary>${esc(e.date)}　${esc(e.symbol || "（未命名）")}　${e.exit && e.exit.score ? `<span class="chip ok">流程 ${esc(e.exit.score)} 分</span>` : e.exit && e.exit.date ? "" : `<span class="chip near">持有中</span>`}</summary>
    <h3>進場前</h3><div class="fields">${f("date", "日期", "date")}${f("symbol", "標的")}${f("entry", "進場價", "number")}${f("shares", "股數", "number")}${f("stop", "停損價", "number")}${f("target", "停利／減碼價", "number")}${f("timeExit", "時間出場日", "date")}${f("maxLoss", "最多會虧（$）", "number")}</div>
    ${t("reason", "買進理由（一句話）")}${f("source", "資訊來源")}${t("health", "公司體檢、趨勢、近期事件")}
    <h3>持有中</h3>${(e.notes || []).map(n => `<div class="entry"><span class="muted">${esc(n.date)}　${n.followed === "yes" ? "✅ 照規則" : n.followed === "no" ? "❌ 沒照規則" : ""}</span><span>${esc(n.text)}</span></div>`).join("") || `<p class="muted">還沒有紀錄。</p>`}
    <div class="row"><input id="jn-${e.id}" placeholder="發生甚麼事、我做了甚麼" style="flex:1 1 240px"><select id="jf-${e.id}" style="width:auto"><option value="">—</option><option value="yes">照規則</option><option value="no">沒照規則</option></select><button class="btn sm" data-jn="${e.id}">加一筆</button></div>
    <h3>出場後</h3><div class="fields">${f("exit.date", "出場日期", "date")}${f("exit.price", "出場價", "number")}${f("exit.pnl", "損益（$）", "number")}${f("exit.score", "流程評分 1–5", "number")}</div>
    ${t("exit.followed", "照計畫執行的地方")}${t("exit.notfollowed", "沒照計畫的地方")}${t("exit.lesson", "學到的一件事")}
    <div class="row"><button class="btn danger sm" data-jdel="${e.id}">刪除這筆</button></div></details>`;
}

// --- 設定 ---
VIEWS.settings = function () {
  const st = S.settings;
  $("#main").innerHTML = `<h1>設定</h1><p class="sub">資料只存在這台裝置。換手機或電腦時，用最下面的備份和匯入。</p>
  <div class="stack">
  <div class="card"><h2>行情資料</h2><p>到 twelvedata.com 免費註冊，拿到 API 金鑰後貼在這裡。免費方案每天 800 次，個人使用夠了。</p>
    <label>Twelve Data API 金鑰<input id="s-key" type="password" autocomplete="off" value="${esc(st.apiKey)}"></label></div>
  <div class="card"><h2>雲端同步（Firebase）</h2>
    ${!window.FB || !FB.configured ? `<div class="banner warn">還沒有填入 Firebase 設定（firebase-config.js），所以暫時不能用。</div>`
      : FB.user ? `<p>已登入：<b>${esc(FB.user.email || FB.user.uid)}</b>。資料和 Twelve Data 金鑰會即時同步到其他用同一個帳號登入的裝置，只有你的帳號讀得到。</p>
        <div class="row"><button class="btn ghost" id="f-now">立即同步</button><button class="btn danger sm" id="f-out">登出</button></div>`
      : `<p>每台裝置登入同一個帳號，資料就會自動同步，Twelve Data 金鑰也會一起同步。</p>
        <div class="row"><button class="btn" id="f-google">用 Google 登入</button></div>
        <details><summary>改用 Email 和密碼</summary><div class="fields" style="margin-top:8px"><label>Email<input id="f-email" type="email" autocomplete="username"></label><label>密碼（至少 6 個字）<input id="f-pass" type="password" autocomplete="current-password"></label></div>
        <div class="row"><button class="btn ghost" id="f-in">登入</button><button class="btn ghost" id="f-up">第一次使用：建立帳號</button></div></details>`}
  </div>
  <details class="card"><summary>其他同步方式：GitHub Gist（加密）</summary>
    <p>資料先用你的同步密碼在這台裝置上加密，再存到你自己 GitHub 帳號的 Gist。每台裝置填一次 token 和同一組密碼，之後打開 App 就會自動同步。API 金鑰不會同步。</p>
    <p class="muted">還沒有 token？<a href="https://github.com/settings/tokens/new?scopes=gist&description=%E6%8A%95%E8%B3%87%E5%8A%A9%E6%89%8B%E5%90%8C%E6%AD%A5" target="_blank" rel="noopener">在 GitHub 建立一組只有 gist 權限的 token</a></p>
    <div class="fields">
      <label>GitHub token<input id="y-token" type="password" autocomplete="off" value="${esc(Sync.cfg().token || "")}"></label>
      <label>同步密碼（每台裝置要一樣）<input id="y-pass" type="password" autocomplete="new-password" value="${esc(Sync.cfg().pass || "")}"></label></div>
    <div class="row"><button class="btn" id="y-save">儲存並同步</button><button class="btn ghost" id="y-now" ${Sync.on() ? "" : "disabled"}>立即同步</button><button class="btn danger sm" id="y-off" ${Sync.on() ? "" : "disabled"}>停用這台裝置的同步</button></div>
    <p class="muted">${Sync.on() ? `已啟用。上次同步：${Sync.cfg().last ? new Date(Sync.cfg().last).toLocaleString("zh-TW", { hour12: false }) : "還沒有"}` : "尚未啟用"}。同步密碼忘了，雲端資料就解不開，但這台裝置上的資料還在。</p></details>
  <div class="card"><h2>資金與上限</h2><div class="fields">
    <label>總投資資金（台幣）<input data-s="capitalTWD" type="number" value="${st.capitalTWD}"></label>
    <label>美元匯率<input data-s="fx" type="number" step="0.01" value="${st.fx}"></label>
    <label>單筆最多虧（%）<input data-s="riskPct" type="number" step="0.5" value="${st.riskPct}"></label>
    <label>槓桿商品上限（%）<input data-s="levCapPct" type="number" value="${st.levCapPct}"></label>
    <label>單一個股上限（%）<input data-s="stockCapPct" type="number" value="${st.stockCapPct}"></label>
    <label>核心目標（%）<input data-s="corePct" type="number" value="${st.corePct}"></label></div></div>
  <div class="card"><h2>持倉</h2>
    ${S.holdings.map(h => `<div class="item" data-hid="${h.id}">
      <div class="row between"><b>${esc(h.symbol || "新持倉")}</b><button class="btn danger sm" data-hdel="${h.id}">刪除</button></div>
      <div class="fields f2">
        <label>代號<input data-hf="symbol" value="${esc(h.symbol)}" autocapitalize="characters"></label>
        <label>股數<input data-hf="shares" type="number" inputmode="decimal" value="${h.shares}"></label>
        <label>均價<input data-hf="avgCost" type="number" inputmode="decimal" step="0.01" value="${h.avgCost}"></label>
        <label>幣別<select data-hf="currency"><option ${h.currency === "USD" ? "selected" : ""}>USD</option><option ${h.currency === "TWD" ? "selected" : ""}>TWD</option></select></label>
        <label>類型<select data-hf="type"><option ${h.type === "核心" ? "selected" : ""}>核心</option><option ${h.type === "衛星" ? "selected" : ""}>衛星</option></select></label>
        <label>槓桿倍數<input data-hf="leverage" type="number" inputmode="decimal" value="${h.leverage || 1}"></label>
        <label class="wide">手動價格（抓不到行情時填）<input data-hf="manualPrice" type="number" inputmode="decimal" step="0.01" value="${esc(h.manualPrice || "")}"></label>
      </div></div>`).join("")}
    <div class="row"><button class="btn ghost sm" id="h-add">新增持倉</button><span class="muted">美股用 Twelve Data，台股（例如 0050、2330）自動用 FinMind，不用金鑰。手動價格只在抓不到行情時才會用。</span></div></div>
  <div class="card"><h2>規則</h2>
    ${S.rules.map(r => `<div class="item" data-rid="${r.id}">
      <div class="row between"><label class="row" style="gap:8px"><input data-rf="done" type="checkbox" ${r.done ? "checked" : ""}>已完成</label><button class="btn danger sm" data-rdel="${r.id}">刪除</button></div>
      <div class="fields f2">
        <label>看哪個代號<input data-rf="symbol" value="${esc(r.symbol)}" autocapitalize="characters"></label>
        <label>條件<select data-rf="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${r.kind === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label>價位<input data-rf="value" type="number" inputmode="decimal" step="0.01" value="${r.value}"></label>
        <label class="wide">要做甚麼<textarea data-rf="action" rows="2">${esc(r.action)}</textarea></label>
      </div></div>`).join("")}
    <button class="btn ghost sm" id="r-add" style="width:fit-content">新增規則</button></div>
  <div class="card"><h2>事件</h2>${S.events.map(e => `<div class="item" data-eid="${e.id}">
      <div class="fields f2"><label>日期<input data-ef="date" type="date" value="${esc(e.date)}"></label><label class="wide">事件<input data-ef="title" value="${esc(e.title)}"></label></div>
      <div class="row"><button class="btn danger sm" data-edel="${e.id}">刪除</button></div></div>`).join("")}
    <button class="btn ghost sm" id="e-add" style="width:fit-content">新增事件</button></div>
  <div class="card"><h2>備份與匯入</h2><p>備份不包含 API 金鑰。</p>
    <div class="row"><button class="btn ghost" id="b-copy">複製備份</button><a class="btn ghost" id="b-dl" style="text-decoration:none">下載備份檔</a></div>
    <label>貼上備份資料匯入（會取代目前資料）<textarea id="b-in" placeholder="{ ... }"></textarea></label>
    <div class="row"><button class="btn" id="b-imp">匯入</button><label class="btn ghost" style="display:inline-block">從檔案匯入<input id="b-file" type="file" accept=".json,application/json" style="display:none"></label></div>
    <p class="muted">換裝置時：在舊裝置按「下載備份檔」，存到 iCloud 雲碟、Google 雲端硬碟或 LINE 傳給自己，再到新裝置按「從檔案匯入」。</p></div>
  </div>`;
  $("#s-key").addEventListener("change", e => { st.apiKey = e.target.value.trim(); save(); toast(fbOn() ? "已儲存金鑰，會同步到你的其他裝置" : "已儲存金鑰"); });
  const fbErr = e => toast(({ "auth/popup-closed-by-user": "登入視窗被關掉了", "auth/invalid-credential": "Email 或密碼不對", "auth/email-already-in-use": "這個 Email 已經註冊過，請直接登入", "auth/weak-password": "密碼至少 6 個字", "auth/unauthorized-domain": "這個網址還沒加進 Firebase 的授權網域" })[e.code] || "登入失敗：" + (e.code || e.message));
  const on = (id, fn) => { const el = $("#" + id); if (el) el.onclick = fn; };
  on("f-google", () => FB.signInGoogle().catch(fbErr));
  on("f-in", () => FB.signInEmail($("#f-email").value.trim(), $("#f-pass").value).catch(fbErr));
  on("f-up", () => FB.signUpEmail($("#f-email").value.trim(), $("#f-pass").value).catch(fbErr));
  on("f-out", async () => { await FB.signOut(); toast("已登出，這台裝置的資料保留"); });
  on("f-now", () => fbReconcile());
  $("#y-save").onclick = async () => {
    const token = $("#y-token").value.trim(), pass = $("#y-pass").value;
    if (!token || pass.length < 6) return toast("請填 token，同步密碼至少 6 個字");
    Sync.setCfg({ ...Sync.cfg(), token, pass });
    await syncNow();
    VIEWS.settings();
  };
  $("#y-now").onclick = async () => { await syncNow(); VIEWS.settings(); };
  $("#y-off").onclick = () => { try { localStorage.removeItem(Sync.KEY); } catch (e) {} toast("這台裝置已停用同步，雲端資料保留"); VIEWS.settings(); };
  document.querySelectorAll("[data-s]").forEach(i => i.addEventListener("change", () => { st[i.dataset.s] = +i.value; save(); toast("已儲存"); }));
  const bind = (sel, list, idAttr, fAttr) => document.querySelectorAll(sel).forEach(i => i.addEventListener("change", () => {
    const row = i.closest(`[${idAttr}]`), o = S[list].find(x => x.id === row.getAttribute(idAttr)), k = i.getAttribute(fAttr);
    o[k] = i.type === "checkbox" ? i.checked : i.type === "number" ? (i.value === "" ? "" : +i.value) : (k === "symbol" ? i.value.trim().toUpperCase() : i.value);
    save(); toast("已儲存");
  }));
  bind("[data-hf]", "holdings", "data-hid", "data-hf");
  bind("[data-rf]", "rules", "data-rid", "data-rf");
  bind("[data-ef]", "events", "data-eid", "data-ef");
  const del = (attr, list) => document.querySelectorAll(`[${attr}]`).forEach(b => b.onclick = () => { S[list] = S[list].filter(x => x.id !== b.getAttribute(attr)); save(); VIEWS.settings(); });
  del("data-hdel", "holdings"); del("data-rdel", "rules"); del("data-edel", "events");
  $("#h-add").onclick = () => { S.holdings.push({ id: uid(), symbol: "", shares: 0, avgCost: 0, currency: "USD", type: "衛星", leverage: 1 }); save(); VIEWS.settings(); };
  $("#r-add").onclick = () => { S.rules.push({ id: uid(), symbol: "", kind: "closeBelow", value: 0, action: "", done: false }); save(); VIEWS.settings(); };
  $("#e-add").onclick = () => { S.events.push({ id: uid(), date: new Date().toISOString().slice(0, 10), title: "" }); save(); VIEWS.settings(); };
  const backup = () => { const b = structuredClone(S); b.settings.apiKey = ""; return JSON.stringify(b, null, 2); };
  $("#b-copy").onclick = async () => { try { await navigator.clipboard.writeText(backup()); toast("已複製，可以貼到另一台裝置"); } catch (e) { $("#b-in").value = backup(); toast("無法存取剪貼簿，已放進下方文字框"); } };
  $("#b-dl").href = URL.createObjectURL(new Blob([backup()], { type: "application/json" }));
  $("#b-dl").download = "投資助手備份.json";
  $("#b-file").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    $("#b-in").value = await f.text(); $("#b-imp").click();
  };
  $("#b-imp").onclick = () => {
    try {
      const d = JSON.parse($("#b-in").value);
      if (!d.holdings || !d.settings) throw new Error();
      const key = S.settings.apiKey;
      S = Object.assign(structuredClone(DEFAULT), d); S.settings.apiKey = S.settings.apiKey || key;
      save(); toast("匯入完成"); go("dash");
    } catch (e) { toast("格式不對，請貼上完整的備份資料"); }
  };
};

// ===== 啟動 =====
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
// 請瀏覽器把資料標成永久保存，空間不足或久未使用時不要自動清掉
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(true); });
go("dash");
syncNow(true);
