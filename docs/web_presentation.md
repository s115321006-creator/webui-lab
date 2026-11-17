# 今天吃什麼？功能與程式流程

本專案是單頁式餐廳推薦網站。所有主要畫面預先放在 `html/index.html`，前端 JavaScript 負責切換畫面、更新資料和處理互動；FastAPI 提供餐廳搜尋 API 與靜態檔案。

## 1. 功能一覽

- 依葷素、素食方式、主食、縣市／行政區及搜尋半徑篩選料理。
- 以轉盤隨機抽出料理類型，可重新抽選。
- 搜尋附近餐廳，檢視評分、距離、素食資訊，並可排序、篩選收藏或開啟地圖。
- 將餐廳加入最愛或黑名單；黑名單餐廳不會出現在推薦結果。
- 建立自訂轉盤類型和自訂餐廳。
- 以瀏覽器 `localStorage` 保存最愛、黑名單及自訂資料。

## 2. 檔案與主要職責

| 檔案 | 職責 |
|---|---|
| `html/index.html` | 首頁、篩選、轉盤、餐廳結果、最愛、黑名單和自製轉盤的 HTML 結構。 |
| `css/style.css` | 網站版面、按鈕、餐廳卡片、地圖和響應式樣式。 |
| `js/core.js` | 讀寫 `localStorage`、共用狀態 `S` 和 `F`、畫面切換、提示訊息。 |
| `js/data.js` | 縣市／行政區資料與中心座標、載入料理分類、選擇搜尋位置。 |
| `js/filter.js` | 處理葷素、素食方式、主食及搜尋範圍篩選。 |
| `js/location.js` | 行政區選單、瀏覽器定位、Nominatim 行政區反查及 Leaflet 位置圖。 |
| `js/wheel.js` | 依篩選條件建立料理選項、繪製 SVG 轉盤及抽選結果。 |
| `js/api.js` | 呼叫餐廳搜尋 API，並在無結果時逐步擴大搜尋半徑。 |
| `js/restaurants.js` | 顯示餐廳結果、排序、最愛／黑名單操作、餐廳地圖。 |
| `js/lists.js` | 顯示最愛與黑名單，移除清單項目並更新首頁數量。 |
| `js/custom.js` | 新增、顯示及刪除自訂類型與自訂餐廳。 |
| `server.py` | FastAPI 靜態檔案服務及 `/api/restaurants` 搜尋 API。 |
| `site/data/categories.json` | 共用料理分類與分類搜尋條件。 |

## 3. 頁面載入流程

1. 瀏覽器讀取 `html/index.html`，建立所有畫面；首頁初始顯示。
2. 依序載入 Leaflet 和專案 JavaScript：

   ```text
   data.js → core.js → location.js → filter.js → wheel.js
   → api.js → restaurants.js → custom.js → lists.js
   ```

3. `data.js` 載入料理分類資料；`core.js` 從 `localStorage` 還原使用者清單。
4. `location.js` 建立縣市選單；`filter.js` 註冊篩選事件。
5. `wheel.js` 依料理分類資料建立轉盤；其他功能檔案則註冊搜尋、清單與自訂表單事件。
6. 餐廳搜尋不會在載入時自動執行；使用者按下「喜歡，找餐廳」後才發出搜尋請求。

## 4. 主要互動流程

以下依使用者操作說明事件如何從畫面傳到對應函式，以及畫面、資料和網路請求的變化。

### 4.1 頁面導覽

[Interaction]

- **Event:** 點擊首頁導覽按鈕或各畫面的返回按鈕。
- **Listener:** `core.js` 的 `document.click` 委派事件，往上尋找 `data-go` 屬性。
- **Function:** `go(id)`；前往最愛或黑名單時，`lists.js` 也會重繪相應清單。
- **DOM target:** `.scr` 畫面及 `data-go` 指定的目標畫面。
- **DOM change:** 清除所有畫面的 `.on`，只替目標畫面加上 `.on`，並捲回頁面頂端。
- **UI result:** 顯示首頁、篩選、轉盤、餐廳結果、最愛、黑名單或自製轉盤。
- **Possible side effect:** 不呼叫 API；進入最愛／黑名單時會依目前 `S` 重建清單 DOM。

### 4.2 篩選條件

[Interaction]

- **Event:** 點擊葷素、素食方式、主食或搜尋半徑按鈕。
- **Listener:** `filter.js` 的 `document.click` 委派事件，尋找 `data-filter-group`。
- **Function:** 單選呼叫 `selectSingleChoice()`；主食多選呼叫 `toggleStapleChoice()`；素食方式由 `setVegetarianModeSelection()` 更新。
- **DOM target:** `[data-filter-group]` 篩選按鈕及 `#vegetarian-mode-options`。
- **DOM change:** 更新按鈕的 `.is-selected`、`aria-pressed`，並將條件寫入記憶體中的 `F`；選擇素食時顯示素食搜尋方式。
- **UI result:** 按鈕即時反映目前條件。
- **Possible side effect:** 不立即搜尋、不寫入 `localStorage`；條件會在開始轉盤及餐廳搜尋時使用。

### 4.3 手動選擇縣市與行政區

[Interaction]

- **Event:** 更改 `#city-select` 或 `#dist-select` 的選項。
- **Listener:** `location.js` 的 `document.change` 委派事件。
- **Function:** 縣市變更時呼叫 `clearLocatedPosition()`、`updateDistrictOptions()`；行政區變更時更新 `F.dist`。
- **DOM target:** `#city-select`、`#dist-select`、位置提示和位置地圖區塊。
- **DOM change:** 依縣市重建行政區選單、設定 `F.city`／`F.dist`，並清除舊的自動定位座標。
- **UI result:** 顯示目前選擇的行政區及下一步提示。
- **Possible side effect:** 不呼叫餐廳搜尋 API；搜尋中心會在後續透過 `getSelectedSearchLocation()` 取得。

### 4.4 自動定位

[Interaction]

- **Event:** 點擊「自動定位」。
- **Listener:** `#locate-me.click`。
- **Function:** `locateCurrentPosition()` 取得瀏覽器座標，接著呼叫 `reverseGeocode()` 查詢行政區，成功後由 `applyLocatedAddress()` 更新位置狀態。
- **DOM target:** `#locate-me`、`#location-help`、縣市／行政區選單、`#location-map-card` 和 `#location-map`。
- **DOM change:** 顯示定位中狀態；取得位置後更新 `F.lat`、`F.lng`、`F.acc`、`F.auto`，並在 Leaflet 地圖加入位置標記及精度範圍。
- **UI result:** 顯示辨識出的縣市／行政區；定位或反查失敗時顯示錯誤，仍可改用手動選擇。
- **Possible side effect:** 使用瀏覽器 Geolocation API；座標會送至 OpenStreetMap Nominatim 反查行政區，並向 OpenStreetMap 載入地圖圖磚。

### 4.5 開始轉盤與重新抽選

[Interaction]

- **Event:** 點擊「開始轉」或轉盤結果頁的「不喜歡，重轉」。
- **Listener:** `#start-spin.click` 和 `#spin-again.click`。
- **Function:** 開始時先用 `getWheelOptions()` 依 `F` 篩選料理，再由 `renderWheel()` 繪圖、`spinWheel()` 抽選；動畫完成後由 `finishSpin()` 顯示結果。重轉直接呼叫 `spinWheel()`。
- **DOM target:** `#wheel-graphic`、`#wheel-result`、`#wheel-result-actions`、`#spin-again`。
- **DOM change:** 更新 SVG 扇形、旋轉角度、動畫狀態、按鈕文字和抽中的料理名稱。
- **UI result:** 轉盤停止後顯示「今天吃」的料理類型，並提供重轉及找餐廳按鈕。
- **Possible side effect:** 篩選未選主食或沒有可抽料理時只顯示提示；轉盤不呼叫餐廳 API，也不寫入使用者清單。

### 4.6 搜尋附近餐廳

[Interaction]

- **Event:** 點擊轉盤結果頁的「喜歡，找餐廳」。
- **Listener:** `#find-restaurants.click`。
- **Function:** `runRestaurantSearch()` 驗證抽選類型與搜尋位置，組合搜尋條件後呼叫 `searchRestaurants()`；該函式會依序呼叫 `fetchRestaurantsAtRadius()`。
- **DOM target:** `#restaurants`、搜尋摘要、載入／錯誤／空結果狀態、`#restaurant-list` 和半徑提示。
- **DOM change:** 切換到餐廳結果頁，顯示載入狀態；成功後合併本機自訂餐廳、排除黑名單、排序並繪製結果卡片。
- **UI result:** 顯示附近餐廳；若原半徑沒有結果，會以更大半徑重試，最高 10 公里。
- **Possible side effect:** 前端呼叫本站 `GET /api/restaurants`；後端驗證參數、限流、查快取，再查 Google Places API (New) 或 OpenStreetMap Overpass。若素食條件沒有可顯示結果，系統會嘗試另一種素食搜尋方式。

### 4.7 餐廳搜尋失敗、素食方式切換、排序與收藏篩選

[Interaction]

- **Event:** 搜尋失敗後點「重試」、點「切換搜尋方式」、選擇距離／評分排序，或切換「已收藏」篩選。
- **Listener:** `#restaurant-retry.click`、`#restaurant-veg-switch.click`、排序及收藏篩選按鈕的 click listener。
- **Function:** 依操作呼叫 `runRestaurantSearch()`、`setVegetarianModeSelection()` 或更新排序／篩選狀態後呼叫 `renderRestaurantResults()`。
- **DOM target:** `#restaurant-error`、`#restaurant-veg-fallback`、排序按鈕、`#restaurant-filter-favorites` 和 `#restaurant-list`。
- **DOM change:** 更新錯誤／替代搜尋提示、選取樣式及結果卡片順序或顯示範圍。
- **UI result:** 可重試搜尋、查看另一種素食條件結果、依距離或評分排序，或只看已收藏餐廳。
- **Possible side effect:** 重試和替代搜尋會再次呼叫餐廳 API；排序和收藏篩選只更新目前記憶體中的結果。

### 4.8 餐廳卡片：最愛、黑名單與導航

[Interaction]

- **Event:** 點擊餐廳卡片上的最愛或黑名單操作，或點擊導航連結。
- **Listener:** `#restaurant-list.click` 事件委派，依按鈕的 `data-restaurant-action` 判斷操作；導航使用卡片上的連結。
- **Function:** 事件處理器更新 `S.fav` 或 `S.bl`，呼叫 `save()`、`renderSavedList()` 和 `renderRestaurantResults()`。
- **DOM target:** `#restaurant-list`、最愛／黑名單清單、首頁清單數量及 toast。
- **DOM change:** 更新收藏／黑名單資料並重繪卡片；加入黑名單的餐廳會從目前結果消失。
- **UI result:** 顯示已收藏、已移除或已加入黑名單的提示；導航連結開啟 Google Maps。
- **Possible side effect:** 清單異動寫入瀏覽器 `localStorage`；導航會在新分頁開啟外部 Google Maps 網址。

### 4.9 餐廳結果地圖

[Interaction]

- **Event:** 點擊「查看地圖」、關閉按鈕、地圖對話框遮罩，或在地圖開啟時按 Escape。
- **Listener:** `#restaurant-map-open.click`、`#restaurant-map-close.click`、對話框 click 及 `document.keydown`。
- **Function:** `openRestaurantMap()` 建立或更新 Leaflet 地圖；`closeRestaurantMap()` 關閉地圖並將焦點送回開啟按鈕。
- **DOM target:** `#restaurant-map-dialog`、`#restaurant-map-canvas`、`#restaurant-map-close`、`#restaurant-map-open`。
- **DOM change:** 顯示／隱藏地圖對話框，在地圖上建立餐廳標記、資訊 popup 和導航連結。
- **UI result:** 可在地圖查看有座標的搜尋結果，並從標記開啟導航。
- **Possible side effect:** 載入 OpenStreetMap 地圖圖磚；沒有座標餐廳時不開啟地圖並顯示提示。

### 4.10 最愛與黑名單清單

[Interaction]

- **Event:** 從首頁進入最愛／黑名單，或點擊清單項目的「移除」。
- **Listener:** `lists.js` 的 `document.click` 委派事件。
- **Function:** 進入清單時呼叫 `renderSavedList()`；移除時檢查索引、修改 `S.fav` 或 `S.bl`，再保存並重繪。
- **DOM target:** `#favorites-list`、`#blacklist-list`、空清單提示和首頁數量。
- **DOM change:** 建立或移除清單項目，更新空狀態和首頁項目數。
- **UI result:** 顯示最新清單，移除完成時顯示提示。
- **Possible side effect:** 清單異動呼叫 `save()` 寫入 `localStorage`；無效索引會記錄錯誤且不修改資料。

### 4.11 自訂轉盤類型與自訂餐廳

[Interaction]

- **Event:** 送出自訂類型表單或餐廳表單；點擊類型／餐廳的刪除按鈕。
- **Listener:** `custom.js` 的 `document.submit` 與 `document.click` 委派事件。
- **Function:** 新增類型呼叫 `addCustomCategory()`；表單事件驗證後更新 `S.cust` 或 `S.custR`，並呼叫對應 render 函式。
- **DOM target:** `#category-form`、`#restaurant-form`、類型清單、餐廳清單及餐廳類型下拉選單。
- **DOM change:** 新增或刪除項目，更新清單、空狀態、類型選單及餐廳表單按鈕狀態。
- **UI result:** 顯示新增／刪除成功提示；空白或重複類型、未填完整餐廳欄位會顯示驗證提示。
- **Possible side effect:** 成功新增／刪除時呼叫 `save()` 寫入 `localStorage`；仍有自訂餐廳的類型不能刪除；自訂餐廳會合併到搜尋結果，但沒有座標，因此不會出現在地圖上。

距離是依經緯度計算的地表直線距離，不代表實際道路距離。交通時間為前端估算值，不是路線服務提供的時間。

## 5. 資料保存

`core.js` 的 `readSavedState()` 從瀏覽器讀取 `foodDemo4`，並初始化共用狀態 `S`：

| 狀態 | 內容 |
|---|---|
| `S.fav` | 最愛餐廳。 |
| `S.bl` | 黑名單餐廳。 |
| `S.cust` | 自訂料理類型。 |
| `S.custR` | 自訂餐廳。 |

資料異動時，功能會呼叫 `save()`，再由 `saveLocalState()` 將 `S` 序列化為 JSON 並寫入：

```js
localStorage.setItem('foodDemo4', JSON.stringify(S));
```

`F`、目前轉盤選項及搜尋結果只存在 JavaScript 記憶體，重新整理後會重新初始化。`localStorage` 依網站來源隔離；清除瀏覽資料、切換瀏覽器、裝置或網站來源，資料不會自動同步。

## 6. 後端 API

| Method | Endpoint | 用途 |
|---|---|---|
| `GET` | `/api/restaurants` | 驗證搜尋參數、限流、查快取並搜尋附近餐廳。 |

搜尋參數包含料理分類、緯度、經度、搜尋半徑、是否素食及素食搜尋方式。條件錯誤會回傳 `400`，超過頻率限制會回傳 `429`，第三方服務錯誤或設定問題會回傳相應的錯誤狀態。

## 7. 錯誤處理與目前限制

- `localStorage` 資料無法解析時，前端使用空白狀態並記錄警告；寫入失敗時顯示提示。
- 定位遭拒、逾時或反查失敗時，顯示錯誤提示，仍可手動選擇位置。
- 餐廳 API 失敗時顯示錯誤狀態，並提供重試按鈕。
- 評分、地址及素食標記的完整度取決於資料來源。
- 「營業中」篩選因目前資料來源沒有即時營業狀態而停用。
- 自訂餐廳沒有座標，無法計算距離或加入地圖標記。
