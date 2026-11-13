/* 這個檔案負責全臺縣市／鄉鎮市區選擇與使用者主動要求的定位。 */
var lastReverseGeocodeRequest = 0;
var locationMap = null;
var locationMarker = null;
var locationAccuracyCircle = null;
var locationTiles = null;

function normalizeAdministrativeName(value) {
  return String(value || '').replace(/台/g, '臺').replace(/\s/g, '').trim();
}

function findAdministrativeName(candidates, names) {
  var i;
  var j;
  var candidate;
  var normalizedCandidate;
  var normalizedName;

  for (i = 0; i < candidates.length; i += 1) {
    normalizedCandidate = normalizeAdministrativeName(candidates[i]);
    if (!normalizedCandidate) {
      continue;
    }

    for (j = 0; j < names.length; j += 1) {
      normalizedName = normalizeAdministrativeName(names[j]);
      if (normalizedCandidate === normalizedName ||
        normalizedCandidate.slice(-normalizedName.length) === normalizedName) {
        return names[j];
      }
    }
  }

  return '';
}

function findTaiwanAddress(address) {
  var cityCandidates = [
    address.county,
    address.city,
    address.municipality,
    address.state_district,
    address.province,
    address.state
  ];
  var city = findAdministrativeName(cityCandidates, Object.keys(TW));
  var districtCandidates = [
    address.city_district,
    address.district,
    address.suburb,
    address.town,
    address.village,
    address.borough,
    address.city
  ];
  var district = city ? findAdministrativeName(districtCandidates, TW[city]) : '';

  return {
    city: city,
    district: district
  };
}

function setLocationHelp(message, isError) {
  var help = $('#location-help');

  help.textContent = message;
  help.classList.toggle('is-error', Boolean(isError));
}

function setLocationButtonBusy(isBusy) {
  var button = $('#locate-me');

  button.disabled = isBusy;
  button.textContent = isBusy ? '定位中…' : '自動定位';
}

function updateLocationMap(latitude, longitude, accuracy) {
  var mapCard = $('#location-map-card');
  var accuracyLabel = $('#location-accuracy');
  var point = [latitude, longitude];
  var safeAccuracy = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0;

  setHidden('location-map-card', false);
  accuracyLabel.textContent = safeAccuracy
    ? '藍色範圍表示定位精度，約 ' + Math.round(safeAccuracy) + ' 公尺。'
    : '目前無法取得定位精度資訊。';

  if (typeof window.L === 'undefined') {
    console.error('Leaflet 地圖程式載入失敗。');
    setLocationHelp('已取得座標，但地圖無法載入；請檢查網路連線或手動選擇地區。', true);
    return;
  }

  if (!locationMap) {
    locationMap = window.L.map('location-map', {
      scrollWheelZoom: false
    });
    locationMap.setView(point, 16);
    locationTiles = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(locationMap);
    locationTiles.on('tileerror', function () {
      setLocationHelp('地圖圖磚載入失敗，請檢查網路連線；位置與行政區仍可使用。', true);
    });
    locationMarker = window.L.marker(point).addTo(locationMap);
    locationAccuracyCircle = window.L.circle(point, {
      radius: safeAccuracy,
      color: '#155e39',
      weight: 2,
      fillColor: '#2da160',
      fillOpacity: 0.18
    }).addTo(locationMap);
  } else {
    locationMarker.setLatLng(point);
    locationAccuracyCircle.setLatLng(point);
    locationAccuracyCircle.setRadius(safeAccuracy);
  }

  window.setTimeout(function () {
    locationMap.invalidateSize();
    if (safeAccuracy > 0) {
      locationMap.fitBounds(locationAccuracyCircle.getBounds(), {
        maxZoom: 16,
        padding: [20, 20]
      });
    } else {
      locationMap.setView(point, 16);
    }
  }, 0);

  mapCard.setAttribute('data-map-ready', 'true');
}

function clearLocatedPosition() {
  F.auto = false;
  F.lat = null;
  F.lng = null;
  F.acc = null;
  setHidden('location-map-card', true);
}

function updateDistrictOptions(city) {
  var districtSelect = $('#dist-select');
  var placeholder = document.createElement('option');
  var districts = TW[city] || [];
  var i;
  var option;

  districtSelect.textContent = '';
  placeholder.value = '';
  placeholder.textContent = districts.length ? '請選擇鄉鎮市區' : '鄉鎮市區';
  districtSelect.appendChild(placeholder);

  for (i = 0; i < districts.length; i += 1) {
    option = document.createElement('option');
    option.value = districts[i];
    option.textContent = districts[i];
    districtSelect.appendChild(option);
  }

  districtSelect.disabled = districts.length === 0;
  F.city = city;
  F.dist = '';
  F.auto = false;
  F.lat = null;
  F.lng = null;
  F.acc = null;
}

function applyLocatedAddress(address, latitude, longitude, accuracy) {
  var match = findTaiwanAddress(address);
  var citySelect = $('#city-select');
  var districtSelect = $('#dist-select');

  if (!match.city) {
    throw new Error('已取得位置，但無法辨識所在縣市。請改用下拉選單選擇。');
  }

  citySelect.value = match.city;
  updateDistrictOptions(match.city);
  F.lat = latitude;
  F.lng = longitude;
  F.acc = accuracy;
  F.auto = true;

  if (match.district) {
    districtSelect.value = match.district;
    F.dist = match.district;
    setLocationHelp('定位完成：' + match.city + match.district + '。', false);
    toast('已定位到 ' + match.city + match.district + '。');
  } else {
    setLocationHelp('已定位到' + match.city + '，請選擇鄉鎮市區。', false);
    toast('已定位到' + match.city + '，請再選擇鄉鎮市區。');
  }
}

function reverseGeocode(latitude, longitude) {
  var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2' +
    '&addressdetails=1&zoom=10&accept-language=zh-TW&countrycodes=tw' +
    '&lat=' + encodeURIComponent(latitude) +
    '&lon=' + encodeURIComponent(longitude);
  var wait = Math.max(0, 1100 - (Date.now() - lastReverseGeocodeRequest));

  return new Promise(function (resolve) {
    window.setTimeout(resolve, wait);
  }).then(function () {
    var controller = window.AbortController ? new AbortController() : null;
    var timeout;
    var request = {
      method: 'GET',
      headers: { Accept: 'application/json' }
    };

    lastReverseGeocodeRequest = Date.now();
    if (controller) {
      request.signal = controller.signal;
      timeout = window.setTimeout(function () {
        controller.abort();
      }, 12000);
    }

    return fetch(url, request).then(function (response) {
      if (!response.ok) {
        throw new Error(response.status === 429
          ? '定位服務目前流量較多，請稍後再試。'
          : '定位服務暫時無法使用，請稍後再試。');
      }
      return response.json();
    }).then(function (result) {
      if (!result || !result.address) {
        throw new Error('定位服務找不到這個位置的行政區，請手動選擇。');
      }
      return result.address;
    }).catch(function (error) {
      if (error.name === 'AbortError') {
        throw new Error('查詢行政區逾時，請稍後再試。');
      }
      throw error;
    }).then(function (address) {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      return address;
    }, function (error) {
      if (timeout) {
        window.clearTimeout(timeout);
      }
      throw error;
    });
  });
}

function locateCurrentPosition() {
  if (!navigator.geolocation) {
    setLocationHelp('此瀏覽器不支援定位功能，請手動選擇縣市與鄉鎮市區。', true);
    toast('此瀏覽器不支援定位功能。');
    return;
  }

  setLocationButtonBusy(true);
  setLocationHelp('正在取得位置；取得後會將座標傳送至 OpenStreetMap Nominatim 查詢行政區。', false);
  navigator.geolocation.getCurrentPosition(function (position) {
    var latitude = position.coords.latitude;
    var longitude = position.coords.longitude;
    var accuracy = position.coords.accuracy;

    F.lat = latitude;
    F.lng = longitude;
    F.acc = accuracy;
    F.auto = true;
    updateLocationMap(latitude, longitude, accuracy);
    reverseGeocode(latitude, longitude).then(function (address) {
      applyLocatedAddress(address, latitude, longitude, accuracy);
    }).catch(function (error) {
      console.error('反向查詢定位行政區失敗。', error);
      setLocationHelp(error.message || '無法查詢定位所在的行政區，請手動選擇。', true);
      toast(error.message || '無法查詢定位所在的行政區，請手動選擇。');
    }).then(function () {
      setLocationButtonBusy(false);
    });
  }, function (error) {
    var message;

    if (error.code === error.PERMISSION_DENIED) {
      message = '你尚未允許瀏覽器使用位置。請在網站權限中允許定位，或手動選擇地區。';
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      message = '目前無法取得裝置位置，請確認定位服務已開啟，或手動選擇地區。';
    } else {
      message = '取得位置逾時，請再試一次或手動選擇地區。';
    }

    setLocationButtonBusy(false);
    setLocationHelp(message, true);
    toast(message);
  }, {
    enableHighAccuracy: true,
    maximumAge: 300000,
    timeout: 15000
  });
}

function populateCityOptions() {
  var citySelect = $('#city-select');
  var cities = Object.keys(TW);
  var i;
  var option;

  for (i = 0; i < cities.length; i += 1) {
    option = document.createElement('option');
    option.value = cities[i];
    option.textContent = cities[i];
    citySelect.appendChild(option);
  }
}

document.addEventListener('change', function (event) {
  if (event.target.id === 'city-select') {
    clearLocatedPosition();
    updateDistrictOptions(event.target.value);
    setLocationHelp('已選擇' + (event.target.value || '縣市') + '，請選擇鄉鎮市區。', false);
  } else if (event.target.id === 'dist-select') {
    F.dist = event.target.value;
    clearLocatedPosition();
    setLocationHelp(F.dist ? '已選擇' + F.city + F.dist + '。' : '請選擇鄉鎮市區。', false);
  }
});

$('#locate-me').addEventListener('click', locateCurrentPosition);
populateCityOptions();
