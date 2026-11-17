# WebUI Lab

Web Programming 課程實作專案。

## 本機啟動

1. 安裝 Python 依賴：`python -m pip install -r requirements.txt`
2. 複製 `.env.example` 為 `.env`，填入 Google Places API Key。`PLACES_PROVIDER` 設為 `google` 或 `osm`，切換餐廳資料來源。
3. 若使用 Google Places，請在 Google Cloud Console 啟用 Places API (New)，並設定 API Key 的使用限制。
4. 啟動服務：`python -m uvicorn server:app --host 127.0.0.1 --port 7777 --reload`
5. 瀏覽 `http://127.0.0.1:7777/`。

餐廳搜尋由瀏覽器呼叫本站 `/api/restaurants`，再由後端依 `PLACES_PROVIDER` 查詢 Google Places API (New) 或 OpenStreetMap Overpass。Google Places API Key 只能設定在後端 `.env`，不可放進前端檔案。

素食篩選預設包含有素食選項的餐廳；也可切換成只看素食專門店。Places 未提供素食資訊時仍會列出，並標示需要先向店家確認。

自動定位會使用裝置座標；手動選擇行政區時，若該區沒有獨立中心座標，搜尋會以縣市中心近似並在結果頁提示。

最愛、黑名單與自訂轉盤資料儲存在目前瀏覽器的 `localStorage`；清除瀏覽資料或更換瀏覽器、裝置時不會同步。

## 學號

s115321006