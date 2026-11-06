// 投資助手背景程式：由 GitHub Actions 定時執行
//   close   美股收盤後：檢查規則、傳持倉摘要、自動更新財報日期
//   evening 台灣晚上 8 點：提醒今天和明天的事件
// 本機試跑（不連 Firebase、不推播）：DRY_STATE=我的資料.json node notify.mjs close
import fs from "node:fs";

const MODE = process.argv[2] || "close";
const DRY = process.env.DRY_STATE;
const KINDS = { closeBelow: "收盤跌破", closeAbove: "收盤站上", priceBelow: "價格跌破", priceAbove: "價格漲到" };
const fmt = (v, d = 2) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = v => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
const isTW = s => /^\d{4,6}[A-Z]?$/.test(s);
const twDate = (offsetDays = 0) => new Date(Date.now() + 8 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);

async function bars(symbol, apiKey) {
  if (isTW(symbol)) {
    const start = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
    const j = await (await fetch(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${symbol}&start_date=${start}`)).json();
    if (!j.data || !j.data.length) throw new Error("FinMind 沒有資料");
    return j.data.map(d => ({ d: d.date, c: d.close }));
  }
  if (!apiKey) throw new Error("沒有 Twelve Data 金鑰");
  const j = await (await fetch(`https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=5&apikey=${encodeURIComponent(apiKey)}`)).json();
  if (!j.values) throw new Error(j.message || "Twelve Data 沒有資料");
  return j.values.map(v => ({ d: v.datetime, c: +v.close })).reverse();
}

async function nextEarnings(symbol) {
  const key = process.env.FINNHUB_KEY;
  if (!key || isTW(symbol)) return null;
  const from = twDate(), to = twDate(120);
  const j = await (await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(symbol)}&token=${key}`)).json();
  const list = (j.earningsCalendar || []).filter(e => e.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  return list[0] || null;
}

async function process1(state, notified) {
  const msgs = [];
  let changed = false;
  if (MODE === "close") {
    const syms = [...new Set([...state.holdings.map(h => h.symbol), ...state.rules.map(r => r.symbol)])].filter(Boolean);
    const P = {};
    for (const s of syms) {
      try { const b = await bars(s, state.settings.apiKey); P[s] = { c: b[b.length - 1].c, prev: b[b.length - 2]?.c, d: b[b.length - 1].d }; }
      catch (e) { console.log(`無法取得 ${s} 的行情：${e.message}`); }
    }
    // 規則：狀態有變化才通知（正常 → 接近 → 觸發）
    for (const r of state.rules) {
      const p = P[r.symbol];
      if (!p || r.done) continue;
      const v = +r.value, below = r.kind.endsWith("Below");
      const hit = below ? p.c < v : p.c >= v, dist = (v / p.c - 1) * 100;
      const st = hit ? "hit" : Math.abs(dist) <= 3 ? "near" : "ok", key = "rule-" + r.id;
      if (st !== (notified[key] || "ok")) {
        if (st === "hit") msgs.push({ title: `⚠️ 規則觸發：${r.symbol} ${KINDS[r.kind]} ${fmt(v)}`, body: `收盤 ${fmt(p.c)}。${r.action}`, tag: key });
        if (st === "near") msgs.push({ title: `接近規則價位：${r.symbol}`, body: `收盤 ${fmt(p.c)}，離 ${KINDS[r.kind]} ${fmt(v)} 只差 ${pct(dist)}。${r.action}`, tag: key });
      }
      notified[key] = st;
    }
    // 持倉摘要
    if (state.settings.dailySummary !== false && state.holdings.length) {
      const lines = state.holdings.filter(h => P[h.symbol]).map(h => {
        const p = P[h.symbol], pnl = (p.c - h.avgCost) * h.shares, chg = p.prev ? (p.c / p.prev - 1) * 100 : 0;
        const cur = h.currency === "TWD" || isTW(h.symbol) ? "NT$" : "$";
        return `${h.symbol} ${fmt(p.c)}（${pct(chg)}）損益 ${pnl >= 0 ? "+" : "−"}${cur}${fmt(Math.abs(pnl), 0)}`;
      });
      if (lines.length) msgs.push({ title: "收盤摘要", body: lines.join("\n"), tag: "summary" });
    }
    // 自動更新財報日期
    for (const s of syms.filter(s => !isTW(s))) {
      try {
        const e = await nextEarnings(s);
        if (!e) continue;
        const id = "auto-earn-" + s, when = e.hour === "amc" ? "盤後" : e.hour === "bmo" ? "盤前" : "";
        const title = `${s} 財報${when ? "（" + when + "）" : ""}（自動更新）`;
        const ev = state.events.find(x => x.id === id);
        if (!ev || ev.date !== e.date) {
          if (ev) { ev.date = e.date; ev.title = title; } else state.events.push({ id, date: e.date, title });
          changed = true;
          msgs.push({ title: `📅 ${s} 財報日期${ev ? "更新" : "公布"}`, body: `${e.date}${when ? " " + when : ""}，已加進事件`, tag: id });
        }
      } catch (err) { console.log(`無法取得 ${s} 的財報日期：${err.message}`); }
    }
  }
  if (MODE === "evening") {
    const today = twDate(), tomorrow = twDate(1);
    for (const e of state.events) {
      const k = e.date === today ? "今天" : e.date === tomorrow ? "明天" : null;
      if (!k) continue;
      const key = `ev-${e.id}-${k}`;
      if (notified[key]) continue;
      msgs.push({ title: `${k}：${e.title}`, body: k === "明天" ? "記得先看規則表，事件前要不要調整部位" : "今晚留意市場波動", tag: key });
      notified[key] = e.date;
    }
  }
  return { msgs, changed };
}

if (DRY) {
  const state = JSON.parse(fs.readFileSync(DRY, "utf8"));
  const { msgs, changed } = await process1(state, {});
  console.log(JSON.stringify({ mode: MODE, changed, msgs }, null, 2));
  process.exit(0);
}

const { default: admin } = await import("firebase-admin");
const { default: webpush } = await import("web-push");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
webpush.setVapidDetails("https://wei0308.github.io/-/", process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
const db = admin.firestore();

const users = await db.collection("users").get();
for (const doc of users.docs) {
  const data = doc.data();
  if (!data.json) continue;
  const state = JSON.parse(data.json), notified = data.notified || {}, subs = data.push || [];
  const { msgs, changed } = await process1(state, notified);
  const update = { notified };
  if (changed) { state.updatedAt = Date.now(); update.json = JSON.stringify(state); update.updatedAt = state.updatedAt; }
  // 送推播；裝置取消訂閱（404／410）就移除
  const dead = new Set();
  for (const m of msgs) for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(m), { TTL: 6 * 3600 }); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) dead.add(s.endpoint); else console.log("推播失敗", e.statusCode || e.message); }
  }
  if (dead.size) update.push = subs.filter(s => !dead.has(s.endpoint));
  await doc.ref.set(update, { merge: true });
  console.log(`${MODE}：${msgs.length} 則通知，${subs.length} 台裝置，移除 ${dead.size} 個失效訂閱${changed ? "，事件已更新" : ""}`);
}
