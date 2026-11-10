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

登入後，最愛、黑名單與自訂轉盤資料會儲存在 `data/users/` 下，每個 Google 帳號各有一份 JSON 檔。檔名使用 Google 使用者 ID 的 SHA-256 雜湊，未登入時則沿用瀏覽器的本機儲存。首次登入且帳號尚無資料檔時，會將目前瀏覽器資料匯入該帳號；帳號已有資料時，以帳號資料為準。

部署時請讓 `data/users/` 位於持久化磁碟並納入備份；此目錄已排除於 Git 版本控制之外。

## 學號

s115321006