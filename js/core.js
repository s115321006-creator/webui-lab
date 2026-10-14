/* ======================================================================
   core.js
   【核心】全站共用的基礎：小工具($、esc)、儲存(S、save)、狀態(F…)、畫面切換 go()、提示 toast()。
   其他檔案都會用到這裡的東西，所以要最先載入(在 data.js 之後)。
   ====================================================================== */

/* ----------------------------------------------------------------------
   工具函式（小幫手函式）：整份程式到處都會用到，所以寫在最前面
   ---------------------------------------------------------------------- */

/**
 * $ 是一個「縮寫函式」，用來取代很長的 document.getElementById(...)。
 * 例如原本要寫 document.getElementById('spin')，
 * 之後只要寫 $('spin') 就好，整份程式會短很多、也更好讀。
 * @param {string} i - HTML 元素的 id
 * @returns {HTMLElement} 找到的元素
 */
var $ = function (i) { return document.getElementById(i); };

/**
 * esc()：HTML 跳脫（escape）函式。
 * 當我們要把「使用者自己打的文字」（例如自訂餐廳店名）用 innerHTML 塞進網頁時，
 * 一定要先經過這個函式處理，把 < > & " ' 這些在 HTML 裡有特殊意義的符號
 * 轉換成安全的文字實體，避免使用者不小心（或惡意）輸入的文字被瀏覽器當成程式碼執行。
 * 這是網頁安全很重要的基本觀念，叫做防止 XSS（跨站腳本攻擊）。
 */
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ----------------------------------------------------------------------
   資料儲存（localStorage）：
   瀏覽器提供的「本機儲存空間」，資料存在使用者自己的瀏覽器裡，
   就算關掉分頁、重新整理，下次打開還是會記得（但換一台裝置或換瀏覽器就不會同步）。
   ---------------------------------------------------------------------- */

// S 是整個 App 的「使用者個人資料」，四個欄位分別是：
// cust：自訂的餐點類型（例如「宵夜」）
// custR：自訂新增的餐廳
// fav：收藏（我的最愛）的餐廳名稱清單
// bl：黑名單的餐廳名稱清單
var S = { cust: [], custR: [], fav: [], bl: [] };

try {
  // 嘗試從 localStorage 讀取之前存過的資料（key 是 'foodDemo4'）
  var raw = localStorage.getItem('foodDemo4');
  if (raw) S = Object.assign(S, JSON.parse(raw));
} catch (e) {
  // 如果瀏覽器不支援 localStorage，或資料格式壞掉，就放棄讀取，使用預設的空資料，
  // 用 try/catch 包起來可以避免整個程式因為這裡出錯而完全當掉。
}

/**
 * setHidden(id, yes)：顯示／隱藏某個元素。
 * 做法是加上或拿掉 .hidden 這個 CSS 類別（display:none 寫在 style.css）。
 * 這樣 JS 只負責「開關」，外觀都留在 CSS。
 */
function setHidden(id, yes) { $(id).classList.toggle('hidden', yes); }

/** save()：把目前的 S（使用者資料）存回 localStorage，之後重新整理網頁也不會不見 */
function save() {
  try {
    localStorage.setItem('foodDemo4', JSON.stringify(S));
  } catch (e) { /* 存不進去（例如容量滿了）就先略過，不影響其他功能 */ }
}

/* ----------------------------------------------------------------------
   全域狀態（整個 App 執行過程中會一直被讀取／修改的變數）
   ---------------------------------------------------------------------- */

// F：使用者目前的篩選條件（filter 的縮寫）
// lat / lng / acc：自動定位取得的「緯度、經度、誤差範圍（公尺）」，沒有定位時是 null / 0
var F = { meat: 'all', stp: ['飯', '麵', '其他'], rng: 1000, city: '', dist: '', auto: false, lat: null, lng: null, acc: 0 };
var cats = [];      // 目前轉盤上實際會出現的分類清單（依篩選條件算出來）
var pick = '';       // 這一次轉盤轉到的結果
var COL = ['#e23d2e', '#f5b82e', '#2f9e5b', '#6b4fa0']; // 轉盤扇形輪流使用的 4 種顏色
var TXT = ['#fff', '#1f2a24', '#fff', '#fff'];          // 對應上面 4 種底色，字要用白色還是深色才看得清楚
var lastItems = [];  // 最近一次搜尋出來、顯示在清單與地圖上的餐廳陣列
var lastRange = 1000; // 最近一次「實際用來顯示」的搜尋範圍（可能是防呆自動擴大後的數值）
var selName = null;   // 目前在地圖上被選取的餐廳名稱

/* ----------------------------------------------------------------------
   畫面切換（SPA 的核心機制）
   ---------------------------------------------------------------------- */

/**
 * go(id)：切換顯示哪一個畫面。
 * 做法：先把「所有」畫面都拿掉 .on（全部隱藏），
 *      再幫「目標畫面」加上 .on（讓它顯示出來）。
 * 這就是前面在 index.html 註解裡提到的「單頁應用」畫面切換邏輯。
 * @param {string} id - 要切換過去的畫面 id，例如 'home'、'wheel'、'result'
 */
function go(id) {
  document.querySelectorAll('.scr').forEach(function (s) { s.classList.remove('on'); });
  $(id).classList.add('on');
  window.scrollTo(0, 0); // 切換畫面時捲回最上面，避免使用者卡在上一頁捲動的位置

  // 只有在進入「結果頁」時，才讓 #app 容器變寬（顯示清單+地圖雙欄），
  // classList.toggle(className, 條件) 的意思是：條件為 true 就加上這個 class，false 就拿掉。
  $('app').classList.toggle('wide', id === 'result');

  // 每個畫面在「被打開的當下」，大多需要重新把內容畫一次（例如重新讀取最新的篩選狀態），
  // 所以這裡依照 id 呼叫對應的「畫面繪製函式」。
  if (id === 'filter') drawFilter();
  if (id === 'wheel') enterWheel();
  if (id === 'custom') drawCustom();
  if (id === 'favs') drawFavs();
  if (id === 'black') drawBl();
}

/**
 * toast(t)：在畫面下方顯示一個短暫的小提示訊息，例如「已加入我的最愛」。
 * 用 setTimeout 讓訊息在 2.4 秒後自動消失。
 */
function toast(t) {
  var e = $('toast');
  e.textContent = t;
  e.classList.add('on');
  clearTimeout(toast.t); // 如果上一個提示還沒消失、又跳出新的提示，先取消舊的計時器
  toast.t = setTimeout(function () { e.classList.remove('on'); }, 2400);
}

// 這是一個「事件委派（event delegation）」的寫法：
// 不去幫「每一個」按鈕個別加上 onclick，而是在最外層的 document 統一監聽點擊事件，
// 每次點擊時才去判斷「使用者點到的東西，有沒有 data-go 這個屬性」。
// 好處是：就算之後用 JavaScript 動態產生新的按鈕（例如餐廳清單），
// 新按鈕只要有 data-go 屬性，不用額外寫程式，點擊事件就會自動生效。
document.addEventListener('click', function (e) {
  // e.target 是「使用者實際點到的元素」，closest('[data-go]') 會往上找，
  // 直到找到「自己或最近的父層元素」有 data-go 屬性為止（避免點到按鈕裡面的文字或圖示時抓不到）。
  var g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); }
});