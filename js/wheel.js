/* ======================================================================
   wheel.js
   【轉盤】SVG 轉盤的繪製、旋轉動畫、「轉！」與「喜歡」按鈕。
   ====================================================================== */

/* ----------------------------------------------------------------------
   轉盤（SVG 動態繪製 + 文字直式排版 + 旋轉動畫）
   ---------------------------------------------------------------------- */

/**
 * pt(r, a)：把「極座標（半徑 r、角度 a）」換算成「直角座標（x, y）」。
 * 這是畫圓形相關圖形（轉盤、地圖）時最基礎的數學工具函式。
 * SVG 的角度習慣：0 度在正上方，順時針增加，所以公式用 sin 求 x、用 -cos 求 y。
 * @param {number} r - 半徑（離圓心多遠）
 * @param {number} a - 角度（單位：度）
 * @returns {[number, number]} [x, y] 座標
 */
function pt(r, a) {
  var t = a * Math.PI / 180; // 角度轉成弧度（JavaScript 的三角函數都是吃弧度）
  return [r * Math.sin(t), -r * Math.cos(t)];
}

/**
 * hashStr(s)：把一段文字「雜湊」成一個固定的數字。
 * 重點特性：同一個字串，不管呼叫幾次，算出來的數字都一樣（這叫做「決定性」）。
 * 我們利用這個特性，讓「星等評分」「地圖上的標記角度」這些原本要隨機產生的東西，
 * 改成用「店名」去算出一個固定的假亂數，這樣同一家店每次重新整理頁面看到的
 * 評分、地圖位置都不會變來變去，體驗比較一致。
 */
function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  // |0 的作用是強制轉成 32 位元整數，避免數字無限變大、也讓結果可能變成負數，
  // 所以最後回傳時用 Math.abs() 取絕對值，保證是正數。
  return Math.abs(h);
}

/**
 * build(g, list)：把轉盤的扇形色塊 + 分類文字，畫進指定的 SVG <g> 群組裡。
 * 文字採用「直式排版」：每個字一行、由上往下堆疊置中，
 * 不管轉到哪個角度文字都維持正立、不會倒過來，這是使用者提出的需求。
 * @param {SVGElement} g    - 要畫進去的 <g> 元素
 * @param {Array} list      - 分類清單，每個元素是 {n: 分類名稱, veg: 是否素食限定}
 */
function build(g, list) {
  var n = list.length, s = 360 / n, h = '';
  // 分類越多，扇形越窄，字體就要跟著縮小，不然文字會超出扇形範圍
  var fs = n > 16 ? 10 : (n > 10 ? 11 : 13);
  var lh = fs * 1.12; // 行高（line height），決定直式文字上下兩個字之間的間距

  list.forEach(function (c, i) {
    var a0 = i * s, a1 = a0 + s, mid = a0 + s / 2;
    var colorIndex = i % 4;
    // 避免「最後一塊」跟「第一塊」顏色剛好相鄰又一樣，視覺上會分不清楚兩塊的交界
    if (i === n - 1 && colorIndex === 0 && n > 1) colorIndex = 1;

    var p0 = pt(100, a0), p1 = pt(100, a1); // 這一塊扇形的起點、終點（半徑100）
    var tp = pt(66, mid); // 文字要擺放的位置（半徑66，比扇形稍微靠內一點）

    // 用 SVG 的 <path> 畫一塊扇形：
    // M0 0 = 從圓心開始畫、L x y = 畫一條直線到 (x,y)、A100 100 0 0 1 x y = 畫一段半徑100的圓弧、Z = 封閉路徑
    h += '<path d="M0 0L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) +
      'A100 100 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) +
      'Z" fill="' + COL[colorIndex] + '" stroke="#fff" stroke-width="1.5"/>';

    // 把分類名稱拆成一個一個的字，直式由上往下排列、整體置中在 tp 這個位置
    var chars = c.n.split('');
    var startY = tp[1] - ((chars.length - 1) / 2) * lh; // 先算出最上面那個字要擺在哪個 y 座標
    chars.forEach(function (ch, idx) {
      h += '<text x="' + tp[0].toFixed(2) + '" y="' + (startY + idx * lh).toFixed(2) +
        '" text-anchor="middle" dominant-baseline="central" font-size="' + fs +
        '" font-weight="700" fill="' + TXT[colorIndex] + '">' + esc(ch) + '</text>';
    });
  });

  g.innerHTML = h; // 一次把組好的 HTML／SVG 字串塞進去，比起迴圈中一直操作 DOM 效能更好
}

var rot = $('rot'), cur = 0, busy = false;
// cur：目前轉盤累積旋轉的角度（會一直累加，不會重置回 0，才能讓每次轉動都是「繼續往前轉」）
// busy：是否正在轉動中，避免使用者在動畫播放到一半時連續狂點「轉！」按鈕

/** enterWheel()：每次進入轉盤畫面時執行，依照目前篩選條件重新畫出轉盤 */
function enterWheel() {
  cats = catList();
  cur = 0; busy = false;

  // 先把旋轉動畫「關掉」、瞬間轉回 0 度，重新畫好新的扇形之後，再把動畫「打開」，
  // 這樣才不會每次重新進入轉盤畫面時，都還殘留上一次旋轉到一半的角度跟動畫效果。
  rot.classList.add('noAnim'); // 暫時關掉動畫（.noAnim 寫在 style.css）
  rot.style.transform = 'rotate(0deg)';
  build(rot, cats);
  void rot.offsetWidth; // 這一行是個小技巧：強迫瀏覽器「立刻」套用上面的樣式變化，
                         // 否則瀏覽器可能會把「關動畫」跟「開動畫」兩個動作合併處理，導致效果失效。
  rot.classList.remove('noAnim');

  $('res').textContent = '？';
  $('spin').textContent = '轉！';
  $('spin').disabled = false;
  setHidden('like', true);
}

$('spin').onclick = function () {
  if (busy) return; // 正在轉動中就不處理這次點擊
  busy = true;
  $('spin').disabled = true;
  setHidden('like', true);
  $('res').textContent = '…';

  var n = cats.length, s = 360 / n;
  var k = Math.floor(Math.random() * n); // 隨機選出「這次要停在第幾個分類」（陣列索引）
  var off = (Math.random() - .5) * (s - 10); // 在那一塊扇形範圍內，加一點隨機偏移，
                                              // 讓指針停的位置不會每次都精準停在正中間，更像真實轉盤

  // 下面這段數學是在計算「轉盤要再多轉幾度，才會讓第 k 塊扇形剛好停在正上方指針的位置」，
  // 並且額外多轉 5 整圈（360*5），單純是為了讓動畫效果看起來轉得比較久、比較有誠意。
  var want = ((360 - (k * s + s / 2 + off)) % 360 + 360) % 360;
  var mod = ((cur % 360) + 360) % 360;
  cur += 360 * 5 + ((want - mod) + 360) % 360;

  rot.style.transform = 'rotate(' + cur + 'deg)'; // 實際觸發旋轉動畫（CSS transition 會自動產生轉動效果）

  // 動畫播放需要 4.2 秒（跟 CSS 裡 #rot 的 transition 時間要一致），
  // 用 setTimeout 等動畫播完之後，才真正把結果顯示出來、把按鈕恢復成可以點擊的狀態。
  setTimeout(function () {
    busy = false;
    pick = cats[k];
    $('res').textContent = pick.n;
    $('spin').disabled = false;
    $('spin').textContent = '不喜歡，重轉';
    setHidden('like', false);
  }, 4300);
};

$('like').onclick = function () { drawResult(); go('result'); };