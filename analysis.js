// 自動技術分析：用固定規則讀日 K，產生趨勢、支撐壓力、缺口、K 線型態、量價和指標訊號。
// 這是教學用的規則判讀，不是預測。
const TA = {
  // 擺動高低點：前後 k 根都比它低（高點）或都比它高（低點）
  swings(bars, k = 3) {
    const hi = [], lo = [];
    for (let i = k; i < bars.length - k; i++) {
      const w = bars.slice(i - k, i + k + 1);
      if (bars[i].h === Math.max(...w.map(b => b.h))) hi.push({ i, v: bars[i].h, d: bars[i].d });
      if (bars[i].l === Math.min(...w.map(b => b.l))) lo.push({ i, v: bars[i].l, d: bars[i].d });
    }
    return { hi, lo };
  },

  // 比較最近 20 天和前 20 天的最高、最低點
  trend(bars) {
    if (bars.length < 40) return { k: "flat", t: "資料不足", why: "" };
    const a = bars.slice(-40, -20), b = bars.slice(-20);
    const h1 = Math.max(...a.map(x => x.h)), h2 = Math.max(...b.map(x => x.h)), l1 = Math.min(...a.map(x => x.l)), l2 = Math.min(...b.map(x => x.l));
    const why = `最高點 ${fmt(h1)} → ${fmt(h2)}，最低點 ${fmt(l1)} → ${fmt(l2)}（前 20 天 → 最近 20 天）`;
    if (h2 < h1 && l2 < l1) return { k: "down", t: "下降趨勢", why: why + "，高低點都越來越低" };
    if (h2 > h1 && l2 > l1) return { k: "up", t: "上升趨勢", why: why + "，高低點都越來越高" };
    return { k: "flat", t: "盤整", why: why + "，方向不一致" };
  },

  // 把接近的擺動點合併成區間，計算被測試幾次
  levels(bars, sw, atr, price) {
    const pts = [...sw.hi.map(p => ({ ...p, kind: "hi" })), ...sw.lo.map(p => ({ ...p, kind: "lo" }))];
    // 曾經創 20 天新低、之後又被跌破的低點：跌破的支撐（新高同理）
    for (let i = 20; i < bars.length - 1; i++) {
      const prev = bars.slice(i - 20, i), later = bars.slice(i + 1);
      if (bars[i].l < Math.min(...prev.map(b => b.l)) && later.some(b => b.l < bars[i].l)) pts.push({ i, v: bars[i].l, kind: "lo" });
      if (bars[i].h > Math.max(...prev.map(b => b.h)) && later.some(b => b.h > bars[i].h)) pts.push({ i, v: bars[i].h, kind: "hi" });
    }
    pts.sort((a, b) => a.v - b.v);
    const tol = Math.max(atr * 0.5, price * 0.01), zones = [];
    pts.forEach(p => {
      const z = zones[zones.length - 1];
      if (z && p.v - z.hi <= tol) { z.hi = Math.max(z.hi, p.v); z.lo = Math.min(z.lo, p.v); z.n++; z.kinds.add(p.kind); z.last = Math.max(z.last, p.i); }
      else zones.push({ lo: p.v, hi: p.v, n: 1, kinds: new Set([p.kind]), last: p.i });
    });
    return zones.map(z => {
      const mid = (z.lo + z.hi) / 2, above = mid > price;
      // 曾經是低點（支撐），現在跑到價格上方：角色互換
      const flipped = above && z.kinds.has("lo");
      return { lo: z.lo, hi: z.hi, mid, n: z.n, role: above ? "壓力" : "支撐", flipped, dist: (mid / price - 1) * 100, last: z.last };
    }).sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
  },

  // 還沒被回補的跳空缺口
  gaps(bars, look = 60, minSize = 0) {
    const out = [], start = Math.max(1, bars.length - look);
    for (let i = start; i < bars.length; i++) {
      const p = bars[i - 1], b = bars[i];
      let g = null;
      if (b.h < p.l) g = { lo: b.h, hi: p.l, dir: "down" };
      if (b.l > p.h) g = { lo: p.h, hi: b.l, dir: "up" };
      if (!g || g.hi - g.lo < minSize) continue;
      const after = bars.slice(i + 1);
      const filled = g.dir === "down" ? after.some(x => x.h >= g.hi) : after.some(x => x.l <= g.lo);
      if (!filled) out.push({ ...g, i, d: b.d });
    }
    return out;
  },

  // 最近幾根 K 線的型態
  patterns(bars) {
    const n = bars.length, out = [];
    if (n < 4) return out;
    const avgBody = bars.slice(-20).reduce((s, b) => s + Math.abs(b.c - b.o), 0) / Math.min(20, n);
    const info = b => { const r = b.h - b.l || 1e-9, body = Math.abs(b.c - b.o); return { r, body, up: b.c >= b.o, top: b.h - Math.max(b.o, b.c), bot: Math.min(b.o, b.c) - b.l }; };
    const [a, b, c] = [bars[n - 3], bars[n - 2], bars[n - 1]], A = info(a), B = info(b), Cc = info(c);
    if (Cc.body > Cc.r * 0.6 && Cc.body > avgBody * 1.5) out.push(Cc.up ? { n: "長紅", s: 1, t: "買方強勢" } : { n: "長黑", s: -1, t: "賣方強勢" });
    if (Cc.top > Cc.body * 2 && Cc.top > Cc.r * 0.5) out.push({ n: "長上影線", s: -1, t: "衝高被打回，上方賣壓重" });
    if (Cc.bot > Cc.body * 2 && Cc.bot > Cc.r * 0.5) out.push({ n: "長下影線", s: 1, t: "跌深被拉回，下方有買盤" });
    if (Cc.body < Cc.r * 0.1) out.push({ n: "十字線", s: 0, t: "多空拉鋸，可能轉折" });
    if (!B.up && Cc.up && c.c > b.o && c.o < b.c) out.push({ n: "多頭吞噬", s: 1, t: "紅 K 包住前一根黑 K" });
    if (B.up && !Cc.up && c.o > b.c && c.c < b.o) out.push({ n: "空頭吞噬", s: -1, t: "黑 K 包住前一根紅 K" });
    if (!A.up && A.body > avgBody && B.body < avgBody * 0.5 && Cc.up && c.c > (a.o + a.c) / 2) out.push({ n: "晨星", s: 1, t: "跌勢末端的反轉組合" });
    if (A.up && A.body > avgBody && B.body < avgBody * 0.5 && !Cc.up && c.c < (a.o + a.c) / 2) out.push({ n: "夜星", s: -1, t: "漲勢末端的反轉組合" });
    if (c.h < b.l) out.push({ n: "向下跳空", s: -1, t: "今天整天都在昨天最低價下方" });
    if (c.l > b.h) out.push({ n: "向上跳空", s: 1, t: "今天整天都在昨天最高價上方" });
    return out;
  },

  run(bars) {
    const closes = bars.map(b => b.c), n = bars.length, last = bars[n - 1], price = last.c;
    const atr = Ind.last(Ind.atr(bars)), sw = TA.swings(bars);
    const s5 = Ind.sma(bars, 5), s20 = Ind.sma(bars, 20), rsi = Ind.rsi(bars), m = Ind.macd(bars);
    const trend = TA.trend(bars), levels = TA.levels(bars, sw, atr, price), gaps = TA.gaps(bars, 60, atr * 0.2), pats = TA.patterns(bars);
    const sig = [];
    const add = (s, t, d) => sig.push({ s, t, d });

    add(trend.k === "up" ? 1 : trend.k === "down" ? -1 : 0, "趨勢：" + trend.t, trend.why);

    const ma20 = s20[n - 1], ma20old = s20[n - 6];
    if (ma20 != null) {
      const slope = ma20old ? (ma20 > ma20old ? "往上" : "往下") : "";
      add(price >= ma20 ? 1 : -1, `價格在 20 日均線${price >= ma20 ? "上方" : "下方"}${slope ? "，均線" + slope : ""}`, `收盤 ${fmt(price)}，20 日均線 ${fmt(ma20)}`);
      for (let i = n - 1; i >= Math.max(1, n - 5); i--) {
        if (s5[i] != null && s20[i] != null && s5[i - 1] != null && s20[i - 1] != null) {
          if (s5[i - 1] <= s20[i - 1] && s5[i] > s20[i]) { add(1, "5 日均線黃金交叉 20 日均線", bars[i].d); break; }
          if (s5[i - 1] >= s20[i - 1] && s5[i] < s20[i]) { add(-1, "5 日均線死亡交叉 20 日均線", bars[i].d); break; }
        }
      }
    }

    const r = Ind.last(rsi);
    if (r != null) {
      add(r >= 70 ? -0.5 : r <= 30 ? 0.5 : 0, `RSI ${fmt(r, 1)}：${r >= 70 ? "偏熱" : r <= 30 ? "偏冷（超賣不等於底部）" : r >= 50 ? "偏強" : "偏弱"}`, "");
      // 背離：最近 20 天創新低，但 RSI 比前一個低點高
      const lows = sw.lo.filter(p => p.i >= n - 40);
      if (lows.length >= 2) {
        const p1 = lows[lows.length - 2], p2 = lows[lows.length - 1];
        if (p2.v < p1.v && rsi[p2.i] != null && rsi[p1.i] != null && rsi[p2.i] > rsi[p1.i]) add(1, "RSI 底背離", `價格低點 ${fmt(p1.v)} → ${fmt(p2.v)} 創新低，RSI 卻從 ${fmt(rsi[p1.i], 1)} 升到 ${fmt(rsi[p2.i], 1)}，跌勢力道減弱`);
      }
    }

    const h = m.hist, mv = m.macd[n - 1];
    add(mv >= 0 ? 0.5 : -0.5, `MACD 在零軸${mv >= 0 ? "上方（偏多）" : "下方（偏空）"}`, "");
    for (let i = n - 1; i >= n - 3; i--) {
      if (h[i - 1] <= 0 && h[i] > 0) { add(mv < 0 ? 0.5 : 1, "MACD 黃金交叉" + (mv < 0 ? "（在零軸下方，常只是反彈）" : ""), bars[i].d); break; }
      if (h[i - 1] >= 0 && h[i] < 0) { add(-1, "MACD 死亡交叉", bars[i].d); break; }
    }
    if (Math.abs(h[n - 1]) > Math.abs(h[n - 2])) add(h[n - 1] >= 0 ? 0.5 : -0.5, `動能${h[n - 1] >= 0 ? "偏多" : "偏空"}且擴大中`, `MACD 柱 ${fmt(h[n - 2], 3)} → ${fmt(h[n - 1], 3)}`);

    pats.forEach(p => add(p.s, "K 線：" + p.n, p.t));

    const vols = bars.slice(-21, -1).map(b => b.v).filter(Boolean);
    if (vols.length >= 10 && last.v) {
      const avg = vols.reduce((a, b) => a + b, 0) / vols.length, ratio = last.v / avg, upDay = last.c >= last.o;
      if (ratio >= 1.8) add(upDay ? 1 : -1, `${upDay ? "上漲" : "下跌"}爆量（平常的 ${ratio.toFixed(1)} 倍）`, upDay ? "真的買盤進場" : "恐慌或大戶出貨");
      else if (ratio <= 0.6) add(0, `量縮（平常的 ${ratio.toFixed(1)} 倍）`, upDay ? "反彈無力，要再確認" : "賣壓不重");
    }

    const lowYear = Math.min(...bars.map(b => b.l));
    if (last.l <= lowYear) add(-1, "創下這段期間的新低", `最低 ${fmt(last.l)}`);

    const score = sig.reduce((s, x) => s + x.s, 0);
    const verdict = score >= 2 ? { k: "ok", t: "偏多" } : score <= -2 ? { k: "bad", t: "偏空" } : { k: "near", t: "中性" };
    const sup = levels.filter(z => z.role === "支撐").sort((a, b) => b.mid - a.mid)[0];
    const res = levels.filter(z => z.role === "壓力").sort((a, b) => a.mid - b.mid)[0];
    return { price, atr, sw, trend, levels, gaps, pats, sig, score, verdict, sup, res, stop2: price - 2 * atr };
  }
};
