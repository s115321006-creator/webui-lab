/* ======================================================================
   location.js
   【位置】縣市／區下拉選單、自動定位(瀏覽器定位＋Nominatim 反查)、Leaflet 定位小地圖。
   ====================================================================== */

/* ----------------------------------------------------------------------
   位置設定（縣市 / 鄉鎮市區 下拉選單 ＋ 真實自動定位）
   整體流程：
   1. 使用者按「自動定位」→ 瀏覽器跳出授權視窗 → 允許後拿到真實的「緯度、經度」
   2. 把座標丟給 OpenStreetMap 的免費服務 Nominatim，反查出「台中市西屯區」這類文字地址
   3. 自動把下拉選單選成對應的縣市與區，並在地圖上標出你的位置
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

/** clearAutoLocation()：使用者改成手動選擇地點時，清掉之前自動定位的座標與地圖 */
function clearAutoLocation() {
  F.auto = false; F.lat = null; F.lng = null; F.acc = 0;
  setHidden('locMap', true);
}

$('city').onchange = function () {
  F.city = this.value; F.dist = '';
  clearAutoLocation();
  fillDist(); locNote();
};
$('dist').onchange = function () {
  F.dist = this.value;
  clearAutoLocation();
  locNote();
};

/** locNote()：更新「位置」卡片下方的提示文字，告訴使用者目前的搜尋地點是什麼 */
function locNote() {
  var el = $('locNote');
  if (F.auto && F.lat !== null) {
    var place = (F.city && F.dist) ? '：' + F.city + F.dist : '';
    el.textContent = '已使用目前定位' + place + '（座標 ' + F.lat.toFixed(5) + ', ' + F.lng.toFixed(5) +
      '，誤差約 ' + Math.round(F.acc) + ' 公尺）';
  } else if (F.city && F.dist) {
    el.textContent = '搜尋位置：' + F.city + F.dist;
  } else {
    el.textContent = '選擇縣市與區，或使用自動定位。';
  }
}

/** locText()：回傳目前搜尋地點的顯示文字，給結果頁標題、地圖標籤使用 */
function locText() {
  if (F.auto) return (F.city && F.dist) ? F.city + F.dist : '目前定位';
  return F.city + F.dist;
}

/* ---------- 把座標換成「縣市 + 鄉鎮市區」 ---------- */

/** norm(s)：把「臺」統一寫成「台」。OpenStreetMap 回傳的是「臺中市」，但我們的 TW 資料用的是「台中市」 */
function norm(s) { return String(s).replace(/臺/g, '台'); }

/**
 * reverseGeocode(lat, lng)：呼叫 Nominatim（OpenStreetMap 的免費反向地理編碼服務），
 * 傳入座標，回傳這個座標對應的地址資料（JSON）。
 * 注意：這是第三方服務，使用者的座標會被送到 nominatim.openstreetmap.org，
 * 而且官方規定「每秒最多 1 次請求」，我們每次定位只呼叫 1 次，符合規定。
 */
function reverseGeocode(lat, lng) {
  var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&accept-language=zh-TW' +
    '&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng);
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

/**
 * matchAddress(addr)：從 Nominatim 回傳的地址欄位裡，找出對應我們 TW 資料的「縣市」與「鄉鎮市區」。
 * Nominatim 不同地點用的欄位名稱會不一樣（suburb、city、town…），
 * 所以不去猜欄位名，而是把「所有欄位的值」全部收集起來，再去跟 TW 的名稱比對。
 */
function matchAddress(addr) {
  var vals = Object.keys(addr).map(function (k) { return norm(addr[k]); });
  var city = null, dist = null;

  // 找縣市：看有沒有哪個欄位的文字包含「台中市」「新北市」這類名稱
  Object.keys(TW).forEach(function (c) {
    if (!city && vals.some(function (v) { return v.indexOf(c) > -1; })) city = c;
  });

  // 找鄉鎮市區：先找「完全相同」的，找不到再找「包含」的（避免「東區」誤判成別的文字）
  if (city) {
    var list = TW[city].split(',');
    list.forEach(function (d) { if (!dist && vals.indexOf(d) > -1) dist = d; });
    list.forEach(function (d) {
      if (!dist && vals.some(function (v) { return v.indexOf(d) > -1; })) dist = d;
    });
  }
  return { city: city, dist: dist };
}

/* ---------- 篩選頁上的真實地圖（Leaflet + OpenStreetMap） ---------- */

var locMap = null, locMarker = null, locCircle = null;

/**
 * showLocMap()：在「位置」卡片裡顯示真實地圖，標出定位點，並用圓圈畫出誤差範圍。
 * Leaflet 是 index.html 另外載入的地圖函式庫（全域變數 L）。
 * 如果它沒載入成功（例如沒有網路），就略過地圖，其他功能照常運作。
 */
function showLocMap() {
  var box = $('locMap');
  if (typeof L === 'undefined') { setHidden('locMap', true); return; }
  setHidden('locMap', false);

  if (!locMap) {
    locMap = L.map(box);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者'
    }).addTo(locMap);
  }
  var ll = [F.lat, F.lng];
  locMap.setView(ll, F.acc > 1000 ? 14 : 16);
  if (locMarker) locMarker.setLatLng(ll); else locMarker = L.marker(ll).addTo(locMap);
  if (locCircle) { locCircle.setLatLng(ll); locCircle.setRadius(F.acc); }
  else locCircle = L.circle(ll, { radius: F.acc }).addTo(locMap);

  // 地圖容器原本是隱藏的，剛顯示出來時要請 Leaflet 重新量一次大小，否則地圖會顯示不完整
  setTimeout(function () { locMap.invalidateSize(); }, 50);
}

/* ---------- 自動定位按鈕 ---------- */

/** setAutoBtn(text, disabled)：統一設定「自動定位」按鈕的文字與是否可按 */
function setAutoBtn(text, disabled) {
  $('auto').textContent = text;
  $('auto').disabled = disabled;
}

/** onLocated(pos)：瀏覽器成功拿到真實位置時執行 */
function onLocated(pos) {
  var lat = pos.coords.latitude, lng = pos.coords.longitude;
  F.auto = true; F.lat = lat; F.lng = lng; F.acc = pos.coords.accuracy || 0;
  F.city = ''; F.dist = ''; $('city').value = ''; fillDist();
  $('locNote').textContent = '已取得座標，正在查詢所在的縣市與區…';
  showLocMap();
  setAutoBtn('重新定位', false);

  reverseGeocode(lat, lng).then(function (data) {
    // 等待網路回應的這段時間，使用者可能已經改成手動選地點了，這種情況就不要覆蓋他的選擇
    if (!F.auto || F.lat !== lat || F.lng !== lng) return;
    var m = matchAddress((data && data.address) || {});
    if (m.city && m.dist) {
      F.city = m.city; F.dist = m.dist;
      $('city').value = m.city; fillDist(); $('dist').value = m.dist;
      toast('定位成功：' + m.city + m.dist);
    } else {
      toast('已取得座標，但無法判斷所在行政區，仍可直接用目前位置搜尋');
    }
    locNote();
  }).catch(function () {
    if (!F.auto || F.lat !== lat) return;
    locNote();
    toast('已取得座標，但查詢行政區失敗，仍可直接用目前位置搜尋');
  });
}

/** onLocateError(err)：定位失敗時，依照錯誤原因顯示對應的說明（err.code 是瀏覽器給的錯誤代碼） */
function onLocateError(err) {
  F.auto = false; F.lat = null; F.lng = null; F.acc = 0;
  setAutoBtn('自動定位', false);
  var msg;
  if (err.code === 1) {
    msg = '你拒絕了定位權限。請點網址列左邊的圖示，把「位置」改成允許後再按一次；或直接用下方下拉選單選擇地點。';
  } else if (err.code === 2) {
    msg = '無法取得位置，可能是裝置的定位服務沒開、或訊號不佳。請檢查系統的定位設定，或改用下拉選單。';
  } else if (err.code === 3) {
    msg = '定位逾時，請再按一次「自動定位」，或改用下拉選單。';
  } else {
    msg = '定位失敗，請改用下拉選單選擇地點。';
  }
  $('locNote').textContent = msg;
  toast(msg);
}

$('auto').onclick = function () {
  // 瀏覽器規定：定位只能在「安全環境」使用，也就是 https:// 開頭的網址，或是 localhost / 127.0.0.1
  if (!window.isSecureContext) {
    var m = '定位需要在 https 或 localhost 網址下使用。請用 http://localhost:7777 開啟，不要用 0.0.0.0 或區網 IP。';
    $('locNote').textContent = m; toast(m); return;
  }
  if (!navigator.geolocation) { toast('這個瀏覽器不支援定位，請改用下拉選單'); return; }

  setAutoBtn('定位中…', true);
  $('locNote').textContent = '定位中，請在瀏覽器跳出的視窗按「允許」…';

  navigator.geolocation.getCurrentPosition(onLocated, onLocateError, {
    enableHighAccuracy: true, // 盡量使用高精準度定位（手機會用 GPS）
    timeout: 12000,           // 最多等 12 秒
    maximumAge: 60000         // 1 分鐘內拿過的位置可以直接重用，不用重新定位
  });
};