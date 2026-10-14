/* ======================================================================
   lists.js
   【我的最愛／黑名單】兩個清單畫面，以及全站共用的「收藏／黑名單」按鈕處理。
   ====================================================================== */

/* ----------------------------------------------------------------------
   我的最愛 ／ 黑名單 畫面
   ---------------------------------------------------------------------- */

/**
 * listOf(arr, act, lbl, ph)：「我的最愛」跟「黑名單」畫面共用的清單產生函式。
 * @param {Array} arr - 要顯示的店名陣列（S.fav 或 S.bl）
 * @param {string} act - 這個清單的動作代號（'fav' 或 'bl'），給按鈕的 data-act 用
 * @param {string} lbl - 按鈕文字（例如「移除」「取消」）
 * @param {string} ph  - 清單是空的時候，要顯示的提示文字（placeholder）
 */
function listOf(arr, act, lbl, ph) {
  return arr.length
    ? arr.map(function (n) {
        return '<div class="item"><a href="' + mapUrl(n) + '" target="_blank" rel="noopener" class="itemLink">' + esc(n) + '</a>' +
          '<button class="alt btnXs" data-x="' + esc(n) + '" data-act="' + act + '">' + lbl + '</button></div>';
      }).join('')
    : '<div class="empty">' + ph + '</div>';
}
function drawFavs() { $('favL').innerHTML = listOf(S.fav, 'fav', '移除', '還沒有收藏。在餐廳結果按 ♡ 就會出現在這裡。'); }
function drawBl() { $('blL').innerHTML = listOf(S.bl, 'bl', '取消', '黑名單是空的。在餐廳結果按 ⊘ 就不會再轉到這家。'); }

document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-x]');
  if (!b) return;
  var n = b.dataset.x, a = b.dataset.act;
  var l = a === 'fav' ? S.fav : S.bl;
  l.splice(l.indexOf(n), 1); // 從對應的陣列裡移除這個店名
  save();
  a === 'fav' ? drawFavs() : drawBl(); // 重新畫一次清單，反映移除後的結果
});

// 收藏／黑名單按鈕的事件委派（清單項目、地圖小卡片、詳情頁都共用這一組按鈕邏輯，
// 透過 data-a="fav"/"bl" 跟 data-n="店名" 這兩個屬性，統一在這裡處理）
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-a]');
  if (!b) return;
  var n = b.dataset.n;
  if (b.dataset.a === 'fav') {
    var i = S.fav.indexOf(n);
    i > -1 ? S.fav.splice(i, 1) : S.fav.push(n);
    toast(i > -1 ? '已取消收藏' : '已加入我的最愛');
  } else {
    S.bl.push(n);
    var j = S.fav.indexOf(n);
    if (j > -1) S.fav.splice(j, 1);
    toast('已加入黑名單，之後不再出現');
  }
  save();
  // 如果目前正停留在結果頁，收藏/黑名單狀態改變後要重新整理清單（黑名單的店要立刻消失）
  if ($('result').classList.contains('on')) drawResult();
  // 如果剛剛操作的正是地圖上目前選取的那個點，也要重新整理一次小卡片內容（按鈕文字要更新）
  if (selName === n) { selectPin(n); }
});