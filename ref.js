// 技術分析速查：K 線型態、價格圖形、量價、支撐壓力、均線、指標、守則
// K 線用 0–100 的相對價位描述：[開, 高, 低, 收]
const REF = {
  candles: [
    { name: "長紅", k: [[20, 92, 15, 88]], mean: "買方強勢，收在高點附近", use: "出現在突破壓力時最有力", warn: "高檔連續長紅後，要小心過熱" },
    { name: "長黑", k: [[85, 90, 8, 12]], mean: "賣方強勢，收在低點附近", use: "跌破支撐時出現，代表趨勢轉弱", warn: "ORCU 9/11 就是爆量長黑" },
    { name: "長上影線（流星）", k: [[30, 95, 25, 38]], mean: "衝高被打回，上方賣壓重", use: "出現在高檔或壓力位，是轉弱訊號", warn: "要搭配成交量，爆量更可信" },
    { name: "長下影線（錘子）", k: [[70, 75, 5, 62]], mean: "跌深被拉回，下方有買盤", use: "出現在低檔或支撐位，可能止跌", warn: "隔天要收高確認，不能只看一根" },
    { name: "十字線", k: [[50, 85, 15, 51]], mean: "開收幾乎一樣，多空拉鋸", use: "在漲勢或跌勢末端，可能轉折", warn: "盤整中的十字線沒有意義" },
    { name: "多頭吞噬", k: [[55, 58, 38, 40], [35, 75, 32, 70]], mean: "今天的紅 K 完全包住昨天的黑 K", use: "低檔出現，可能由跌轉漲", warn: "成交量放大才算數" },
    { name: "空頭吞噬", k: [[42, 62, 40, 60], [66, 70, 25, 30]], mean: "今天的黑 K 完全包住昨天的紅 K", use: "高檔出現，可能由漲轉跌", warn: "跌破前低才確認" },
    { name: "晨星", k: [[80, 82, 45, 48], [38, 42, 28, 36], [42, 78, 40, 75]], mean: "長黑、小 K、長紅三根組合", use: "跌勢末端的反轉訊號", warn: "第三根要收過第一根實體一半" },
    { name: "夜星", k: [[20, 55, 18, 52], [60, 72, 58, 64], [58, 60, 22, 25]], mean: "長紅、小 K、長黑三根組合", use: "漲勢末端的反轉訊號", warn: "第三根要收破第一根實體一半" },
    { name: "向下跳空缺口", k: [[70, 96, 60, 85], [40, 44, 5, 10]], gap: [44, 60], mean: "價格區間跟前一天沒有重疊", use: "缺口之後會變成壓力", warn: "ORCU 11/2 的缺口 $5.31–5.57" }
  ],
  // 價格圖形：折線的 [x, y]，y 越大越高；line 為頸線
  shapes: [
    { name: "頭肩頂", p: [[0, 30], [15, 60], [25, 45], [45, 85], [60, 45], [75, 62], [88, 42], [100, 20]], line: 45, mean: "三個高點、中間最高", use: "跌破頸線（虛線）確認轉弱，目標約等於頭到頸線的距離", up: false },
    { name: "頭肩底", p: [[0, 70], [15, 40], [25, 55], [45, 15], [60, 55], [75, 38], [88, 58], [100, 80]], line: 55, mean: "三個低點、中間最低", use: "突破頸線確認轉強", up: true },
    { name: "雙頂（M 頭）", p: [[0, 25], [25, 80], [45, 50], [65, 80], [85, 45], [100, 22]], line: 50, mean: "兩次挑戰同一個高點失敗", use: "跌破中間的低點確認", up: false },
    { name: "雙底（W 底）", p: [[0, 75], [25, 20], [45, 50], [65, 20], [85, 55], [100, 78]], line: 50, mean: "兩次測試同一個低點守住", use: "突破中間的高點確認", up: true },
    { name: "下降趨勢", p: [[0, 85], [15, 60], [28, 72], [45, 45], [58, 56], [75, 30], [88, 40], [100, 15]], mean: "高點越來越低，低點也越來越低", use: "反彈是賣點，不是買點。ORCU 9 月到 11 月就是這樣", up: false },
    { name: "收斂三角形", p: [[0, 50], [12, 85], [25, 25], [40, 75], [55, 35], [68, 65], [80, 45], [100, 85]], mean: "高點越來越低、低點越來越高", use: "看突破方向，突破要帶量", up: true },
    { name: "箱型整理", p: [[0, 30], [14, 70], [28, 30], [42, 70], [56, 30], [70, 70], [84, 30], [100, 85]], box: [30, 70], mean: "在固定區間內上下", use: "靠近下緣買、上緣賣；突破箱子才換策略", up: true }
  ],
  volume: [
    ["漲＋量大", "真的買盤進場", "good"], ["漲＋量小", "反彈無力，要再確認", "warn"],
    ["跌＋量大", "恐慌或大戶出貨", "bad"], ["跌＋量小", "自然回落，賣壓不重", "warn"],
    ["長上影線＋量大", "高檔有人大量賣", "bad"], ["長下影線＋量大", "低檔有買盤", "good"]
  ],
  rules: [
    ["支撐和壓力", ["是一個區間，不是一條精確的線", "測試越多次、成交量越大，越強", "支撐跌破變壓力，壓力突破變支撐（角色互換）"]],
    ["突破", ["看收盤，不看盤中", "要站穩 2 到 3 天，隔天跌回就是假突破", "突破要帶量"]],
    ["均線", ["N 日均線＝最近 N 天收盤的平均", "價格在 20 日均線下方、均線往下彎：不追多、不加碼槓桿商品", "短均線往上穿過長均線＝黃金交叉；往下穿過＝死亡交叉"]],
    ["RSI", ["70 以上偏熱、30 以下偏冷", "超賣不等於底部，陰跌時可以一直停在 30–50", "價格創新低、RSI 沒創新低＝背離，跌勢減弱"]],
    ["MACD", ["先看零軸：上方偏多、下方偏空", "零軸下方的黃金交叉常常只是反彈", "柱狀體縮小代表動能減弱"]],
    ["ATR", ["一天正常會動多少", "停損放 1.5–3 倍 ATR，太近會被洗出場", "股數＝願意虧的錢 ÷ 停損距離"]],
    ["週線和日線", ["先看週線決定方向", "再看日線找進出場點", "美股綠漲紅跌，台股紅漲綠跌"]]
  ],
  creed: ["用閒錢投資，緊急預備金另外放", "避免大虧比追求大賺重要", "停損用停損市價單", "核心放大盤 ETF，定期定額", "買之前先看現金流和負債", "財報這種已知事件，等結果再進場", "價格在 20 日均線下方，不追多不加碼", "股數＝願意虧的錢 ÷ 停損距離", "停損只往有利方向移，不在停損下加碼", "市場不知道你的成本"]
};

function refCandles(list, gap) {
  const W = 30 + list.length * 34, sy = t => 104 - t * 0.98;
  let s = `<svg viewBox="0 0 ${W} 110" class="cand" role="img" aria-hidden="true">`;
  if (gap) s += `<rect x="0" y="${sy(gap[1])}" width="${W}" height="${sy(gap[0]) - sy(gap[1])}" fill="var(--bad-soft)"/>`;
  list.forEach(([o, h, l, c], i) => {
    const x = 32 + i * 34, col = c >= o ? "var(--good)" : "var(--bad)";
    s += `<line x1="${x}" x2="${x}" y1="${sy(h)}" y2="${sy(l)}" stroke="${col}" stroke-width="2.5"/><rect x="${x - 9}" y="${sy(Math.max(o, c))}" width="18" height="${Math.max(3, Math.abs(sy(o) - sy(c)))}" fill="${col}" rx="2"/>`;
  });
  return s + "</svg>";
}
function refShape(sh) {
  const x = v => 6 + v * 1.88, y = v => 96 - v * 0.9, col = sh.up ? "var(--good)" : "var(--bad)";
  let s = `<svg viewBox="0 0 200 100" class="shape" role="img" aria-hidden="true">`;
  if (sh.box) s += `<rect x="6" y="${y(sh.box[1])}" width="188" height="${y(sh.box[0]) - y(sh.box[1])}" fill="var(--accent-soft)"/>`;
  if (sh.line != null) s += `<line x1="6" x2="194" y1="${y(sh.line)}" y2="${y(sh.line)}" stroke="var(--muted)" stroke-dasharray="5 4" stroke-width="1.5"/>`;
  s += `<polyline points="${sh.p.map(([a, b]) => `${x(a)},${y(b)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round"/>`;
  return s + "</svg>";
}

VIEWS.ref = function () {
  const q = (VIEWS.ref.q || "").trim();
  const hit = (...t) => !q || t.join(" ").includes(q);
  const cs = REF.candles.filter(c => hit(c.name, c.mean, c.use, c.warn));
  const ss = REF.shapes.filter(c => hit(c.name, c.mean, c.use));
  const vs = REF.volume.filter(v => hit(...v));
  const rs = REF.rules.map(([t, items]) => [t, items.filter(i => hit(t, i))]).filter(([, i]) => i.length);
  const cr = REF.creed.filter(c => hit(c));
  $("#main").innerHTML = `<h1>技術分析速查</h1><p class="sub">K 線型態、價格圖形和規則，下單前快速對照。美股配色：綠漲紅跌。</p>
  <div class="stack">
    <label>搜尋<input id="r-q" type="search" placeholder="例如：吞噬、頸線、RSI" value="${esc(q)}"></label>
    ${cs.length ? `<details class="card" open><summary>K 線型態（${cs.length}）</summary><div class="refgrid">${cs.map(c => `<div class="refcard">${refCandles(c.k, c.gap)}<div><h3>${c.name}</h3><p>${c.mean}</p><p class="muted">怎麼用：${c.use}</p><p class="muted">注意：${c.warn}</p></div></div>`).join("")}</div></details>` : ""}
    ${ss.length ? `<details class="card" open><summary>價格圖形（${ss.length}）</summary><div class="refgrid">${ss.map(c => `<div class="refcard">${refShape(c)}<div><h3>${c.name}</h3><p>${c.mean}</p><p class="muted">${c.use}</p></div></div>`).join("")}</div></details>` : ""}
    ${vs.length ? `<details class="card" open><summary>量價關係</summary><div class="rules">${vs.map(([a, b, c]) => `<div class="rule"><div>${a}</div><span class="chip ${c === "good" ? "ok" : c === "bad" ? "bad" : "near"}">${b}</span></div>`).join("")}</div></details>` : ""}
    ${rs.length ? `<details class="card" open><summary>規則重點</summary>${rs.map(([t, items]) => `<div><h3>${t}</h3><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul></div>`).join("")}</details>` : ""}
    ${cr.length ? `<details class="card"${q ? " open" : ""}><summary>十條投資守則</summary><ol>${cr.map(c => `<li>${c}</li>`).join("")}</ol></details>` : ""}
    ${!cs.length && !ss.length && !vs.length && !rs.length && !cr.length ? `<div class="banner info">找不到「${esc(q)}」，換個關鍵字試試。</div>` : ""}
  </div>`;
  const inp = $("#r-q");
  inp.addEventListener("input", () => { VIEWS.ref.q = inp.value; const pos = inp.selectionStart; go("ref"); const n = $("#r-q"); n.focus(); n.setSelectionRange(pos, pos); });
};
