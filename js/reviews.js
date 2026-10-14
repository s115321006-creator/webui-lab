/* ======================================================================
   reviews.js
   【評論】模擬的評分、Hashtag、AI 摘要(之後換成真實 API 就改這裡)。
   ====================================================================== */

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