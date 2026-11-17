/* 這個檔案負責搜尋流程、結果卡片、錯誤狀態和本機餐廳合併。 */
var lastRestaurantSearch = null;
var restaurantSearchInProgress = false;
var restaurantResults = [];
var visibleRestaurantResults = [];
var restaurantUsedRadius = null;
var restaurantSortMode = 'distance';
var restaurantFavoritesOnly = false;
var restaurantMap = null;
var restaurantMapTiles = null;
var alternateVegetarianSearch = null;

function setRestaurantSearchState(state, message) {
  // 只切換 HTML 元件的顯示狀態，外觀統一交給 CSS。
  setHidden('restaurant-loading', state !== 'loading');
  setHidden('restaurant-error', state !== 'error');
  setHidden('restaurant-empty', state !== 'empty');
  setHidden('restaurant-list', state !== 'results');
  setHidden('restaurant-retry', state !== 'error');
  if (message) {
    $('#restaurant-error-message').textContent = message;
  }
}

function isRestaurantBlacklisted(restaurant) {
  // 黑名單留在本機比對，不會隨搜尋請求送到後端。
  return S.bl.some(function (entry) {
    if (typeof entry === 'string') {
      return entry === restaurant.name;
    }
    return Boolean(entry && (
      entry.id === restaurant.id || getListEntryName(entry) === restaurant.name
    ));
  });
}

function isRestaurantFavorite(restaurant) {
  return S.fav.some(function (entry) {
    if (typeof entry === 'string') {
      return entry === restaurant.name;
    }
    return Boolean(entry && (
      entry.id === restaurant.id || getListEntryName(entry) === restaurant.name
    ));
  });
}

function localRestaurantsForCategory(category, vegOnly) {
  // 自訂餐廳只從本機狀態讀取，不會送到後端，也不因轉盤分類而遺失。
  return S.custR.filter(function (restaurant) {
    return !vegOnly || restaurant.vegetarian;
  }).map(function (restaurant, index) {
    return {
      id: 'custom-' + index + '-' + restaurant.name,
      name: restaurant.name,
      category: restaurant.type || category,
      lat: null,
      lng: null,
      distance: null,
      isVeg: restaurant.vegetarian ? true : null,
      vegLevel: restaurant.vegetarian ? 'friendly' : 'unknown',
      address: restaurant.address,
      rating: null,
      ratingCount: null,
      mapUrl: 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent([restaurant.name, restaurant.address].join(' '))
    };
  });
}

function appendTextElement(parent, tagName, className, text) {
  var element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function renderRestaurantCard(restaurant) {
  var item = document.createElement('li');
  var heading = document.createElement('div');
  var name = document.createElement('h2');
  var rating;
  var ratingStars;
  var ratingValue;
  var details;
  var travelTimes;
  var tags;
  var actions;
  var favoriteButton;
  var blacklistButton;
  var mapLink;
  var ratingText;
  var distanceText;
  var distanceInMeters;
  var distance = restaurant.distance;

  item.className = 'entry-card restaurant-card' +
    (Number.isFinite(restaurant.rating) ? '' : ' has-no-rating');
  heading.className = 'restaurant-card-heading';
  name.textContent = restaurant.name;
  heading.appendChild(name);

  rating = document.createElement('div');
  rating.className = Number.isFinite(restaurant.rating)
    ? 'restaurant-rating'
    : 'restaurant-rating is-unrated';
  if (Number.isFinite(restaurant.rating)) {
    ratingStars = appendTextElement(
      rating,
      'span',
      'restaurant-rating-stars',
      Array(Math.round(restaurant.rating) + 1).join('★') +
        Array(6 - Math.round(restaurant.rating)).join('☆')
    );
    ratingStars.setAttribute('aria-hidden', 'true');
    ratingValue = document.createElement('span');
    ratingValue.textContent = restaurant.rating.toFixed(1) + ' (' +
      (Number(restaurant.ratingCount) || 0) + ')';
    rating.appendChild(ratingValue);
    ratingText = '評分 ' + restaurant.rating.toFixed(1) + '，' +
      (Number(restaurant.ratingCount) || 0) + ' 則評論';
    rating.setAttribute('aria-label', ratingText);
  } else {
    rating.textContent = '尚無評分';
  }
  heading.appendChild(rating);

  distanceInMeters = Number.isFinite(distance) ? Math.round(distance) : null;
  distanceText = distanceInMeters === null
    ? '自訂餐廳'
    : distanceInMeters >= 1000
      ? (distanceInMeters / 1000).toFixed(1) + ' 公里'
      : distanceInMeters + ' 公尺';

  details = document.createElement('p');
  details.className = 'restaurant-meta';
  details.textContent = [restaurant.category, distanceText]
    .filter(Boolean).join('・');
  appendTextElement(details, 'span', 'restaurant-status', '營業狀態未提供');

  item.appendChild(heading);
  item.appendChild(details);

  travelTimes = document.createElement('div');
  travelTimes.className = 'restaurant-travel-times';
  travelTimes.setAttribute('aria-label', '預估交通時間');
  if (Number.isFinite(distance)) {
    appendTextElement(travelTimes, 'span', 'restaurant-time restaurant-time-walk', '🚶 ' +
      Math.ceil(distance / 67) + ' 分');
    appendTextElement(travelTimes, 'span', 'restaurant-time restaurant-time-bike', '🛵 ' +
      Math.ceil(distance / 250) + ' 分');
    appendTextElement(travelTimes, 'span', 'restaurant-time restaurant-time-drive', '🚗 ' +
      Math.ceil(distance / 500) + ' 分');
  } else {
    appendTextElement(travelTimes, 'span', 'restaurant-time', '自訂餐廳');
  }
  item.appendChild(travelTimes);

  tags = document.createElement('div');
  tags.className = 'restaurant-tags';
  appendTextElement(tags, 'span', 'restaurant-tag', restaurant.category || '附近餐廳');
  if (restaurant.vegLevel === 'specialty') {
    appendTextElement(tags, 'span', 'restaurant-tag', '素食專門店');
  } else if (restaurant.vegLevel === 'friendly') {
    appendTextElement(tags, 'span', 'restaurant-tag', '有素食選項');
  } else {
    appendTextElement(tags, 'span', 'restaurant-tag',
      '素食資訊未確認，建議先電話確認');
  }
  item.appendChild(tags);

  actions = document.createElement('div');
  actions.className = 'restaurant-card-actions';

  mapLink = document.createElement('a');
  mapLink.className = 'entry-action restaurant-map-link';
  mapLink.href = restaurant.mapUrl;
  mapLink.target = '_blank';
  mapLink.rel = 'noopener noreferrer';
  mapLink.textContent = '導航';
  mapLink.setAttribute('aria-label', '導航至 ' + restaurant.name);

  favoriteButton = document.createElement('button');
  favoriteButton.className = 'restaurant-icon-button restaurant-favorite-button';
  favoriteButton.type = 'button';
  favoriteButton.textContent = isRestaurantFavorite(restaurant) ? '♥' : '♡';
  favoriteButton.setAttribute('data-restaurant-action', 'favorite');
  favoriteButton.setAttribute('data-restaurant-id', restaurant.id);
  favoriteButton.setAttribute('aria-pressed', String(isRestaurantFavorite(restaurant)));
  favoriteButton.setAttribute('aria-label',
    (isRestaurantFavorite(restaurant) ? '取消收藏 ' : '收藏 ') + restaurant.name);

  blacklistButton = document.createElement('button');
  blacklistButton.className = 'restaurant-icon-button';
  blacklistButton.type = 'button';
  blacklistButton.textContent = '⊘';
  blacklistButton.setAttribute('data-restaurant-action', 'blacklist');
  blacklistButton.setAttribute('data-restaurant-id', restaurant.id);
  blacklistButton.setAttribute('aria-label', '將 ' + restaurant.name + ' 加入黑名單');

  actions.appendChild(mapLink);
  actions.appendChild(favoriteButton);
  actions.appendChild(blacklistButton);
  item.appendChild(actions);
  return item;
}

function restaurantLocationLabel() {
  if (F.auto) {
    return F.city && F.dist ? F.city + F.dist : '目前位置附近';
  }
  return [F.city, F.dist].filter(Boolean).join('');
}

function updateRadiusNotice(result) {
  var notice = $('#restaurant-radius-notice');
  var expanded = result.usedRadius > result.requestedRadius;

  notice.textContent = expanded
    ? Math.round(result.requestedRadius / 1000) + ' 公里內沒有找到，已擴大到 ' +
      (result.usedRadius >= 1000
        ? (result.usedRadius / 1000) + ' 公里'
        : result.usedRadius + ' 公尺')
    : '';
  setHidden('restaurant-radius-notice', !expanded);
}

function updateRestaurantMapCount() {
  var mapCount = visibleRestaurantResults.filter(function (restaurant) {
    return Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng);
  }).length;

  $('#restaurant-map-count').textContent = mapCount + ' 家';
  $('#restaurant-map-open').disabled = mapCount === 0;
}

function renderRestaurantResults() {
  var list = $('#restaurant-list');
  var restaurants = restaurantResults.slice();
  var mapButton = $('#restaurant-map-open');
  var i;

  restaurants = restaurants.filter(function (restaurant) {
    return !isRestaurantBlacklisted(restaurant);
  });
  if (restaurantFavoritesOnly) {
    restaurants = restaurants.filter(isRestaurantFavorite);
  }
  restaurants.sort(function (a, b) {
    if (lastRestaurantSearch && lastRestaurantSearch.vegOnly) {
      var vegRank = { specialty: 0, friendly: 1, unknown: 2 };
      var vegDifference = (vegRank[a.vegLevel] === undefined ? 2 : vegRank[a.vegLevel]) -
        (vegRank[b.vegLevel] === undefined ? 2 : vegRank[b.vegLevel]);
      if (vegDifference) {
        return vegDifference;
      }
    }
    if (restaurantSortMode === 'rating') {
      if (Number.isFinite(a.rating) && Number.isFinite(b.rating)) {
        return b.rating - a.rating ||
          (Number(b.ratingCount) || 0) - (Number(a.ratingCount) || 0);
      }
      if (Number.isFinite(a.rating)) {
        return -1;
      }
      if (Number.isFinite(b.rating)) {
        return 1;
      }
    }
    return (Number.isFinite(a.distance) ? a.distance : Infinity) -
      (Number.isFinite(b.distance) ? b.distance : Infinity);
  });

  visibleRestaurantResults = restaurants;
  list.textContent = '';
  for (i = 0; i < restaurants.length; i += 1) {
    list.appendChild(renderRestaurantCard(restaurants[i]));
  }

  $('#restaurant-sort-distance').classList.toggle('is-selected', restaurantSortMode === 'distance');
  $('#restaurant-sort-distance').setAttribute('aria-pressed',
    String(restaurantSortMode === 'distance'));
  $('#restaurant-sort-rating').classList.toggle('is-selected', restaurantSortMode === 'rating');
  $('#restaurant-sort-rating').setAttribute('aria-pressed',
    String(restaurantSortMode === 'rating'));
  $('#restaurant-filter-favorites').classList.toggle('is-selected', restaurantFavoritesOnly);
  $('#restaurant-filter-favorites').setAttribute('aria-pressed',
    String(restaurantFavoritesOnly));
  $('#restaurant-search-summary').textContent = '找到 ' + restaurants.length +
    ' 家・' + (restaurantLocationLabel() || '附近') +
    '・範圍 ' + ((restaurantUsedRadius || F.rng) >= 1000
      ? ((restaurantUsedRadius || F.rng) / 1000) + ' 公里'
      : (restaurantUsedRadius || F.rng) + ' 公尺');
  setHidden('restaurant-filter-empty',
    !(restaurantFavoritesOnly && !restaurants.length));
  if (restaurants.length) {
    setHidden('restaurant-veg-fallback', true);
  }
  setHidden('restaurant-empty',
    restaurantFavoritesOnly || restaurants.length > 0);
  setHidden('restaurant-list', !restaurants.length);
  setHidden('restaurant-loading', true);
  setHidden('restaurant-error', true);
  setHidden('restaurant-retry', true);
  setHidden('restaurant-map-open', !restaurants.length);
  mapButton.classList.toggle('is-visible', restaurants.length > 0);
  updateRestaurantMapCount();
}

function runRestaurantSearch() {
  var category = selectedWheelCategory;
  var location = getSelectedSearchLocation();
  var vegOnly;
  var options;
  var localRestaurants;
  var alternateOptions;
  var alternateMode;

  if (restaurantSearchInProgress) {
    return;
  }
  if (!category) {
    toast('請先轉出料理類型，再搜尋附近餐廳。');
    return;
  }
  if (!location) {
    toast('請先選擇縣市和鄉鎮市區，或使用自動定位。');
    return;
  }

  vegOnly = F.meat === 'veg' || Boolean(category.vegetarianOnly);
  options = {    //冒號左邊是物件裡的欄位名稱，右邊是要放進去的值。
                 //例如 category 是欄位名稱，category.label 是它的值。
    category: category.label,  //要找哪一種料理。
    lat: location.lat,         //搜尋中心點的緯度。
    lng: location.lng,         //搜尋中心點的緯度。
    radius: F.rng,             //搜尋半徑，單位是公尺。
    vegOnly: vegOnly,          //是否只搜尋素食餐廳。
    vegMode: vegOnly ? F.vegMode : 'include' //條件判斷式。若 vegOnly 是 true，就使用使用者選的 F.vegMode；否則使用 'include'，表示不套用額外的素食模式限制。
  };
  lastRestaurantSearch = options;
  alternateVegetarianSearch = null;
  restaurantSearchInProgress = true;
  setRestaurantSearchState('loading');
  setHidden('restaurant-filter-empty', true);
  setHidden('restaurant-veg-fallback', true);
  setHidden('restaurant-map-open', true);
  setHidden('restaurant-location-note', !location.approximate);
  setHidden('restaurant-radius-notice', true);
  restaurantSortMode = 'distance';
  restaurantFavoritesOnly = false;
  restaurantUsedRadius = null;
  $('#restaurants-title').textContent = '附近餐廳・' + category.label;
  go('restaurants');

  searchRestaurants(options).then(function (result) {
    localRestaurants = localRestaurantsForCategory(category.label, vegOnly);
    restaurantResults = result.restaurants.concat(localRestaurants);
    restaurantUsedRadius = result.usedRadius;
    updateRadiusNotice(result);
    renderRestaurantResults();

    if (F.meat !== 'veg' || restaurantResults.some(function (restaurant) {
      return !isRestaurantBlacklisted(restaurant);
    })) {
      return;
    }

    alternateMode = options.vegMode === 'specialty' ? 'include' : 'specialty';
    alternateOptions = Object.assign({}, options, { vegMode: alternateMode });
    searchRestaurants(alternateOptions).then(function (alternateResult) {
      var alternativeRestaurants = alternateResult.restaurants.concat(localRestaurants);
      if (!alternativeRestaurants.some(function (restaurant) {
        return !isRestaurantBlacklisted(restaurant);
      })) {
        return;
      }

      alternateVegetarianSearch = {
        options: alternateOptions,
        result: alternateResult,
        category: category.label,
        vegOnly: vegOnly
      };
      $('#restaurant-veg-fallback-message').textContent =
        options.vegMode === 'specialty'
          ? '附近找不到素食專門店；改為包含有素食選項的店後可以找到餐廳。'
          : '附近找不到有素食選項的店；只看素食專門店後可以找到餐廳。';
      setHidden('restaurant-veg-fallback', false);
    }).catch(function (error) {
      console.warn('查詢另一種素食搜尋方式失敗。', error);
    });
  }).catch(function (error) {
    var message = error.message || '餐廳搜尋失敗，請稍後重試。';
    console.error('餐廳搜尋失敗，HTTP 狀態：' + (error.status || 'network'));
    setRestaurantSearchState('error', message);
  }).then(function () {
    restaurantSearchInProgress = false;
  });
}

// 使用者可從轉盤結果直接搜尋；失敗後重試沿用同一組條件。
$('#find-restaurants').addEventListener('click', runRestaurantSearch);
$('#restaurant-retry').addEventListener('click', function () {
  if (lastRestaurantSearch && selectedWheelCategory) {
    runRestaurantSearch();
  }
});

$('#restaurant-veg-switch').addEventListener('click', function () {
  if (!alternateVegetarianSearch) {
    return;
  }

  setVegetarianModeSelection(alternateVegetarianSearch.options.vegMode);
  lastRestaurantSearch = alternateVegetarianSearch.options;
  restaurantResults = alternateVegetarianSearch.result.restaurants.concat(
    localRestaurantsForCategory(
      alternateVegetarianSearch.category,
      alternateVegetarianSearch.vegOnly
    )
  );
  restaurantUsedRadius = alternateVegetarianSearch.result.usedRadius;
  updateRadiusNotice(alternateVegetarianSearch.result);
  setHidden('restaurant-veg-fallback', true);
  alternateVegetarianSearch = null;
  renderRestaurantResults();
});

$('#restaurant-sort-distance').addEventListener('click', function () {
  restaurantSortMode = 'distance';
  renderRestaurantResults();
});

$('#restaurant-sort-rating').addEventListener('click', function () {
  restaurantSortMode = 'rating';
  renderRestaurantResults();
});

$('#restaurant-filter-favorites').addEventListener('click', function () {
  restaurantFavoritesOnly = !restaurantFavoritesOnly;
  renderRestaurantResults();
});

$('#restaurant-list').addEventListener('click', function (event) {
  var button = event.target;
  var action;
  var restaurantId;
  var restaurant;
  var entry;
  var existingIndex;

  while (button && button !== this && !button.hasAttribute('data-restaurant-action')) {
    button = button.parentNode;
  }
  if (button === this || !button.hasAttribute('data-restaurant-action')) {
    return;
  }

  action = button.getAttribute('data-restaurant-action');
  restaurantId = button.getAttribute('data-restaurant-id');
  restaurant = restaurantResults.filter(function (item) {
    return String(item.id) === restaurantId;
  })[0];
  if (!restaurant) {
    console.error('找不到餐廳操作項目：' + restaurantId);
    return;
  }

  if (action === 'favorite') {
    existingIndex = S.fav.findIndex(function (favorite) {
      return favorite && typeof favorite === 'object' &&
        (favorite.id === restaurant.id || getListEntryName(favorite) === restaurant.name);
    });
    if (existingIndex >= 0 || S.fav.indexOf(restaurant.name) >= 0) {
      if (existingIndex >= 0) {
        S.fav.splice(existingIndex, 1);
      } else {
        S.fav.splice(S.fav.indexOf(restaurant.name), 1);
      }
      toast('已從我的最愛移除。');
    } else {
      entry = {
        id: restaurant.id,
        name: restaurant.name,
        type: restaurant.category,
        address: restaurant.address,
        mapUrl: restaurant.mapUrl
      };
      S.fav.push(entry);
      toast('已加入我的最愛。');
    }
    save();
    renderSavedList('fav');
  } else if (action === 'blacklist') {
    S.bl.push({
      id: restaurant.id,
      name: restaurant.name,
      type: restaurant.category,
      address: restaurant.address,
      mapUrl: restaurant.mapUrl
    });
    save();
    renderSavedList('bl');
    toast('已加入黑名單，並從目前結果移除。');
  } else {
    console.error('未知的餐廳操作：' + action);
    return;
  }

  renderRestaurantResults();
});

function closeRestaurantMap() {
  setHidden('restaurant-map-dialog', true);
  $('#restaurant-map-open').focus();
}

function openRestaurantMap() {
  var entries = visibleRestaurantResults.filter(function (restaurant) {
    return Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng);
  });
  var bounds;
  var marker;
  var popup;
  var title;
  var link;
  var i;

  if (!entries.length) {
    toast('目前沒有可顯示在地圖上的餐廳位置。');
    return;
  }
  if (typeof window.L === 'undefined') {
    console.error('Leaflet 地圖程式載入失敗。');
    toast('地圖無法載入，請檢查網路連線後重試。');
    return;
  }

  setHidden('restaurant-map-dialog', false);
  $('#restaurant-map-close').focus();
  if (!restaurantMap) {
    restaurantMap = window.L.map('restaurant-map-canvas', {
      scrollWheelZoom: false
    });
    restaurantMapTiles = window.L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      }
    ).addTo(restaurantMap);
    restaurantMapTiles.once('tileerror', function () {
      console.error('附近餐廳地圖圖磚載入失敗。');
      toast('地圖圖磚載入失敗，請檢查網路連線。');
    });
  }

  restaurantMap.eachLayer(function (layer) {
    if (layer instanceof window.L.Marker) {
      restaurantMap.removeLayer(layer);
    }
  });
  bounds = [];
  for (i = 0; i < entries.length; i += 1) {
    marker = window.L.marker([entries[i].lat, entries[i].lng]).addTo(restaurantMap);
    popup = document.createElement('div');
    title = document.createElement('strong');
    title.textContent = entries[i].name;
    popup.appendChild(title);
    link = document.createElement('a');
    link.href = entries[i].mapUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '開啟導航';
    popup.appendChild(link);
    marker.bindPopup(popup);
    bounds.push([entries[i].lat, entries[i].lng]);
  }

  window.setTimeout(function () {
    restaurantMap.invalidateSize();
    if (bounds.length === 1) {
      restaurantMap.setView(bounds[0], 16);
    } else {
      restaurantMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    }
  }, 0);
}

$('#restaurant-map-open').addEventListener('click', openRestaurantMap);
$('#restaurant-map-close').addEventListener('click', closeRestaurantMap);
$('#restaurant-map-dialog').addEventListener('click', function (event) {
  if (event.target === this) {
    closeRestaurantMap();
  }
});
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' &&
    !$('#restaurant-map-dialog').classList.contains('hidden')) {
    closeRestaurantMap();
  }
});
