/* ======================================================================
   script.js — 這個檔案負責整個網頁的「行為」：
   畫面要怎麼切換、轉盤怎麼轉、資料怎麼存怎麼讀、使用者點了按鈕之後要發生什麼事。

   閱讀建議：這份檔案由上到下分成好幾個區塊，每個區塊上面都有
   /* ---------- 區塊名稱 ---------- *\/ 這種分隔註解，你可以先看過一輪
   每個區塊的註解，抓住大架構，再回頭看細節的程式碼會比較容易理解。
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

/** save()：把目前的 S（使用者資料）存回 localStorage，之後重新整理網頁也不會不見 */
function save() {
  try {
    localStorage.setItem('foodDemo4', JSON.stringify(S));
  } catch (e) { /* 存不進去（例如容量滿了）就先略過，不影響其他功能 */ }
}

/* ----------------------------------------------------------------------
   資料區：台灣縣市／鄉鎮市區 對照表
   ---------------------------------------------------------------------- */

// TW 是一個「物件（object）」，key 是縣市名稱，value 是用逗號分隔的鄉鎮市區字串。
// 用逗號分隔字串、之後再用 .split(',') 切開，是比較節省程式碼篇幅的寫法。
var TW = {
  '台北市': '中正區,大同區,中山區,松山區,大安區,萬華區,信義區,士林區,北投區,內湖區,南港區,文山區',
  '新北市': '板橋區,三重區,中和區,永和區,新莊區,新店區,樹林區,鶯歌區,三峽區,淡水區,汐止區,瑞芳區,土城區,蘆洲區,五股區,泰山區,林口區,深坑區,石碇區,坪林區,三芝區,石門區,八里區,平溪區,雙溪區,貢寮區,金山區,萬里區,烏來區',
  '桃園市': '桃園區,中壢區,大溪區,楊梅區,蘆竹區,大園區,龜山區,八德區,龍潭區,平鎮區,新屋區,觀音區,復興區',
  '台中市': '中區,東區,南區,西區,北區,北屯區,西屯區,南屯區,太平區,大里區,霧峰區,烏日區,豐原區,后里區,石岡區,東勢區,和平區,新社區,潭子區,大雅區,神岡區,大肚區,沙鹿區,龍井區,梧棲區,清水區,大甲區,外埔區,大安區',
  '台南市': '中西區,東區,南區,北區,安平區,安南區,永康區,歸仁區,新化區,左鎮區,玉井區,楠西區,南化區,仁德區,關廟區,龍崎區,官田區,麻豆區,佳里區,西港區,七股區,將軍區,學甲區,北門區,新營區,後壁區,白河區,東山區,六甲區,下營區,柳營區,鹽水區,善化區,大內區,山上區,新市區,安定區',
  '高雄市': '楠梓區,左營區,鼓山區,三民區,鹽埕區,前金區,新興區,苓雅區,前鎮區,旗津區,小港區,鳳山區,大寮區,鳥松區,林園區,仁武區,大樹區,大社區,岡山區,路竹區,橋頭區,梓官區,彌陀區,永安區,燕巢區,田寮區,阿蓮區,茄萣區,湖內區,旗山區,美濃區,內門區,杉林區,甲仙區,六龜區,茂林區,桃源區,那瑪夏區',
  '基隆市': '仁愛區,信義區,中正區,中山區,安樂區,暖暖區,七堵區',
  '新竹市': '東區,北區,香山區',
  '嘉義市': '東區,西區',
  '新竹縣': '竹北市,竹東鎮,新埔鎮,關西鎮,湖口鄉,新豐鄉,芎林鄉,橫山鄉,北埔鄉,寶山鄉,峨眉鄉,尖石鄉,五峰鄉',
  '苗栗縣': '苗栗市,頭份市,竹南鎮,後龍鎮,通霄鎮,苑裡鎮,卓蘭鎮,造橋鄉,西湖鄉,頭屋鄉,公館鄉,銅鑼鄉,三義鄉,大湖鄉,獅潭鄉,三灣鄉,南庄鄉,泰安鄉',
  '彰化縣': '彰化市,員林市,和美鎮,鹿港鎮,溪湖鎮,二林鎮,田中鎮,北斗鎮,花壇鄉,芬園鄉,大村鄉,永靖鄉,伸港鄉,線西鄉,福興鄉,秀水鄉,埔心鄉,埔鹽鄉,大城鄉,芳苑鄉,竹塘鄉,社頭鄉,二水鄉,田尾鄉,埤頭鄉,溪州鄉',
  '南投縣': '南投市,埔里鎮,草屯鎮,竹山鎮,集集鎮,名間鄉,鹿谷鄉,中寮鄉,魚池鄉,國姓鄉,水里鄉,信義鄉,仁愛鄉',
  '雲林縣': '斗六市,斗南鎮,虎尾鎮,西螺鎮,土庫鎮,北港鎮,古坑鄉,大埤鄉,莿桐鄉,林內鄉,二崙鄉,崙背鄉,麥寮鄉,東勢鄉,褒忠鄉,台西鄉,元長鄉,四湖鄉,口湖鄉,水林鄉',
  '嘉義縣': '太保市,朴子市,布袋鎮,大林鎮,民雄鄉,溪口鄉,新港鄉,六腳鄉,東石鄉,義竹鄉,鹿草鄉,水上鄉,中埔鄉,竹崎鄉,梅山鄉,番路鄉,大埔鄉,阿里山鄉',
  '屏東縣': '屏東市,潮州鎮,東港鎮,恆春鎮,萬丹鄉,長治鄉,麟洛鄉,九如鄉,里港鄉,鹽埔鄉,高樹鄉,萬巒鄉,內埔鄉,竹田鄉,新埤鄉,枋寮鄉,新園鄉,崁頂鄉,林邊鄉,南州鄉,佳冬鄉,琉球鄉,車城鄉,滿州鄉,枋山鄉,三地門鄉,霧台鄉,瑪家鄉,泰武鄉,來義鄉,春日鄉,獅子鄉,牡丹鄉',
  '宜蘭縣': '宜蘭市,羅東鎮,蘇澳鎮,頭城鎮,礁溪鄉,壯圍鄉,員山鄉,冬山鄉,五結鄉,三星鄉,大同鄉,南澳鄉',
  '花蓮縣': '花蓮市,鳳林鎮,玉里鎮,新城鄉,吉安鄉,壽豐鄉,光復鄉,豐濱鄉,瑞穗鄉,富里鄉,秀林鄉,萬榮鄉,卓溪鄉',
  '台東縣': '台東市,成功鎮,關山鎮,卑南鄉,大武鄉,太麻里鄉,東河鄉,長濱鄉,鹿野鄉,池上鄉,綠島鄉,延平鄉,海端鄉,達仁鄉,金峰鄉,蘭嶼鄉',
  '澎湖縣': '馬公市,湖西鄉,白沙鄉,西嶼鄉,望安鄉,七美鄉',
  '金門縣': '金城鎮,金湖鎮,金沙鎮,金寧鄉,烈嶼鄉,烏坵鄉',
  '連江縣': '南竿鄉,北竿鄉,莒光鄉,東引鄉'
};

/* ----------------------------------------------------------------------
   資料區：餐點分類 + 範例餐廳資料
   ---------------------------------------------------------------------- */

// CUIS：20 種餐點分類清單。每一筆資料是一個陣列 [分類名稱, 主食標籤, 是否只供素食]：
//   分類名稱：顯示在轉盤上的文字
//   主食標籤：用逗號分隔「飯」「麵」「其他」，代表這個分類底下有哪幾種主食可選
//             （這個欄位會拿去跟使用者勾選的「主食」篩選做比對）
//   是否只供素食：0 = 一般分類（葷素都有）；1 = 這個分類本身就是「蔬食料理」專用分類
var CUIS = [
  ['台式', '飯,麵,其他', 0], ['中式', '飯,麵,其他', 0], ['日式', '飯,麵,其他', 0], ['韓式', '飯,麵,其他', 0],
  ['義式', '飯,麵,其他', 0], ['美式', '其他', 0], ['墨西哥', '飯,其他', 0], ['印度', '飯,其他', 0],
  ['泰式', '飯,麵,其他', 0], ['越式', '飯,麵,其他', 0], ['港式', '飯,麵,其他', 0], ['火鍋', '其他', 0],
  ['燒烤', '其他', 0], ['速食', '其他', 0], ['鹽酥雞', '其他', 0], ['滷味', '其他', 0],
  ['健康餐', '飯,其他', 0], ['早午餐', '其他', 0], ['便利商店', '飯,麵,其他', 0], ['蔬食料理', '飯,麵,其他', 1]
];

// DATA：每個分類底下的範例餐廳資料（之後接真實資料庫或 Google Places API 時，
// 就是要把這個寫死的物件，換成「向伺服器要資料」的非同步請求）。
// 每一筆餐廳資料格式是 [店名, 距離(公尺), 主食類型, 是否為素食(0/1)]
var DATA = {
  '台式': [['阿嬤滷肉飯', 300, '飯', 0], ['度小月擔仔麵', 650, '麵', 0], ['台式熱炒', 1200, '其他', 0], ['蔬食台菜', 900, '其他', 1]],
  '中式': [['合菜快炒館', 500, '其他', 0], ['老北京炸醬麵', 800, '麵', 0], ['中式蒸餃館', 1400, '飯', 0], ['素食中式合菜', 1100, '其他', 1]],
  '日式': [['鰻魚丼飯屋', 500, '飯', 0], ['豚骨拉麵店', 750, '麵', 0], ['迴轉壽司', 1300, '其他', 0], ['蔬食壽司', 1000, '其他', 1]],
  '韓式': [['石鍋拌飯專門店', 430, '飯', 0], ['韓式冷麵館', 780, '麵', 0], ['部隊鍋辣炒年糕', 1200, '其他', 0], ['素食韓式拌飯', 950, '飯', 1]],
  '義式': [['燉飯小館', 600, '飯', 0], ['奶油培根義大利麵', 900, '麵', 0], ['拿坡里披薩', 450, '其他', 0], ['蔬食燉飯', 1000, '飯', 1]],
  '美式': [['經典漢堡店', 400, '其他', 0], ['素漢堡吧', 700, '其他', 1]],
  '墨西哥': [['塔可飯專賣', 600, '飯', 0], ['墨西哥捲餅', 900, '其他', 0], ['蔬食塔可', 1100, '其他', 1]],
  '印度': [['印度咖哩飯', 650, '飯', 0], ['印度烤餅套餐', 1000, '其他', 0], ['蔬食咖哩', 1200, '飯', 1]],
  '泰式': [['打拋豬肉飯', 480, '飯', 0], ['泰式酸辣河粉', 850, '麵', 0], ['涼拌青木瓜沙拉', 1300, '其他', 0], ['蔬食打拋飯', 1050, '飯', 1]],
  '越式': [['越式烤肉飯', 520, '飯', 0], ['牛肉河粉', 780, '麵', 0], ['法式麵包三明治', 1150, '其他', 0], ['蔬食河粉', 980, '麵', 1]],
  '港式': [['燒臘飯專門店', 430, '飯', 0], ['港式雲吞麵', 700, '麵', 0], ['港式點心', 1250, '其他', 0], ['蔬食點心', 1000, '其他', 1]],
  '火鍋': [['麻辣鴛鴦鍋', 700, '其他', 0], ['石頭火鍋', 1100, '其他', 0], ['蔬食養生鍋', 900, '其他', 1]],
  '燒烤': [['炭火串燒店', 650, '其他', 0], ['蔬食串燒', 950, '其他', 1]],
  '速食': [['連鎖速食店', 350, '其他', 0], ['素漢堡速食', 900, '其他', 1]],
  '鹽酥雞': [['巷口鹽酥雞', 260, '其他', 0], ['蔬食鹹酥雞', 600, '其他', 1]],
  '滷味': [['傳統滷味攤', 430, '其他', 0], ['蔬食滷味', 800, '其他', 1]],
  '健康餐': [['穀物能量碗', 480, '飯', 0], ['生菜沙拉吧', 700, '其他', 0], ['蔬食能量碗', 900, '飯', 1]],
  '早午餐': [['美式早午餐', 600, '其他', 0], ['蔬食早午餐', 950, '其他', 1]],
  '便利商店': [['超商飯糰', 200, '飯', 0], ['超商涼麵', 350, '麵', 0], ['超商關東煮', 500, '其他', 0]],
  '蔬食料理': [['蔬食便當', 350, '飯', 1], ['蔬食擔擔麵', 600, '麵', 1], ['蔬食拼盤', 850, '其他', 1]]
};

/* ----------------------------------------------------------------------
   全域狀態（整個 App 執行過程中會一直被讀取／修改的變數）
   ---------------------------------------------------------------------- */

// F：使用者目前的篩選條件（filter 的縮寫）
var F = { meat: 'all', stp: ['飯', '麵', '其他'], rng: 1000, city: '', dist: '', auto: false };
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

/* ----------------------------------------------------------------------
   位置設定（縣市 / 鄉鎮市區 下拉選單 ＋ 自動定位）
   ---------------------------------------------------------------------- */

// 一開始先把「縣市」下拉選單的選項，用 TW 這個物件的 key（縣市名稱）動態產生出來
$('city').innerHTML = '<option value="">縣市</option>' +
  Object.keys(TW).map(function (c) { return '<option>' + c + '</option>'; }).join('');

/** fillDist()：根據目前選到的縣市，重新產生「鄉鎮市區」下拉選單的選項 */
function fillDist() {
  var l = F.city ? TW[F.city].split(',') : [];
  $('dist').innerHTML = '<option value="">鄉鎮市區</option>' +
    l.map(function (d) { return '<option>' + d + '</option>'; }).join('');
}
fillDist(); // 網頁一載入先執行一次（這時候還沒選縣市，所以鄉鎮市區選單會是空的）

$('city').onchange = function () {
  F.city = this.value; F.dist = ''; F.auto = false;
  fillDist(); locNote();
};
$('dist').onchange = function () {
  F.dist = this.value; F.auto = false;
  locNote();
};

/** locNote()：更新「位置」卡片下方的提示文字，告訴使用者目前的搜尋地點是什麼 */
function locNote() {
  $('locNote').textContent = F.auto
    ? '已使用目前定位。正式版會自動換算成縣市與區。'
    : (F.city && F.dist ? '搜尋位置：' + F.city + F.dist : '選擇縣市與區，或使用自動定位。');
}

$('auto').onclick = function () {
  // navigator.geolocation 是瀏覽器內建的「定位 API」，不需要額外安裝套件。
  if (!navigator.geolocation) { toast('這個瀏覽器不支援定位，請改用下拉選單'); return; }
  $('locNote').textContent = '定位中…';

  // getCurrentPosition(成功時執行的函式, 失敗時執行的函式, 設定選項)
  navigator.geolocation.getCurrentPosition(
    function () {
      // 定位成功：把 F.auto 設成 true，並清空手動選擇的縣市／鄉鎮
      F.auto = true; F.city = ''; F.dist = ''; $('city').value = '';
      fillDist(); locNote(); toast('定位成功');
    },
    function (err) {
      // 定位失敗：err.code === 1 代表「使用者拒絕授權」，其他數字代表逾時或其他錯誤。
      // 在這個預覽環境常常會失敗，這是正常現象（詳細原因在對話中已經說明過）。
      F.auto = false; locNote();
      toast(err.code === 1
        ? '定位權限被拒絕，這個 Demo 頁面環境常會擋掉定位，正式上線後在真實網域會正常詢問權限'
        : '目前環境無法取得定位（Demo 常見情形），請改用下拉選單，或按下方連結試看看');
      $('locNote').innerHTML = '選擇縣市與區，或 <a href="#" id="demoLoc" style="color:inherit;font-weight:700">使用範例定位（台中市西屯區）</a>';
    },
    { timeout: 8000 } // 最多等待 8 秒，超過就當作失敗
  );
};

// 「使用範例定位」是用 innerHTML 動態插入的連結，所以也要用事件委派的方式監聽點擊
document.addEventListener('click', function (e) {
  if (e.target.id === 'demoLoc') {
    e.preventDefault();
    F.auto = false; F.city = '台中市'; fillDist(); F.dist = '西屯區';
    $('city').value = '台中市'; $('dist').value = '西屯區';
    locNote(); toast('已套用範例定位');
  }
});

/** locText()：回傳目前搜尋地點的顯示文字，給結果頁標題、地圖標籤使用 */
function locText() { return F.auto ? '目前定位' : F.city + F.dist; }

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
  $('vegHint').style.display = F.meat === 'veg' ? 'block' : 'none';
  locNote();
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
  rot.style.transition = 'none';
  rot.style.transform = 'rotate(0deg)';
  build(rot, cats);
  void rot.offsetWidth; // 這一行是個小技巧：強迫瀏覽器「立刻」套用上面的樣式變化，
                         // 否則瀏覽器可能會把「關動畫」跟「開動畫」兩個動作合併處理，導致效果失效。
  rot.style.transition = '';

  $('res').textContent = '？';
  $('spin').textContent = '轉！';
  $('spin').disabled = false;
  $('like').style.display = 'none';
}

$('spin').onclick = function () {
  if (busy) return; // 正在轉動中就不處理這次點擊
  busy = true;
  $('spin').disabled = true;
  $('like').style.display = 'none';
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
    $('like').style.display = 'inline-block';
  }, 4300);
};

$('like').onclick = function () { drawResult(); go('result'); };

/* ----------------------------------------------------------------------
   餐廳搜尋邏輯（含「範圍防呆自動擴大」機制）
   ---------------------------------------------------------------------- */

/** mapUrl(n)：產生「用店名搜尋 Google Map」的連結網址 */
function mapUrl(n) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(n);
}

/**
 * rawList(catName, forceVeg)：取得某個分類「符合篩選條件」的完整餐廳清單（還沒套用距離範圍）。
 * @param {string} catName  - 分類名稱
 * @param {boolean} forceVeg - 是否強制只要素食（「蔬食料理」這個分類固定為 true）
 */
function rawList(catName, forceVeg) {
  // 先把範例資料（DATA）轉換成統一的物件格式：{n:店名, d:距離, s:主食類型, v:是否素食}
  var l = (DATA[catName] || []).map(function (r) {
    return { n: r[0], d: r[1], s: r[2], v: r[3] };
  });

  // 把使用者自己在「自製轉盤」新增、屬於這個分類的店家也加進來，
  // c:1 這個標記代表「這是自訂餐廳」，距離未知所以先給 0。
  S.custR.forEach(function (r) {
    if (r.t === catName) l.push({ n: r.n, d: 0, s: r.s, v: r.v ? 1 : 0, c: 1 });
  });

  // 排除黑名單裡的店家（indexOf < 0 代表「不在黑名單裡」）
  l = l.filter(function (r) { return S.bl.indexOf(r.n) < 0; });

  // 只留下「主食類型」符合使用者篩選的店家
  l = l.filter(function (r) { return F.stp.indexOf(r.s) > -1; });

  // 葷素篩選：如果這個分類不是強制素食（例如不是「蔬食料理」），
  // 才需要再依照使用者選的「葷食／素食」去過濾；
  // 選「都可以」的話完全不過濾，葷素都顯示。
  if (!forceVeg) {
    if (F.meat === 'meat') l = l.filter(function (r) { return !r.v; });
    else if (F.meat === 'veg') l = l.filter(function (r) { return r.v; });
  }
  return l;
}

/**
 * timeEst(m)：根據距離（公尺），概算步行／機車／開車各要多久。
 * 這裡用的是「直線距離 ÷ 平均時速」的簡化算法，不是真實路線規劃，
 * 正式上線建議改接 Google Directions API 或 OSRM 之類的路線規劃服務。
 */
function timeEst(m) {
  var km = m / 1000;
  return {
    walk: Math.max(1, Math.round(km / 5 * 60)),   // 步行時速抓 5 km/h
    ride: Math.max(1, Math.round(km / 20 * 60)),  // 機車時速抓 20 km/h
    drive: Math.max(1, Math.round(km / 30 * 60))  // 開車時速抓 30 km/h（市區路況打折）
  };
  // Math.max(1, ...) 確保就算距離很近，時間也至少顯示「1 分」，不會出現「0 分」這種奇怪結果
}

/**
 * niceRange(m)：範圍防呆機制的核心——找出「大於等於 m 公尺」的下一個「整齊」的範圍數字。
 * 例如實際最近的店是 1200 公尺，就會回傳 1500，而不是很奇怪的「1200 公尺」。
 */
function niceRange(m) {
  var steps = [500, 1000, 1500, 2000, 3000, 5000, 8000, 12000, 20000];
  for (var i = 0; i < steps.length; i++) if (steps[i] >= m) return steps[i];
  return Math.ceil(m / 5000) * 5000; // 萬一比最大的步驟還遠，改成每 5 公里為單位無條件進位
}

/* ----------------------------------------------------------------------
   評分／Hashtag／AI 摘要（目前是「模擬資料」，不是真實評論分析）
   ---------------------------------------------------------------------- */

var POS_WORDS = ['份量大', 'CP值高', '服務親切', '環境乾淨', '出餐快', '食材新鮮', '老闆親切', '適合聚餐', '停車方便', '裝潢舒適'];
var NEG_WORDS = ['偏辣', '等候較久', '座位較少', '價格偏高', '偏鹹', '份量偏小', '假日人多', '停車不易'];
var reviewCache = {}; // 快取（cache）：同一家店只需要算一次評論資料，算過就存起來，之後直接拿現成的用

/**
 * reviewMeta(name)：用「店名」產生一組固定、看起來合理的模擬評論資料（評分、則數、好評/提醒標籤、AI 摘要文字）。
 * 重點技巧：利用前面寫好的 hashStr()，讓同一個店名每次都算出一樣的結果（不是每次重新整理就變來變去），
 * 這樣在使用者看起來，就像是這家店「真的有一組固定的評價」。
 *
 * 真正上線時，這個函式要整個換掉，改成：
 *   1. 呼叫 Google Places API 拿到真實評論文字
 *   2. 把評論丟給 AI（例如 Claude API）生成摘要與標籤
 *   3. 把結果存進資料庫，這個函式改成直接讀資料庫（不要每次都重新呼叫 AI，要有快取機制）
 */
function reviewMeta(name) {
  if (reviewCache[name]) return reviewCache[name]; // 已經算過，直接回傳快取結果

  var h = hashStr(name);
  var rating = Math.min(4.9, 3.6 + ((h % 13) / 10)); // 評分範圍大約落在 3.6 ~ 4.9 之間
  rating = Math.round(rating * 10) / 10; // 四捨五入到小數點後一位
  var count = 40 + (h % 260); // 評論則數：40 ~ 299 之間

  var pn = 3 + (h % 2);                       // 好評標籤數量：3 或 4 個
  var nn = 1 + ((Math.floor(h / 8)) % 2);      // 提醒標籤數量：1 或 2 個
  var pos = [], neg = [], i;
  for (i = 0; i < pn; i++) {
    var w = POS_WORDS[(h + i * 7) % POS_WORDS.length];
    if (pos.indexOf(w) < 0) pos.push(w); // 避免同一個詞被選到兩次重複
  }
  for (i = 0; i < nn; i++) {
    var w2 = NEG_WORDS[(h + i * 11) % NEG_WORDS.length];
    if (neg.indexOf(w2) < 0) neg.push(w2);
  }

  // tags：把好評、提醒詞彙統一包成「帶有被提及則數」的物件陣列，給 Hashtag 顯示用
  var tags = pos.map(function (t, i) { return { t: t, n: 8 + ((h + i * 13) % 40), pos: 1 }; })
    .concat(neg.map(function (t, i) { return { t: t, n: 5 + ((h + i * 17) % 20), pos: 0 }; }));

  // 把好評、提醒詞彙組合成一段看起來像 AI 生成的摘要文字
  var summary = '整體約 ' + rating + ' 顆星（約 ' + count + ' 則評論）。顧客常提到「' + pos.join('、') +
    '」；比較常見的提醒是「' + neg.join('、') + '」，可以列入考慮再決定要不要去。';

  var meta = { rating: rating, count: count, pos: pos, neg: neg, tags: tags, summary: summary };
  reviewCache[name] = meta; // 存進快取，下次同一家店就不用重算
  return meta;
}

/** starStr(rating)：把數字評分轉成「★★★★☆」這種星星字串（四捨五入到整數顆星） */
function starStr(rating) {
  var f = Math.round(rating);
  // 先準備好「5顆實心星 + 5顆空心星」共10個字的字串，再用 slice 截出剛好5個字的片段，
  // 是個用字串操作技巧快速產生「f顆實心＋(5-f)顆空心」效果的寫法。
  return '★★★★★☆☆☆☆☆'.slice(5 - f, 10 - f);
}

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
    $('dTimeCard').style.display = 'none';
  } else {
    $('dTimeCard').style.display = '';
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
    $('mapCol').style.display = 'none';
    $('mapPeekBtn').style.display = 'none';
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
      '<br><span class="stars" style="font-size:12px">' + starStr(rm.rating) + '</span> ' +
      '<small style="display:inline">' + rm.rating + '（約 ' + rm.count + ' 則評論）</small>' +
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

  $('mapCol').style.display = '';
  $('mapPeekBtn').style.display = '';
  renderMap('mapSvg', 260);     // 畫出桌面版側邊欄的小地圖
  $('mapDetail').style.display = 'none';
}

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
    ' <span class="stars" style="font-size:12px">' + starStr(rm.rating) + '</span> ' + rm.rating +
    '<br><span style="color:var(--sub)">' + (r.c ? '自己新增的店・距離未知' : '約 ' + r.d + ' 公尺') + tstr + '</span>' +
    '<div class="drow">' +
    '<button class="alt" data-detail="' + esc(r.n) + '">📝 評價與 AI 摘要</button>' +
    '<a class="btn alt" style="padding:8px 12px;min-height:36px" href="' + mapUrl(r.n) + '" target="_blank" rel="noopener">開 Google Map</a>' +
    '<button class="alt" data-a="fav" data-n="' + esc(r.n) + '">' + (f ? '♥ 已收藏' : '♡ 收藏') + '</button>' +
    '<button class="alt" data-a="bl" data-n="' + esc(r.n) + '">⊘ 黑名單</button>' +
    '</div>';

  // 桌面版、手機全螢幕版各有自己的詳情小卡片容器，內容完全一樣、同步更新
  $('mapDetail').innerHTML = html; $('mapDetail').style.display = 'block';
  $('mapDetailFull').innerHTML = html; $('mapDetailFull').style.display = 'block';

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
  $('mapDetailFull').style.display = selName ? 'block' : 'none';
  $('mapOverlay').classList.add('on');
};
// 全螢幕地圖的關閉按鈕
$('closeMap').onclick = function () { $('mapOverlay').classList.remove('on'); };

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

/* ----------------------------------------------------------------------
   自製轉盤畫面
   ---------------------------------------------------------------------- */

/** drawCustom()：畫出「自製轉盤」畫面裡的三個區塊：目前的自訂類型、新增餐廳表單選項、已新增的餐廳清單 */
function drawCustom() {
  $('cTypes').innerHTML = S.cust.length
    ? S.cust.map(function (t, i) {
        return '<span class="chip on">' + esc(t) +
          ' <button class="ib" style="padding:0 4px;min-width:0;color:#fff;font-size:14px" data-dt="' + i + '" aria-label="刪除類型">✕</button></span>';
      }).join('')
    : '<p class="hint" style="margin:0 0 10px">還沒有自訂類型。</p>';

  // 「新增餐廳」表單裡的「所屬類型」下拉選單，選項是「20個內建分類 + 使用者自訂的類型」
  $('rType').innerHTML = CUIS.map(function (c) { return c[0]; }).concat(S.cust)
    .map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');

  $('cRests').innerHTML = S.custR.length
    ? S.custR.map(function (r, i) {
        return '<div class="item"><div>' + esc(r.n) + (r.v ? '<span class="tag v">素食</span>' : '') +
          '<small>' + esc(r.t) + '・' + esc(r.s) + '</small></div>' +
          '<button class="ib" data-dr="' + i + '" aria-label="刪除餐廳">✕</button></div>';
      }).join('')
    : '<p class="hint" style="margin:0">尚未新增餐廳。</p>';
}

$('cTypes').onclick = function (e) {
  var b = e.target.closest('[data-dt]');
  if (b) { S.cust.splice(+b.dataset.dt, 1); save(); drawCustom(); }
};
$('cRests').onclick = function (e) {
  var b = e.target.closest('[data-dr]');
  if (b) { S.custR.splice(+b.dataset.dr, 1); save(); drawCustom(); }
};
$('addType').onclick = function () {
  var v = $('newType').value.trim();
  if (!v) { toast('請輸入類型名稱'); return; }
  if (S.cust.indexOf(v) > -1 || CUIS.some(function (c) { return c[0] === v; })) {
    toast('這個類型已經存在'); return;
  }
  S.cust.push(v);
  $('newType').value = '';
  save(); drawCustom();
  toast('已新增類型，下次轉盤會出現');
};
$('addRest').onclick = function () {
  var v = $('rName').value.trim();
  if (!v) { toast('請輸入店名'); return; }
  S.custR.push({ n: v, t: $('rType').value, s: $('rStp').value, v: $('rVeg').checked });
  $('rName').value = '';
  $('rVeg').checked = false;
  save(); drawCustom();
  toast('已儲存，轉到該類型時會顯示');
};

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
        return '<div class="item"><a href="' + mapUrl(n) + '" target="_blank" rel="noopener" style="color:inherit;font-weight:700">' + esc(n) + '</a>' +
          '<button class="alt" style="padding:6px 12px;min-height:36px" data-x="' + esc(n) + '" data-act="' + act + '">' + lbl + '</button></div>';
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