import logging
import os
import time
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
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() == "true"
COOKIE_NAME = "google_id_token"

app = FastAPI()


class GoogleLoginRequest(BaseModel):
    credential: str


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
    return {"user": public_user(claims)}


@app.get("/api/me")
def get_me(request: Request) -> dict[str, Any]:
    if not request.cookies.get(COOKIE_NAME):
        return {"user": None}
    claims = current_user(request)
    return {"user": public_user(claims)}


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


app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")
app.mount("/", StaticFiles(directory="html", html=True), name="site")
