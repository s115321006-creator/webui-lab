/* ======================================================================
   detail.js
   【詳情頁】單一餐廳的評分、Hashtag、AI 摘要、距離時間顯示。
   ====================================================================== */

/* ----------------------------------------------------------------------
   餐廳詳情頁（評分 / Hashtag / AI 摘要 / 距離時間）
   ---------------------------------------------------------------------- */

var curDetail = null; // 目前詳情頁正在顯示哪一家餐廳的完整資料物件

/**
 * openDetail(r)：把詳情頁的各個欄位，用某一家餐廳的資料 r 填滿，然後切換到詳情頁。
 * @param {Object} r - 餐廳資料物件，格式跟 rawList() 回傳的每一筆一樣
 */
function openDetail(r) {
  curDetail = r;
  var rm = reviewMeta(r.n);

  $('dName').textContent = r.n;
  $('dRatingNum').textContent = rm.rating;
  $('dStars').textContent = starStr(rm.rating);
  $('dCount').textContent = '約 ' + rm.count + ' 則評論';
  $('dSub').textContent = (r.v ? '素食・' : '') + (r.c ? '自訂餐廳' : '範例資料');

  // 把每個 Hashtag 標籤轉成 <span class="chip pos/neg"> 的 HTML，塞進詳情頁
  $('dTags').innerHTML = rm.tags.map(function (x) {
    return '<span class="chip ' + (x.pos ? 'pos' : 'neg') + '">#' + esc(x.t) + ' ' + x.n + '</span>';
  }).join('');
  $('dSummary').textContent = rm.summary;

  // 自訂餐廳沒有真實距離資料，所以整張「距離與時間」卡片直接隱藏，不顯示錯誤的數字
  if (r.c) {
    setHidden('dTimeCard', true);
  } else {
    setHidden('dTimeCard', false);
    var t = timeEst(r.d);
    $('dTime').textContent = '約 ' + r.d + ' 公尺・🚶 步行約 ' + t.walk + ' 分　🛵 機車約 ' + t.ride + ' 分　🚗 開車約 ' + t.drive + ' 分';
  }

  $('dMapLink').href = mapUrl(r.n);
  var f = S.fav.indexOf(r.n) > -1;
  $('dFav').textContent = f ? '♥ 已收藏' : '♡ 收藏';

  go('detail');
}

$('dFav').onclick = function () {
  if (!curDetail) return;
  var n = curDetail.n, i = S.fav.indexOf(n);
  i > -1 ? S.fav.splice(i, 1) : S.fav.push(n); // 已收藏就移除、沒收藏就加入（收藏開關邏輯）
  save();
  $('dFav').textContent = i > -1 ? '♡ 收藏' : '♥ 已收藏';
  toast(i > -1 ? '已取消收藏' : '已加入我的最愛');
};
$('dBl').onclick = function () {
  if (!curDetail) return;
  var n = curDetail.n;
  S.bl.push(n);
  var j = S.fav.indexOf(n);
  if (j > -1) S.fav.splice(j, 1); // 加入黑名單的同時，如果原本有收藏也要一併取消
  save();
  toast('已加入黑名單，之後不再出現');
  go('result'); drawResult(); // 回到結果頁並重新整理清單（這家店會從清單上消失）
};

// 店名按鈕（.nameBtn）跟地圖彈出小卡片上的「評價與 AI 摘要」按鈕，都有 data-detail 屬性，
// 一樣用事件委派的方式統一處理點擊，不管這個按鈕是在清單裡還是在地圖彈窗裡都能正常運作。
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-detail]');
  if (!b) return;
  var r = lastItems.find(function (x) { return x.n === b.dataset.detail; });
  if (r) openDetail(r);
});