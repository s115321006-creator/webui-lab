/* ======================================================================
   results.js
   【結果頁】把搜尋結果畫成清單，並觸發地圖繪製。
   ====================================================================== */

/* ----------------------------------------------------------------------
   餐廳結果頁：把搜尋結果畫成清單 + 觸發地圖繪製
   ---------------------------------------------------------------------- */

/** drawResult()：核心函式，整合「搜尋」「範圍防呆」「清單繪製」「地圖繪製」四件事 */
function drawResult() {
  var cat = pick.n, forceVeg = !!pick.veg;
  $('rTitle').textContent = cat + (F.meat === 'veg' && !forceVeg ? '（素食餐廳）' : '') + '・' + locText();

  var all = rawList(cat, forceVeg);                         // 先取得「不考慮距離範圍」的完整清單
  var inRange = all.filter(function (r) { return r.d <= F.rng || r.c; }); // 再篩出「距離範圍內」的店家（自訂餐廳距離未知，一律算在範圍內）

  var banner = '', dispRange = F.rng;

  // ---- 範圍防呆機制 ----
  // 如果「有資料、但目前範圍內一家都沒有」，就自動找出最小需要擴大到多少的範圍，重新篩選一次
  if (!inRange.length && all.length) {
    var real = all.filter(function (r) { return !r.c; }); // 只看有真實距離的店（排除自訂餐廳）
    var minD = real.length ? Math.min.apply(null, real.map(function (r) { return r.d; })) : 0;
    var newRng = niceRange(minD), t = timeEst(newRng);

    banner = '<div class="banner"><b>在原本範圍內未能搜尋到「' + esc(cat) + '」的餐廳</b>已自動將範圍擴大到 ' +
      (newRng >= 1000 ? (newRng / 1000) + ' 公里' : newRng + ' 公尺') + '。' +
      '<div class="times"><span>🚶 步行約 ' + t.walk + ' 分</span><span>🛵 機車約 ' + t.ride + ' 分</span><span>🚗 開車約 ' + t.drive + ' 分</span></div></div>';

    inRange = all.filter(function (r) { return r.d <= newRng || r.c; });
    dispRange = newRng;
  }
  $('rBanner').innerHTML = banner;

  // 完全沒有符合「葷素 + 主食」條件的資料（連擴大範圍都沒用），顯示空狀態、隱藏地圖
  if (!all.length) {
    $('rList').innerHTML = '<div class="empty">目前的篩選條件下，找不到「' + esc(cat) + '」的餐廳資料。<br>試著調整葷素或主食篩選。<br><br>' +
      '<button class="alt" data-go="filter">調整篩選</button> <button data-go="wheel">重轉</button></div>';
    setHidden('mapCol', true);
    setHidden('mapPeekBtn', true);
    return;
  }

  // 排序規則：已收藏的排最前面，其餘依距離由近到遠
  inRange.sort(function (a, b) {
    return ((S.fav.indexOf(b.n) > -1) - (S.fav.indexOf(a.n) > -1)) || (a.d - b.d);
  });

  // 把每一筆餐廳資料轉成一段 HTML，組合起來塞進清單容器
  $('rList').innerHTML = inRange.map(function (r) {
    var f = S.fav.indexOf(r.n) > -1;
    var rm = reviewMeta(r.n); // 取得（或計算）這家店的評分資料，清單上要預覽星等

    // 自訂餐廳沒有距離，不顯示交通時間；一般餐廳才計算並顯示時間
    var tline = r.c ? '' : (function () {
      var t = timeEst(r.d);
      return '<small>🚶 步行約 ' + t.walk + ' 分　🛵 機車約 ' + t.ride + ' 分　🚗 開車約 ' + t.drive + ' 分</small>';
    })();

    return '<div class="item" data-key="' + esc(r.n) + '">' +
      '<div>' +
      '<button type="button" class="nameBtn" data-detail="' + esc(r.n) + '">' + esc(r.n) + '</button>' +
      (r.v ? '<span class="tag v">素食</span>' : '') +
      (r.c ? '<span class="tag">自訂</span>' : '') +
      '<br><span class="stars sm">' + starStr(rm.rating) + '</span> ' +
      '<small class="inline">' + rm.rating + '（約 ' + rm.count + ' 則評論）</small>' +
      '<small>' + (r.c ? '自己新增的店・距離未知' : '範例資料・約 ' + r.d + ' 公尺') + '・點店名看評價與 AI 摘要</small>' +
      tline +
      '</div>' +
      '<div>' +
      '<button class="ib" data-a="fav" data-n="' + esc(r.n) + '" aria-label="收藏">' + (f ? '♥' : '♡') + '</button>' +
      '<button class="ib" data-a="bl" data-n="' + esc(r.n) + '" aria-label="加入黑名單">⊘</button>' +
      '</div></div>';
  }).join('');

  // 把這次的搜尋結果記錄到全域變數，給地圖繪製函式使用
  lastItems = inRange;
  lastRange = dispRange;
  selName = null;

  setHidden('mapCol', false);
  setHidden('mapPeekBtn', false);
  renderMap('mapSvg', 260);     // 畫出桌面版側邊欄的小地圖
  setHidden('mapDetail', true);
}