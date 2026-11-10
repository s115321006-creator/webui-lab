import hashlib
import json
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from google.auth.exceptions import TransportError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).resolve().parent
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
USER_DATA_DIR = Path(
    os.getenv("USER_DATA_DIR", str(ROOT_DIR / "data" / "users"))
).resolve()
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() == "true"
COOKIE_NAME = "google_id_token"
DATA_FIELDS = ("cust", "custR", "fav", "bl")
MAX_DATA_BYTES = 1_000_000
MAX_LIST_ITEMS = 1_000

app = FastAPI()


class GoogleLoginRequest(BaseModel):
    credential: str


class UserDataRequest(BaseModel):
    data: dict[str, Any]


def verify_google_token(token: str) -> dict[str, Any]:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google 登入尚未設定。")

    try:
        claims = id_token.verify_oauth2_token(
            token, GoogleRequest(), GOOGLE_CLIENT_ID
        )
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Google 登入憑證無效或已過期。") from error
    except TransportError as error:
        logger.exception("無法連線至 Google 驗證登入憑證。")
        raise HTTPException(status_code=503, detail="目前無法驗證 Google 登入，請稍後再試。") from error

    if not claims.get("sub") or claims.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="Google 帳號未提供有效的已驗證身分。")
    return claims


def public_user(claims: dict[str, Any]) -> dict[str, str]:
    return {
        "name": str(claims.get("name") or claims.get("email") or "Google 使用者"),
        "email": str(claims.get("email") or ""),
    }


def user_data_path(subject: str) -> Path:
    file_id = hashlib.sha256(subject.encode("utf-8")).hexdigest()
    return USER_DATA_DIR / (file_id + ".json")


def validate_user_data(data: Any) -> dict[str, list[Any]]:
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="使用者資料格式無效。")

    normalized: dict[str, list[Any]] = {}
    for field in DATA_FIELDS:
        items = data.get(field, [])
        if not isinstance(items, list) or len(items) > MAX_LIST_ITEMS:
            raise HTTPException(status_code=422, detail=f"使用者資料欄位 {field} 格式無效。")
        normalized[field] = items

    if len(json.dumps(normalized, ensure_ascii=False).encode("utf-8")) > MAX_DATA_BYTES:
        raise HTTPException(status_code=413, detail="使用者資料超過允許大小。")
    return normalized


def read_user_data(subject: str) -> tuple[bool, dict[str, list[Any]]]:
    path = user_data_path(subject)
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return False, {field: [] for field in DATA_FIELDS}
    except json.JSONDecodeError as error:
        logger.exception("使用者資料 JSON 格式錯誤：%s", path)
        raise HTTPException(status_code=500, detail="使用者資料檔案格式錯誤，無法載入。") from error

    if not isinstance(document, dict) or document.get("version") != 1:
        logger.error("使用者資料檔案結構無效：%s", path)
        raise HTTPException(status_code=500, detail="使用者資料檔案結構無效，無法載入。")
    return True, validate_user_data(document.get("data"))


def write_user_data(subject: str, data: Any) -> None:
    normalized = validate_user_data(data)
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = user_data_path(subject)
    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=USER_DATA_DIR,
            prefix=path.stem + "-",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(
                {"version": 1, "data": normalized},
                temporary_file,
                ensure_ascii=False,
                separators=(",", ":"),
            )
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def current_user(request: Request) -> dict[str, Any]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="請先登入 Google 帳號。")
    return verify_google_token(token)


@app.get("/api/config")
def get_config() -> dict[str, str | None]:
    return {"google_client_id": GOOGLE_CLIENT_ID or None}


@app.post("/api/auth/google")
def google_login(payload: GoogleLoginRequest, response: Response) -> dict[str, Any]:
    claims = verify_google_token(payload.credential)
    max_age = int(claims.get("exp", 0) - time.time())
    if max_age <= 0:
        raise HTTPException(status_code=401, detail="Google 登入憑證已過期。")

    response.set_cookie(
        COOKIE_NAME,
        payload.credential,
        max_age=max_age,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    exists, data = read_user_data(str(claims["sub"]))
    return {"user": public_user(claims), "exists": exists, "data": data}


@app.get("/api/me")
def get_me(request: Request) -> dict[str, Any]:
    if not request.cookies.get(COOKIE_NAME):
        return {
            "user": None,
            "exists": False,
            "data": {field: [] for field in DATA_FIELDS},
        }
    claims = current_user(request)
    exists, data = read_user_data(str(claims["sub"]))
    return {"user": public_user(claims), "exists": exists, "data": data}


@app.put("/api/me/data")
def update_my_data(payload: UserDataRequest, request: Request) -> dict[str, bool]:
    claims = current_user(request)
    write_user_data(str(claims["sub"]), payload.data)
    return {"saved": True}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(
        COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return {"logged_out": True}


app.mount("/css", StaticFiles(directory=ROOT_DIR / "site" / "css"), name="css")
app.mount("/js", StaticFiles(directory=ROOT_DIR / "site" / "js"), name="js")
app.mount("/", StaticFiles(directory=ROOT_DIR / "site", html=True), name="site")
