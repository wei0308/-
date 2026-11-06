// 投資基本功 14 課：重點、ORCU 檢討、互動頁與外部連結、對應的 App 功能
const ART = "https://claude.ai/artifact/";
const COURSE = [
  { n: 1, phase: "打地基", title: "投資前的準備",
    points: ["分清楚投資（公司成長，持有好幾年）、交易（短期波動，要盯盤）、投機（押消息）", "錢的優先順序：緊急預備金 3–6 個月 → 基本保險 → 還高利率債 → 最後才投資", "只用 5 年內不會用到的閒錢", "目標要有目的、時間、金額；時間越短越保守", "風險承受度要同時看能力和意願"],
    orcu: "用交易工具（2 倍槓桿 ETF）做長期持有；出場只有「兩個月後賣」的時間規則，沒有價格規則。",
    go: [["port", "看我的資金設定"]] },
  { n: 2, phase: "打地基", title: "資產類別和複利",
    points: ["報酬越高的資產，跌起來也越兇", "72 法則：翻倍年數 ≈ 72 ÷ 年報酬率，7% 大約 10 年翻倍", "每月 NT$5,000、年報酬 7%：30 年約 610 萬，晚 10 年開始只剩約 260 萬", "虧損不對稱：−40% 要 +66.7%、−50% 要 +100% 才回本", "大起大落本身就會吃掉報酬", "剛出社會：核心 80%（大盤 ETF）＋衛星 20%"],
    orcu: "從 $9.5 跌到 $4.63（−51%）要漲 105% 才回本；虧掉的錢真正的代價是它未來 30 年的複利。" },
  { n: 3, phase: "打地基", title: "市場怎麼運作、怎麼下單",
    points: ["美股交易時間：台灣 22:30–05:00（冬令）、21:30–04:00（夏令）", "限價單保障價格，市價單保障成交", "停損的目的是確定出場：高波動商品用停損市價單，停損限價單跳空時可能不會成交", "OCO／括號單：停利和停損一起掛", "成本：手續費、價差、換匯、ETF 管理費、股息預扣 30%"],
    orcu: "若在 $9.5 掛 −20% 停損：9/14 開盤跳空到 $7.09，停損市價單會在約 −25% 出場；停損限價單當天沒成交，一路到 −50%。",
    go: [["port", "看我的規則"]] },
  { n: 4, phase: "選標的", title: "ETF 和指數化投資",
    points: ["ETF 是一籃子股票：分散、便宜、簡單", "長期來看，大約 85–90% 的主動基金輸給 S&P 500", "看 ETF：費用率、規模、成交量與價差、持股、追蹤方式", "VOO：518 家、0.03%；VT：約 1 萬家、0.06%", "剛出社會、有薪水：定期定額買大盤 ETF 當核心", "名字有 ETF 不代表分散：ORCU 只押 Oracle 一家，費用 0.97%"],
    orcu: "同一段時間 S&P 500 接近歷史高點，ORCU 從 $27.6 跌到 $5。",
    links: [["StockAnalysis：VOO", "https://stockanalysis.com/etf/voo/"], ["StockAnalysis：VT", "https://stockanalysis.com/etf/vt/"]] },
  { n: 5, phase: "選標的", title: "讀懂一家公司",
    points: ["損益表看賺不賺錢，資產負債表看欠多少錢，現金流量表看實際收付", "獲利能調整，現金很難作假：最看重自由現金流", "負債／EBITDA 超過 3 倍算偏高", "本益比便宜通常有原因，要找出市場在擔心甚麼", "StockAnalysis → Statistics 分頁：Cash Flow、Financial Position、Valuation Ratios"],
    orcu: "Oracle：自由現金流 −287 億、負債／EBITDA 4.48、淨現金 −1,321 億；台積電：+449 億、0.23、+1,004 億。這些在 9 月買進前就查得到。",
    go: [["health", "打開公司體檢"]],
    links: [["Oracle 數據", "https://stockanalysis.com/stocks/orcl/statistics/"], ["台積電數據", "https://stockanalysis.com/stocks/tsm/statistics/"], ["SEC EDGAR 年報季報", "https://www.sec.gov/edgar/search/"]] },
  { n: 6, phase: "選標的", title: "總體經濟和重大事件",
    points: ["利率是影響股市最大的因素，高負債的成長股對升息最敏感", "要盯：CPI、非農就業（每月第一個週五）、FOMC、GDP、PCE", "市場比的是預期：財報好不等於股價會漲", "財報多在盤後公布，隔天開盤跳空，停損來不及反應", "事先知道的事件（財報）直接避開；突發事件靠停損和部位大小"],
    orcu: "9/9 到 11/5 整段 −46%；只看 7 個事件日（財報、債市恐慌、募資⋯）合計就是 −58%。",
    links: [["Investing.com 財經日曆", "https://tw.investing.com/economic-calendar/"], ["CME FedWatch 升降息機率", "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"]] },
  { n: 7, phase: "看圖表", title: "K 線和成交量",
    points: ["K 線看開、高、低、收，收盤價最重要", "美股綠漲紅跌，台股紅漲綠跌", "長上影線＝上方賣壓；長下影線＝下方買盤", "成交量是測謊機：放量的訊號比較可信", "先看週線決定方向，再看日線找進出場點"],
    orcu: "9/11 開高走低、收在最低、爆量 1,725 萬股：買進後兩天就出現的出場訊號。",
    art: "N2LZu6fwQpXPxJBqCKCWpt", go: [["ref", "K 線型態速查"], ["ta", "看我的 K 線"]],
    links: [["TradingView", "https://www.tradingview.com/"]] },
  { n: 8, phase: "看圖表", title: "支撐、壓力、趨勢、均線",
    points: ["下降趨勢：高點和低點都越來越低", "支撐和壓力是區間，測試越多次越強", "角色互換：支撐跌破變壓力，壓力突破變支撐", "突破看收盤、要站穩 2–3 天，否則是假突破", "價格在 20 日均線下方、均線往下：不追多、不加碼槓桿商品"],
    orcu: "$6.04–6.21 跌破後三次反彈都卡住；10/28 收 $7.01 站上趨勢線，10/30 跌回 $5.70；11/5 加碼時價格在三條均線下方。",
    art: "AwPf1ayJ8zTUw9YojUq9Au", go: [["ta", "打開技術分析"]] },
  { n: 9, phase: "看圖表", title: "RSI、MACD、ATR",
    points: ["RSI 量力道不是便宜：陰跌時可以一直停在 30–50", "MACD 先看零軸再看交叉，零軸下方的黃金交叉常只是反彈", "ATR 是一天正常會動多少，停損放 1.5–3 倍 ATR", "股數 ＝ 願意虧的錢 ÷ 停損距離"],
    orcu: "ORCU 跌一半，RSI 最低 36.3，從沒低於 30；9/14 MACD 死亡交叉；ATR 從股價的 12% 升到 17%。",
    art: "MqJB6shrrXU1qwU8cyUohH", go: [["calc", "打開計算機"]] },
  { n: 10, phase: "風險管理", title: "部位大小和資產配置",
    points: ["三層防線：資產配置 → 單一部位上限 → 單筆交易風險", "槓桿商品上限總資金 5%，實際曝險要乘上倍數", "第 2 層和第 3 層取比較小的", "持有好幾檔不代表有分散（0050、VOO、ORCU 都押 AI）", "定期定額的錢買比例偏低的那一邊"],
    orcu: "總資金約 NT$86,000：ORCU 合理上限約 15–30 股，實際 237 股；目標核心 80%，實際只有約 46%。",
    go: [["port", "看我的持倉與上限"], ["dash", "看配置比例"]] },
  { n: 11, phase: "風險管理", title: "停損、停利、加碼",
    points: ["停損只能往有利的方向移", "加碼只加在對的方向，絕不在停損價下方加碼", "減碼要分批；賣出不會讓你虧更多，只是降低之後的風險", "移動停損：價格往上，停損跟著往上", "事件前先決定部位"],
    orcu: "規則表：ORCL 收盤跌破 $114.5 出場、安全網 $3.90、$5.12 減碼到 103 股（方案 C）、站穩後停損上移到 $4.63、$7.21 回本。",
    go: [["port", "看我的規則表"]] },
  { n: 12, phase: "風險管理", title: "槓桿商品的陷阱",
    points: ["每天 2 倍，不是整段 2 倍", "單一方向趨勢可能比 2 倍好，來回震盪一定比 2 倍差", "漲 10% 再跌回原點：原股不變，2 倍 ETF 少 1.8%", "其他陷阱：跳空、費用、只押單一個股、清算風險", "長期看好一家公司，就買它的股票"],
    orcu: "9/9 到 11/5：ORCU −53.7%、Oracle 約 −29.4%；回本模擬中，同樣漲幅震盪越大回得越少（有震盪要漲 35%，沒震盪 30%）。",
    art: "LWwxKgMpNBBQEJhx2U3K8U" },
  { n: 13, phase: "實戰", title: "投資計畫書和交易日誌",
    points: ["規則寫下來，讓冷靜的你管住激動的你", "計畫書管整體，交易日誌管每一筆", "下單前填不完表，就不要下單", "用流程評分，不用賺賠評分", "停損價是第一個要填的欄位"],
    orcu: "#001 ORCU 進場流程 1 分；自己寫下的教訓：我當初只有臆測，沒有任何正確的分析。",
    go: [["check", "打開下單檢查"], ["journal", "打開日誌"]] },
  { n: 14, phase: "實戰", title: "投資心理和常見偏誤",
    points: ["從眾和權威：朋友說財報看好", "損失厭惡：不想設停損", "沉沒成本、錨定：盯著自己的成本 $9.5、回本價", "回本效應：虧錢時反而更敢加碼", "處分效應：捨不得實現虧損", "過度自信、確認偏誤", "對策：寫下的規則、自動掛單、24 小時冷靜期、空手測試、交易日誌"],
    orcu: "11/5 大跌當天一次加碼 107 股、其中一筆買在停損價下方；選方案 C 的理由是「減到 5% 虧損太多」。",
    go: [["ref", "十條投資守則"]] }
];
const SITES = [
  ["綜合數據", [["StockAnalysis", "https://stockanalysis.com"], ["Yahoo Finance", "https://finance.yahoo.com"], ["Macrotrends 長期財報", "https://www.macrotrends.net"]]],
  ["分析師目標價", [["StockAnalysis Forecast", "https://stockanalysis.com/stocks/orcl/forecast/"], ["TipRanks", "https://www.tipranks.com"], ["MarketBeat", "https://www.marketbeat.com"]]],
  ["圖表", [["TradingView", "https://www.tradingview.com"], ["Finviz 熱力圖", "https://finviz.com/map.ashx"]]],
  ["經濟數據與事件", [["Investing.com 財經日曆", "https://tw.investing.com/economic-calendar/"], ["CME FedWatch", "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html"], ["Earnings Whispers", "https://www.earningswhispers.com"], ["CNN 恐懼與貪婪", "https://www.cnn.com/markets/fear-and-greed"]]],
  ["官方資料", [["SEC EDGAR", "https://www.sec.gov/edgar/search/"], ["Oracle 投資人關係", "https://www.oracle.com/investor"]]],
  ["台股與中文", [["Goodinfo", "https://goodinfo.tw"], ["公開資訊觀測站", "https://mops.twse.com.tw"], ["鉅亨網", "https://www.cnyes.com"]]]
];

VIEWS.course = function () {
  const q = (VIEWS.course.q || "").trim(), done = S.courseDone || {};
  const list = COURSE.filter(c => !q || [c.title, c.orcu, ...c.points].join(" ").includes(q));
  const n = COURSE.filter(c => done[c.n]).length;
  const phases = [...new Set(list.map(c => c.phase))];
  const link = (t, u) => `<a href="${u}" target="_blank" rel="noopener">${esc(t)} ↗</a>`;
  $("#main").innerHTML = `<h1>投資基本功 14 課</h1><p class="sub">隨時回來複習。每一課都有重點、ORCU 檢討和相關連結，複習完可以打勾。</p>
  <div class="stack">
    <div class="card"><div class="row between"><b>複習進度</b><span class="num">${n} / ${COURSE.length}</span></div>
      <div class="bar"><i style="width:${n / COURSE.length * 100}%;background:var(--accent)"></i></div>
      <label>搜尋課程<input id="c-q" type="search" placeholder="例如：停損、RSI、複利" value="${esc(q)}"></label></div>
    ${phases.map(ph => `<h2>${ph}</h2>` + list.filter(c => c.phase === ph).map(c => `
      <details class="card"${q ? " open" : ""}><summary>第 ${c.n} 課　${c.title} ${done[c.n] ? `<span class="chip ok">已複習</span>` : ""}</summary>
        <h3>重點</h3><ul>${c.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
        <div class="entry"><b style="color:var(--bad)">ORCU 檢討</b><span>${esc(c.orcu)}</span></div>
        ${c.art || c.links ? `<h3>連結</h3><div class="row">${c.art ? link("互動教學頁", ART + c.art) : ""}${(c.links || []).map(([t, u]) => link(t, u)).join("")}</div>` : ""}
        ${c.go ? `<div class="row">${c.go.map(([v, t]) => `<button class="btn ghost sm" data-go="${v}">${t}</button>`).join("")}</div>` : ""}
        <label class="row" style="gap:8px"><input type="checkbox" data-done="${c.n}" ${done[c.n] ? "checked" : ""}>這課已經複習</label>
      </details>`).join("")).join("") || `<div class="banner info">找不到「${esc(q)}」。</div>`}
    <details class="card"><summary>常用網站</summary>${SITES.map(([t, ls]) => `<div><h3>${t}</h3><div class="row">${ls.map(([a, u]) => link(a, u)).join("")}</div></div>`).join("")}</details>
    <p class="muted">互動教學頁存在你的 Claude 帳號裡，要登入 claude.ai 才能打開。簡報和審查表在電腦的「投資」資料夾。</p>
  </div>`;
  const inp = $("#c-q");
  inp.addEventListener("input", () => { VIEWS.course.q = inp.value; const p = inp.selectionStart; go("course"); const x = $("#c-q"); x.focus(); x.setSelectionRange(p, p); });
  // 打勾只更新畫面上的標記和進度，不重畫，展開的課程和捲動位置都保留
  document.querySelectorAll("[data-done]").forEach(b => b.onchange = () => {
    S.courseDone = { ...(S.courseDone || {}), [b.dataset.done]: b.checked }; save();
    const sum = b.closest("details").querySelector("summary"), chip = sum.querySelector(".chip");
    if (b.checked && !chip) sum.insertAdjacentHTML("beforeend", ` <span class="chip ok">已複習</span>`);
    if (!b.checked && chip) chip.remove();
    const k = COURSE.filter(c => S.courseDone[c.n]).length;
    $("#main .num").textContent = `${k} / ${COURSE.length}`;
    $("#main .bar i").style.width = k / COURSE.length * 100 + "%";
  });
  document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
};
