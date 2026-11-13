# WebUI Lab

Web Programming 課程實作專案。

## 本機啟動

1. 安裝 Python 依賴：`python -m pip install -r requirements.txt`
2. 複製 `.env.example` 為 `.env`，並填入 Google OAuth 2.0「網頁應用程式」的 Client ID。
3. 在 Google Cloud OAuth 用戶端的「已授權的 JavaScript 來源」加入 `http://127.0.0.1:7777`。
4. 啟動服務：`python -m uvicorn server:app --host 127.0.0.1 --port 7777 --reload`
5. 瀏覽 `http://127.0.0.1:7777/`。

Google 登入使用 Google Identity Services，不需要在前端或 `.env` 放置 Client Secret。正式環境必須使用 HTTPS，並設定 `COOKIE_SECURE=true`；同時將正式網站來源加入 Google OAuth 用戶端設定。

## 使用者資料

最愛、黑名單與自訂轉盤資料一律儲存在目前瀏覽器的 `localStorage`，登入 Google 不會同步資料；登出後本機資料仍會保留。清除瀏覽器網站資料或改用其他裝置、瀏覽器時，這些資料可能會遺失。

## 學號

s115321006