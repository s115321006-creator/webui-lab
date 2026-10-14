/* ======================================================================
   filter.js
   【篩選】篩選畫面(葷素、主食、範圍)的選項繪製，以及「開始轉」按鈕。
   ====================================================================== */

/* ----------------------------------------------------------------------
   篩選條件畫面
   ---------------------------------------------------------------------- */

/**
 * chips(el, opts, isOn, fn)：產生一排「藥丸狀」篩選按鈕的共用函式。
 * @param {string} el   - 要把按鈕塞進去的容器 id
 * @param {Array}  opts - 選項陣列，每個元素是 [值, 顯示文字]
 * @param {Function} isOn - 傳入某個值，回傳這個選項「目前是否被選中」(true/false)
 * @param {Function} fn   - 使用者點擊某個選項時要執行的動作（通常是更新 F 篩選條件）
 */
function chips(el, opts, isOn, fn) {
  $(el).innerHTML = opts.map(function (o) {
    return '<button class="chip' + (isOn(o[0]) ? ' on' : '') +
      '" data-v="' + o[0] + '" aria-pressed="' + isOn(o[0]) + '">' + o[1] + '</button>';
  }).join('');

  // 一樣用事件委派：監聽整個容器的點擊，而不是每個按鈕都個別綁定
  $(el).onclick = function (e) {
    var b = e.target.closest('.chip');
    if (b) { fn(b.dataset.v); drawFilter(); } // 點擊後重新呼叫 drawFilter() 把畫面重畫一次，反映最新狀態
  };
}

/** drawFilter()：畫出「篩選條件」畫面裡所有的選項（葷素、主食、範圍） */
function drawFilter() {
  chips('fMeat',
    [['all', '都可以'], ['meat', '葷食'], ['veg', '素食']],
    function (v) { return F.meat === v; },
    function (v) { F.meat = v; }
  );
  chips('fStp',
    [['飯', '飯'], ['麵', '麵'], ['其他', '其他']],
    function (v) { return F.stp.indexOf(v) > -1; },
    function (v) {
      // 主食可以「複選」：如果本來有選就移除，沒選就加入（indexOf 找不到會回傳 -1）
      var i = F.stp.indexOf(v);
      i > -1 ? F.stp.splice(i, 1) : F.stp.push(v);
    }
  );
  chips('fRng',
    [['500', '500 公尺'], ['1000', '1 公里'], ['3000', '3 公里'], ['5000', '5 公里']],
    function (v) { return F.rng == v; },
    function (v) { F.rng = +v; } // 前面加一個 + 號，是 JavaScript 把字串轉成數字的簡寫寫法
  );
  setHidden('vegHint', F.meat !== 'veg');
  locNote();
  // 從別的畫面回到篩選頁時，地圖容器剛從隱藏變成顯示，要請 Leaflet 重新量一次大小
  if (F.auto && locMap) setTimeout(function () { locMap.invalidateSize(); }, 50);
}

/**
 * catList()：根據目前的篩選條件（主食、葷素），算出「轉盤上應該出現哪些分類」。
 * 這個函式是整個篩選邏輯的核心。
 */
function catList() {
  var base = CUIS.filter(function (c) {
    // c[2] 是「是否只供素食」的標記（只有「蔬食料理」這一筆是 1）。
    // 如果使用者已經把葷素篩選選成「素食」，那麼其他每個分類本來搜出來的
    // 就已經全部是素食餐廳了，這時候「蔬食料理」這個分類就重複、多餘，要從轉盤排除。
    if (c[2] && F.meat === 'veg') return false;

    // c[1] 是這個分類的主食標籤（例如 "飯,麵,其他"），拆成陣列後，
    // 用 .some() 檢查「這個分類支援的主食」跟「使用者勾選的主食」有沒有任何一個重疊，
    // 有重疊才留下來，這樣「只勾麵」時，完全沒有麵食選項的分類就不會出現在轉盤上。
    var tags = c[1].split(',');
    return tags.some(function (t) { return F.stp.indexOf(t) > -1; });
  }).map(function (c) { return { n: c[0], veg: c[2] }; });

  // 使用者在「自製轉盤」裡新增的自訂類型，也要一起併入轉盤
  var custom = S.cust.map(function (n) { return { n: n, veg: 0 }; });
  return base.concat(custom);
}

$('start').onclick = function () {
  // 送出前的三個檢查，任何一個不符合就提示使用者、不讓他進入轉盤畫面
  if (!F.auto && !(F.city && F.dist)) { toast('請選擇縣市與區，或使用自動定位'); return; }
  if (!F.stp.length) { toast('請至少選一種主食'); return; }
  if (catList().length < 2) { toast('符合條件的類型太少，請放寬條件'); return; }
  go('wheel');
};