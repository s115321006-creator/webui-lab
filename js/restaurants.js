/* ======================================================================
   restaurants.js
   【餐廳搜尋】依分類取得餐廳清單、距離時間估算、範圍防呆自動擴大。
   ====================================================================== */

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