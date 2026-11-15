/* 這個檔案只負責呼叫本站 API，並在沒有結果時逐步擴大搜尋範圍。 */
function restaurantApiError(status, message) {
  var error = new Error(message);
  error.status = status;
  return error;
}

function fetchRestaurantsAtRadius(options, radius) {
  var params = new URLSearchParams({
    category: options.category,
    lat: String(options.lat),
    lng: String(options.lng),
    radius: String(radius),
    veg: options.vegOnly ? '1' : '0',
    vegMode: options.vegMode || 'include'
  });

  return fetch('/api/restaurants?' + params.toString(), {
    headers: { Accept: 'application/json' }
  }).then(function (response) {
    return response.json().catch(function () {
      throw restaurantApiError(response.status, '搜尋服務回傳的資料無法讀取，請重試。');
    }).then(function (body) {
      if (!response.ok) {
        throw restaurantApiError(
          response.status,
          body.detail || '餐廳搜尋失敗，請稍後重試。'
        );
      }
      if (!body || !Array.isArray(body.restaurants)) {
        throw restaurantApiError(response.status, '搜尋服務回傳的資料格式不正確。');
      }
      return {
        restaurants: body.restaurants,
        usedRadius: Number(body.usedRadius) || radius
      };
    });
  }).catch(function (error) {
    if (error.status) {
      throw error;
    }
    throw restaurantApiError(0, '網路連線失敗，請檢查網路後重試。');
  });
}

// 先查原本半徑；沒有結果才依序查兩倍、三倍，最大不超過十公里。
function searchRestaurants(options) {
  var originalRadius = Number(options.radius);
  var radii = [originalRadius];
  var doubledRadius = Math.min(originalRadius * 2, 10000);
  var tripledRadius = Math.min(originalRadius * 3, 10000);

  if (doubledRadius > originalRadius) {
    radii.push(doubledRadius);
  }
  if (tripledRadius > originalRadius && radii.indexOf(tripledRadius) === -1) {
    radii.push(tripledRadius);
  }

  function searchAt(index) {
    return fetchRestaurantsAtRadius(options, radii[index]).then(function (result) {
      if (result.restaurants.length || index === radii.length - 1) {
        result.requestedRadius = originalRadius;
        return result;
      }
      return searchAt(index + 1);
    });
  }

  return searchAt(0);
}
