/* ======================================================================
   custom.js
   【自製轉盤】新增／刪除自訂類型與自訂餐廳。
   ====================================================================== */

/* ----------------------------------------------------------------------
   自製轉盤畫面
   ---------------------------------------------------------------------- */

/** drawCustom()：畫出「自製轉盤」畫面裡的三個區塊：目前的自訂類型、新增餐廳表單選項、已新增的餐廳清單 */
function drawCustom() {
  $('cTypes').innerHTML = S.cust.length
    ? S.cust.map(function (t, i) {
        return '<span class="chip on">' + esc(t) +
          ' <button class="ib chipDel" data-dt="' + i + '" aria-label="刪除類型">✕</button></span>';
      }).join('')
    : '<p class="hint tightB">還沒有自訂類型。</p>';

  // 「新增餐廳」表單裡的「所屬類型」下拉選單，選項是「20個內建分類 + 使用者自訂的類型」
  $('rType').innerHTML = CUIS.map(function (c) { return c[0]; }).concat(S.cust)
    .map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');

  $('cRests').innerHTML = S.custR.length
    ? S.custR.map(function (r, i) {
        return '<div class="item"><div>' + esc(r.n) + (r.v ? '<span class="tag v">素食</span>' : '') +
          '<small>' + esc(r.t) + '・' + esc(r.s) + '</small></div>' +
          '<button class="ib" data-dr="' + i + '" aria-label="刪除餐廳">✕</button></div>';
      }).join('')
    : '<p class="hint flush">尚未新增餐廳。</p>';
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