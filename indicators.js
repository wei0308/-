// 技術指標：輸入日 K（由舊到新），每根 {d, o, h, l, c}
const Ind = {
  sma(bars, n) {
    const out = bars.map(() => null);
    for (let i = n - 1; i < bars.length; i++) {
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += bars[j].c;
      out[i] = s / n;
    }
    return out;
  },
  // Wilder 平滑 RSI
  rsi(bars, n = 14) {
    const out = bars.map(() => null);
    if (bars.length <= n) return out;
    let g = 0, l = 0;
    for (let i = 1; i <= n; i++) {
      const d = bars[i].c - bars[i - 1].c;
      d > 0 ? (g += d) : (l -= d);
    }
    g /= n; l /= n;
    out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    for (let i = n + 1; i < bars.length; i++) {
      const d = bars[i].c - bars[i - 1].c;
      g = (g * (n - 1) + Math.max(d, 0)) / n;
      l = (l * (n - 1) + Math.max(-d, 0)) / n;
      out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    return out;
  },
  // Wilder 平滑 ATR
  atr(bars, n = 14) {
    const out = bars.map(() => null);
    if (bars.length < n) return out;
    const tr = bars.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)));
    let a = 0;
    for (let i = 0; i < n; i++) a += tr[i];
    a /= n;
    out[n - 1] = a;
    for (let i = n; i < bars.length; i++) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
    return out;
  },
  ema(vals, n) {
    const k = 2 / (n + 1), out = [vals[0]];
    for (let i = 1; i < vals.length; i++) out.push(vals[i] * k + out[i - 1] * (1 - k));
    return out;
  },
  macd(bars) {
    const c = bars.map(b => b.c), e12 = Ind.ema(c, 12), e26 = Ind.ema(c, 26);
    const m = c.map((_, i) => e12[i] - e26[i]), s = Ind.ema(m, 9);
    return { macd: m, signal: s, hist: m.map((v, i) => v - s[i]) };
  },
  last(arr) { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null; }
};
