// 「分析」分頁：大 K 線圖＋可開關的疊加層＋自動判讀結論
const TAV = { sym: "", range: 66, show: { ma: true, lv: true, sw: false, vol: true } };

VIEWS.ta = async function (symArg) {
  if (typeof symArg === "string") TAV.sym = symArg;
  const syms = [...new Set([...S.holdings.filter(h => !h.manualPrice).map(h => h.symbol), ...S.rules.map(r => r.symbol)])].filter(Boolean);
  if (!TAV.sym) TAV.sym = syms[0] || "";
  const m = $("#main");
  m.innerHTML = `<h1>技術分析</h1><p class="sub">用固定規則自動判讀 K 線、支撐壓力和指標。這是學習用的判讀，不是買賣建議。</p>
  <div class="stack">
    <div class="card">
      <div class="row">${syms.map(s => `<button class="btn sm ${s === TAV.sym ? "" : "ghost"}" data-sym="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <div class="row"><input id="t-sym" placeholder="輸入其他代號，例如 NVDA" autocapitalize="characters" style="flex:1 1 160px"><button class="btn" id="t-go">分析</button></div>
    </div>
    <div id="t-body"><div class="card"><p>${TAV.sym ? "載入中…" : "選一個代號開始。"}</p></div></div>
  </div>`;
  m.querySelectorAll("[data-sym]").forEach(b => b.onclick = () => VIEWS.ta(b.dataset.sym));
  $("#t-go").onclick = () => { const s = $("#t-sym").value.trim().toUpperCase(); if (s) VIEWS.ta(s); };
  if (!TAV.sym) return;
  let bars;
  try { bars = (await series(TAV.sym)).bars; } catch (e) { $("#t-body").innerHTML = `<div class="banner warn">${esc(e.message)}</div>`; return; }
  if (bars.length < 30) { $("#t-body").innerHTML = `<div class="banner warn">資料太少，沒辦法分析。</div>`; return; }
  const R = TA.run(bars);
  renderTA(bars, R);
};

function renderTA(bars, R) {
  const sh = TAV.show;
  const rangeBtn = (n, t) => `<button class="btn sm ${TAV.range === n ? "" : "ghost"}" data-range="${n}">${t}</button>`;
  const tog = (k, t) => `<label class="row" style="gap:6px"><input type="checkbox" data-tog="${k}" ${sh[k] ? "checked" : ""}>${t}</label>`;
  const dot = s => s > 0 ? "ok" : s < 0 ? "bad" : "off";
  const sup = R.levels.filter(z => z.role === "支撐").sort((a, b) => b.mid - a.mid).slice(0, 3);
  const res = R.levels.filter(z => z.role === "壓力").sort((a, b) => a.mid - b.mid).slice(0, 3);
  const zoneRow = z => `<div class="rule"><div>${fmt(z.lo)}${z.hi - z.lo > 0.005 ? "–" + fmt(z.hi) : ""}<small>測試 ${z.n} 次${z.flipped ? " · 舊支撐跌破，角色互換" : ""}</small></div><span class="chip ${z.role === "壓力" ? "bad" : "ok"}">${pct(z.dist)}</span></div>`;

  $("#t-body").innerHTML = `<div class="stack">
    <div class="card">
      <div class="row between"><h2>${esc(TAV.sym)} <span class="num">${fmt(R.price)}</span></h2><div class="row">${rangeBtn(22, "1 個月")}${rangeBtn(66, "3 個月")}${rangeBtn(130, "6 個月")}</div></div>
      <div class="row">${tog("ma", "均線")}${tog("lv", "支撐壓力")}${tog("sw", "高低點")}${tog("vol", "成交量")}</div>
      <div class="muted num" id="t-read">把手指或滑鼠移到圖上，看每一天的價格</div>
      <div id="t-chart"></div>
      <div class="legend"><span><i style="background:#eb6834"></i>5 日</span><span><i style="background:#6250d6"></i>10 日</span><span><i style="background:var(--accent)"></i>20 日</span><span><i style="background:var(--good)"></i>支撐</span><span><i style="background:var(--bad)"></i>壓力／缺口</span></div>
    </div>
    <div class="card">
      <div class="row between"><h2>自動判讀</h2><span class="chip ${R.verdict.k}" style="font-size:14px">${R.verdict.t}（${R.score > 0 ? "+" : ""}${R.score.toFixed(1)}）</span></div>
      <div class="rules">${R.sig.map(s => `<div class="rule"><div>${esc(s.t)}${s.d ? `<small>${esc(s.d)}</small>` : ""}</div><span class="chip ${dot(s.s)}">${s.s > 0 ? "偏多" : s.s < 0 ? "偏空" : "中性"}</span></div>`).join("")}</div>
      <p class="muted">每個訊號 +1 偏多、−1 偏空，合計 ≥ +2 算偏多，≤ −2 算偏空。訊號互相矛盾時，以趨勢和 20 日均線為主。</p>
    </div>
    <div class="grid2">
      <div class="card"><h2>上方壓力</h2><div class="rules">${res.length ? res.map(zoneRow).join("") : `<p class="muted">這段期間上方沒有明顯壓力</p>`}
        ${R.gaps.filter(g => g.lo > R.price).map(g => `<div class="rule"><div>缺口 ${fmt(g.lo)}–${fmt(g.hi)}<small>${esc(g.d)} 留下，還沒回補</small></div><span class="chip bad">${pct((g.lo / R.price - 1) * 100)}</span></div>`).join("")}</div></div>
      <div class="card"><h2>下方支撐</h2><div class="rules">${sup.length ? sup.map(zoneRow).join("") : `<p class="muted">已經跌破這段期間的所有低點，下方沒有歷史支撐</p>`}
        ${R.gaps.filter(g => g.hi < R.price).map(g => `<div class="rule"><div>缺口 ${fmt(g.lo)}–${fmt(g.hi)}<small>${esc(g.d)} 留下，還沒回補</small></div><span class="chip ok">${pct((g.hi / R.price - 1) * 100)}</span></div>`).join("")}</div></div>
    </div>
    <div class="card"><h2>可以參考的價位</h2>
      <div class="kv"><div><span>ATR（一天正常波動）</span><b>${fmt(R.atr)}</b></div><div><span>2 倍 ATR 停損</span><b>${fmt(R.stop2)}</b></div>
        <div><span>最近的支撐</span><b>${R.sup ? fmt(R.sup.mid) : "—"}</b></div><div><span>最近的壓力</span><b>${R.res ? fmt(R.res.mid) : "—"}</b></div></div>
      <div class="row"><button class="btn" id="t-calc">用這些數字算股數</button><button class="btn ghost" id="t-ref">打開速查</button></div>
    </div>
  </div>`;
  drawTA(bars, R);
  $("#t-body").querySelectorAll("[data-range]").forEach(b => b.onclick = () => { TAV.range = +b.dataset.range; renderTA(bars, R); });
  $("#t-body").querySelectorAll("[data-tog]").forEach(b => b.onchange = () => { TAV.show[b.dataset.tog] = b.checked; drawTA(bars, R); });
  $("#t-calc").onclick = () => { VIEWS.calc.pre = { sym: TAV.sym, entry: R.price, atr: R.atr }; go("calc"); };
  $("#t-ref").onclick = () => go("ref");
}

function drawTA(bars, R) {
  const sh = TAV.show, N = Math.min(TAV.range, bars.length), off = bars.length - N, B = bars.slice(off);
  const W = 800, ml = 8, mr = 70, mt = 12, ph = 300, vh = sh.vol ? 80 : 0, gap = sh.vol ? 14 : 0, mb = 26, H = mt + ph + gap + vh + mb;
  let lo = Math.min(...B.map(b => b.l)), hi = Math.max(...B.map(b => b.h));
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const pw = W - ml - mr, bw = pw / N, x = i => ml + bw * i + bw / 2, y = v => mt + (hi - v) / (hi - lo) * ph, cw = Math.max(1.5, bw * 0.62);
  const vmax = Math.max(...B.map(b => b.v || 0)) || 1, vy0 = mt + ph + gap + vh;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" id="t-svg" role="img" aria-label="${esc(TAV.sym)} K 線圖">`;
  const step = niceStep(hi - lo);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) s += `<line x1="${ml}" x2="${W - mr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${W - mr + 6}" y="${y(v) + 6}" class="ax">${fmt(v)}</text>`;
  if (sh.lv) {
    // 只畫離現價最近的 3 個壓力和 2 個支撐，標籤太近就省略文字
    const near = [...R.levels.filter(z => z.role === "壓力").sort((a, b) => a.mid - b.mid).slice(0, 3), ...R.levels.filter(z => z.role === "支撐").sort((a, b) => b.mid - a.mid).slice(0, 2)]
      .filter(z => z.mid >= lo && z.mid <= hi).sort((a, b) => b.mid - a.mid);
    let lastY = -99;
    near.forEach(z => {
      const c = z.role === "壓力" ? "var(--bad)" : "var(--good)", h = Math.max(4, y(z.lo) - y(z.hi)), ly = y(z.hi) - 6;
      s += `<rect x="${ml}" y="${y(z.hi) - (h === 4 ? 2 : 0)}" width="${pw}" height="${h}" fill="${c}" opacity=".16"/>`;
      if (ly - lastY >= 30) { s += `<text x="${ml + 6}" y="${ly}" class="lb" style="fill:${c}">${z.role} ${fmt(z.mid)}</text>`; lastY = ly; }
    });
    R.gaps.forEach(g => { if (g.i >= off && g.hi >= lo && g.lo <= hi) s += `<rect x="${x(g.i - off) - bw / 2}" y="${y(g.hi)}" width="${W - mr - x(g.i - off) + bw / 2}" height="${Math.max(2, y(g.lo) - y(g.hi))}" fill="var(--bad)" opacity=".12"/>`; });
  }
  B.forEach((b, i) => {
    const col = b.c >= b.o ? "var(--good)" : "var(--bad)";
    s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(b.h)}" y2="${y(b.l)}" stroke="${col}" stroke-width="1.4"/><rect x="${x(i) - cw / 2}" y="${y(Math.max(b.o, b.c))}" width="${cw}" height="${Math.max(1.2, Math.abs(y(b.o) - y(b.c)))}" fill="${col}" rx="1"/>`;
    if (sh.vol && b.v) s += `<rect x="${x(i) - cw / 2}" y="${vy0 - b.v / vmax * vh}" width="${cw}" height="${b.v / vmax * vh}" fill="${col}" opacity=".45"/>`;
    if (i % Math.ceil(N / 6) === 0) s += `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${b.d.slice(5)}</text>`;
  });
  if (sh.ma) [[5, "#eb6834"], [10, "#6250d6"], [20, "var(--accent)"]].forEach(([n, c]) => {
    const arr = Ind.sma(bars, n).slice(off);
    const pts = arr.map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(" ");
    if (pts) s += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2"/>`;
  });
  if (sh.sw) {
    R.sw.hi.filter(p => p.i >= off).forEach(p => s += `<circle cx="${x(p.i - off)}" cy="${y(p.v) - 8}" r="5" fill="var(--bad)"/>`);
    R.sw.lo.filter(p => p.i >= off).forEach(p => s += `<circle cx="${x(p.i - off)}" cy="${y(p.v) + 8}" r="5" fill="none" stroke="var(--good)" stroke-width="2.5"/>`);
  }
  s += `<line id="t-cross" x1="0" x2="0" y1="${mt}" y2="${vy0}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/></svg>`;
  $("#t-chart").innerHTML = s;
  const svg = $("#t-svg"), cross = $("#t-cross"), read = $("#t-read");
  const move = e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(N - 1, Math.floor((px - ml) / bw))), b = B[i];
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    const prev = bars[off + i - 1], chg = prev ? (b.c / prev.c - 1) * 100 : 0;
    read.textContent = `${b.d}　開 ${fmt(b.o)} 高 ${fmt(b.h)} 低 ${fmt(b.l)} 收 ${fmt(b.c)}（${pct(chg)}）${b.v ? "　量 " + (b.v / 1e6).toFixed(2) + "M" : ""}`;
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
}
