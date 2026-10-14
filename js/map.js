/* ======================================================================
   map.js
   【示意地圖】結果頁的 SVG 相對位置地圖、地圖小卡片、手機全螢幕地圖。
   ====================================================================== */

/* ----------------------------------------------------------------------
   相對位置示意地圖（用 SVG 畫出「依距離估算」的示意圖，不是真實地理座標）
   ---------------------------------------------------------------------- */

/** markerColor(r)：決定地圖上這個標記點要用什麼顏色（收藏＞自訂＞一般，顏色對應圖例） */
function markerColor(r) {
  if (S.fav.indexOf(r.n) > -1) return 'var(--pur)';
  if (r.c) return 'var(--red)';
  return 'var(--grn)';
}

/**
 * renderMap(svgId, size)：把 lastItems（目前的搜尋結果）畫成一張示意地圖。
 * 這個函式會被呼叫兩次：一次畫桌面版的小地圖（size=260），一次畫手機全螢幕版的大地圖（size=320），
 * 兩個版本看到的資料完全一樣，只是畫布大小不同。
 */
function renderMap(svgId, size) {
  var svg = $(svgId);
  if (!svg) return;
  var c = size / 2, maxR = size * 0.42; // c：地圖中心點座標；maxR：標記點能擺放的最大半徑

  // 畫三個同心圓當作「距離刻度參考線」
  var h = '<circle cx="' + c + '" cy="' + c + '" r="' + maxR + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  h += '<circle cx="' + c + '" cy="' + c + '" r="' + (maxR * 0.6) + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  h += '<circle cx="' + c + '" cy="' + c + '" r="' + (maxR * 0.25) + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
  h += '<text x="' + c + '" y="' + (c - maxR - 6) + '" text-anchor="middle" font-size="10" fill="var(--sub)">約 ' +
    (lastRange >= 1000 ? (lastRange / 1000) + ' 公里' : lastRange + ' 公尺') + '</text>';

  var n = lastItems.length;
  var real = lastItems.filter(function (r) { return !r.c; });
  // maxD：目前清單中「有真實距離」的店家，最遠的那一筆距離，用來把距離換算成畫面上的半徑比例
  var maxD = Math.max.apply(null, real.map(function (r) { return r.d; }).concat([lastRange]));

  lastItems.forEach(function (r, i) {
    // 角度：平均分配一圈（360/n），再用 hashStr() 加一點點「看起來隨機、但其實固定」的偏移，
    // 這樣同一家店每次重畫地圖，位置都不會亂跳動。
    var ang = (360 / n) * i + (hashStr(r.n) % 21 - 10);

    // 半徑：自訂餐廳因為沒有真實距離，固定擺在內圈附近；一般餐廳則依照「距離佔最遠距離的比例」決定半徑
    var rad = r.c
      ? (maxR * 0.22 + (hashStr(r.n) % 20))
      : (maxR * 0.28 + (r.d / maxD) * maxR * 0.68);

    var p = pt(rad, ang), x = c + p[0], y = c + p[1];
    var sel = selName === r.n; // 這個點是否為目前被選取的狀態

    h += '<g class="pin' + (sel ? ' sel' : '') + '" data-n="' + esc(r.n) + '" tabindex="0" role="button" aria-label="' + esc(r.n) + '">' +
      '<circle class="dot" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (sel ? 9 : 7) +
      '" fill="' + markerColor(r) + '" stroke="#fff" stroke-width="1.5"/></g>';
  });

  // 最後畫「你的位置／搜尋中心」標記，放在最後面是為了讓它疊在所有餐廳標記的「最上層」，比較顯眼
  h += '<circle class="originPulse" cx="' + c + '" cy="' + c + '" r="8" fill="none" stroke="var(--blu)" stroke-width="2"/>';
  h += '<circle cx="' + c + '" cy="' + c + '" r="7" fill="var(--blu)" stroke="#fff" stroke-width="2"/>';
  h += '<text x="' + c + '" y="' + (c + maxR + 16) + '" text-anchor="middle" font-size="10" fill="var(--ink)" font-weight="700">' +
    (F.auto ? '你的位置' : esc(locText())) + '</text>';

  svg.innerHTML = h;

  // 地圖上的點擊事件：一樣用事件委派，點到任何一個 .pin 群組，就取出它的店名去呼叫 selectPin()
  svg.onclick = function (e) {
    var g = e.target.closest('.pin');
    if (!g) return;
    selectPin(g.dataset.n);
  };
}

/**
 * selectPin(name)：使用者點選地圖上某個標記後執行——
 * 重新畫地圖（讓被選中的點放大強調）、顯示詳情小卡片、並讓清單裡對應的項目同步反白。
 */
function selectPin(name) {
  selName = name;
  renderMap('mapSvg', 260);
  renderMap('mapSvgFull', 320); // 兩個地圖（桌面版、手機全螢幕版）都要同步重畫

  var r = lastItems.find(function (x) { return x.n === name; });
  if (!r) return;

  var f = S.fav.indexOf(r.n) > -1;
  var tstr = r.c ? '' : (function () {
    var t = timeEst(r.d);
    return '　🚶 ' + t.walk + '分　🛵 ' + t.ride + '分　🚗 ' + t.drive + '分';
  })();
  var rm = reviewMeta(r.n);

  // 組出小卡片內容：店名、星等、距離時間、以及「查看評價」「開地圖」「收藏」「黑名單」四個快速動作
  var html = '<b>' + esc(r.n) + '</b>' +
    (r.v ? '<span class="tag v">素食</span>' : '') +
    (r.c ? '<span class="tag">自訂</span>' : '') +
    ' <span class="stars sm">' + starStr(rm.rating) + '</span> ' + rm.rating +
    '<br><span class="muted">' + (r.c ? '自己新增的店・距離未知' : '約 ' + r.d + ' 公尺') + tstr + '</span>' +
    '<div class="drow">' +
    '<button class="alt" data-detail="' + esc(r.n) + '">📝 評價與 AI 摘要</button>' +
    '<a class="btn alt btnSm" href="' + mapUrl(r.n) + '" target="_blank" rel="noopener">開 Google Map</a>' +
    '<button class="alt" data-a="fav" data-n="' + esc(r.n) + '">' + (f ? '♥ 已收藏' : '♡ 收藏') + '</button>' +
    '<button class="alt" data-a="bl" data-n="' + esc(r.n) + '">⊘ 黑名單</button>' +
    '</div>';

  // 桌面版、手機全螢幕版各有自己的詳情小卡片容器，內容完全一樣、同步更新
  $('mapDetail').innerHTML = html; setHidden('mapDetail', false);
  $('mapDetailFull').innerHTML = html; setHidden('mapDetailFull', false);

  // 讓清單裡對應的那一筆資料同步反白、並自動捲動到看得見的位置
  var li = document.querySelector('.item[data-key="' + CSS.escape(name) + '"]');
  if (li) {
    document.querySelectorAll('.item.sel').forEach(function (x) { x.classList.remove('sel'); });
    li.classList.add('sel');
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// 手機版「查看地圖」按鈕：點擊後畫出全螢幕地圖，並打開遮罩層
$('mapPeekBtn').onclick = function () {
  renderMap('mapSvgFull', 320);
  setHidden('mapDetailFull', !selName);
  $('mapOverlay').classList.add('on');
};
// 全螢幕地圖的關閉按鈕
$('closeMap').onclick = function () { $('mapOverlay').classList.remove('on'); };