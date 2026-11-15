import json
import logging
import math
import os
import re
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
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
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() == "true"
COOKIE_NAME = "google_id_token"
PLACES_PROVIDER = os.getenv("PLACES_PROVIDER", "google").strip().lower() or "google"
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "site" / "data"
CATEGORIES_PATH = DATA_DIR / "categories.json"
CATEGORIES = json.loads(CATEGORIES_PATH.read_text(encoding="utf-8"))
CATEGORIES_BY_NAME = {category["name"]: category for category in CATEGORIES}
PLACES_CACHE_TTL_SECONDS = 600
PLACES_CACHE_MAX_ENTRIES = 200
PLACES_RATE_LIMIT = 30
PLACES_RATE_WINDOW_SECONDS = 60
GOOGLE_FIELD_MASK = (
    "places.id,places.displayName,places.location,places.formattedAddress,"
    "places.rating,places.userRatingCount,places.types,places.businessStatus"
)
OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"
OVERPASS_USER_AGENT = "webui-lab-restaurant-search/1.0"

app = FastAPI()
places_cache: OrderedDict[tuple[Any, ...], tuple[float, list[dict[str, Any]]]] = OrderedDict()
places_cache_lock = threading.Lock()
places_rate_limit: dict[str, list[float]] = {}
places_rate_limit_lock = threading.Lock()


class GoogleLoginRequest(BaseModel):
    credential: str


class PlacesProviderError(Exception):
    """代表第三方地圖服務逾時或回傳錯誤。"""


def parse_search_parameters(
    category: str | None,
    lat: str | None,
    lng: str | None,
    radius: str | None,
    veg: str | None,
) -> tuple[dict[str, Any], float, float, int, bool]:
    """把網址參數檢查成安全、可計算的搜尋條件。"""
    if category not in CATEGORIES_BY_NAME:
        raise HTTPException(status_code=400, detail="餐廳分類不存在。")
    if lat is None or lng is None or radius is None or veg is None:
        raise HTTPException(status_code=400, detail="缺少搜尋位置或篩選參數。")

    try:
        latitude = float(lat)
        longitude = float(lng)
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="座標格式不正確。") from error

    if not math.isfinite(latitude) or not -90 <= latitude <= 90:
        raise HTTPException(status_code=400, detail="緯度必須介於 -90 到 90。")
    if not math.isfinite(longitude) or not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="經度必須介於 -180 到 180。")
    if not re.fullmatch(r"\d+", radius):
        raise HTTPException(status_code=400, detail="搜尋半徑必須是整數。")

    search_radius = int(radius)
    if not 100 <= search_radius <= 10000:
        raise HTTPException(status_code=400, detail="搜尋半徑必須介於 100 到 10000 公尺。")
    if veg not in {"0", "1"}:
        raise HTTPException(status_code=400, detail="素食篩選只能是 0 或 1。")

    category_config = CATEGORIES_BY_NAME[category]
    vegetarian_only = veg == "1" or bool(category_config.get("vegetarianOnly"))
    return category_config, latitude, longitude, search_radius, vegetarian_only


def is_rate_limited(client_ip: str, now: float) -> bool:
    """每個來源 IP 每分鐘只能呼叫 30 次，並清除過期計數。"""
    with places_rate_limit_lock:
        for ip, timestamps in list(places_rate_limit.items()):
            active = [stamp for stamp in timestamps if now - stamp < PLACES_RATE_WINDOW_SECONDS]
            if active:
                places_rate_limit[ip] = active
            else:
                del places_rate_limit[ip]

        timestamps = places_rate_limit.setdefault(client_ip, [])
        if len(timestamps) >= PLACES_RATE_LIMIT:
            return True
        timestamps.append(now)
        return False


def haversine_distance_meters(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    """用兩組經緯度計算地表直線距離，結果以公尺表示。"""
    earth_radius_meters = 6_371_000
    lat_a = math.radians(latitude_a)
    lat_b = math.radians(latitude_b)
    lat_delta = math.radians(latitude_b - latitude_a)
    lng_delta = math.radians(longitude_b - longitude_a)
    haversine = (
        math.sin(lat_delta / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(lng_delta / 2) ** 2
    )
    return earth_radius_meters * 2 * math.atan2(
        math.sqrt(haversine), math.sqrt(1 - haversine)
    )


def build_map_url(name: str, place_id: str | None, address: str) -> str:
    """產生 Google 地圖搜尋網址，不把第三方資料原封不動傳回前端。"""
    query = urllib.parse.quote(" ".join(part for part in (name, address) if part))
    map_url = f"https://www.google.com/maps/search/?api=1&query={query}"
    if place_id and not place_id.startswith("node/"):
        map_url += "&query_place_id=" + urllib.parse.quote(place_id)
    return map_url


def normalized_restaurant(
    place_id: str,
    name: str,
    category_name: str,
    latitude: float,
    longitude: float,
    search_latitude: float,
    search_longitude: float,
    address: str,
    is_vegetarian: bool | None,
    rating: float | None = None,
    rating_count: int | None = None,
) -> dict[str, Any]:
    """將地圖服務資料整理成前端固定使用的餐廳欄位。"""
    return {
        "id": place_id,
        "name": name,
        "category": category_name,
        "lat": latitude,
        "lng": longitude,
        "distance": round(haversine_distance_meters(
            search_latitude, search_longitude, latitude, longitude
        )),
        "isVeg": is_vegetarian,
        "address": address,
        "rating": rating,
        "ratingCount": rating_count,
        "mapUrl": build_map_url(name, place_id, address),
    }


def request_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> Any:
    """用 8 秒逾時送出第三方請求，並在錯誤時避免記錄回應內容。"""
    if headers.get("Content-Type") == "application/x-www-form-urlencoded":
        request_body = urllib.parse.urlencode(payload).encode("utf-8")
    else:
        request_body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=request_body,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))
            if not isinstance(data, dict):
                raise PlacesProviderError("InvalidResponse")
            return data
    except (
        urllib.error.URLError,
        TimeoutError,
        socket.timeout,
        json.JSONDecodeError,
        UnicodeDecodeError,
    ) as error:
        raise PlacesProviderError(type(error).__name__) from error


def search_google_places(
    category: dict[str, Any],
    latitude: float,
    longitude: float,
    radius: int,
    vegetarian_only: bool,
) -> list[dict[str, Any]]:
    """呼叫 Google Places (New)，只挑選需要的欄位並略過歇業店家。"""
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(status_code=503, detail="Google 餐廳搜尋尚未設定 API Key。")

    query = category["query"]
    if vegetarian_only:
        query += " 素食"
    payload = {
        "textQuery": query,
        "locationBias": {
            "circle": {
                "center": {"latitude": latitude, "longitude": longitude},
                "radius": radius,
            }
        },
        "maxResultCount": 20,
    }
    google_type = next(iter(category.get("googleTypes", [])), None)
    if google_type in {
        "american_restaurant",
        "barbecue_restaurant",
        "breakfast_restaurant",
        "brunch_restaurant",
        "chinese_restaurant",
        "fast_food_restaurant",
        "indian_restaurant",
        "italian_restaurant",
        "japanese_restaurant",
        "korean_restaurant",
        "thai_restaurant",
        "vegetarian_restaurant",
        "vietnamese_restaurant",
    }:
        payload["includedType"] = google_type
    data = request_json(
        "https://places.googleapis.com/v1/places:searchText",
        payload,
        {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
        },
    )

    places = data.get("places", [])
    if not isinstance(places, list):
        raise PlacesProviderError("InvalidResponse")

    results = []
    for place in places:
        if not isinstance(place, dict):
            raise PlacesProviderError("InvalidResponse")
        if place.get("businessStatus") != "OPERATIONAL":
            continue
        types = place.get("types") or []
        if not isinstance(types, list):
            raise PlacesProviderError("InvalidResponse")
        is_vegetarian = True if "vegetarian_restaurant" in types else None
        if vegetarian_only and not is_vegetarian:
            continue
        location = place.get("location") or {}
        display_name = place.get("displayName") or {}
        if not isinstance(location, dict) or not isinstance(display_name, dict):
            raise PlacesProviderError("InvalidResponse")
        try:
            place_latitude = float(location.get("latitude"))
            place_longitude = float(location.get("longitude"))
        except (TypeError, ValueError):
            continue
        if (
            not math.isfinite(place_latitude)
            or not math.isfinite(place_longitude)
            or not -90 <= place_latitude <= 90
            or not -180 <= place_longitude <= 180
        ):
            continue
        name = display_name.get("text")
        place_id = place.get("id")
        if not name or not place_id:
            continue
        if not isinstance(name, str):
            continue
        if haversine_distance_meters(
            latitude, longitude, float(place_latitude), float(place_longitude)
        ) > radius:
            continue
        results.append(normalized_restaurant(
            str(place_id),
            name,
            category["name"],
            place_latitude,
            place_longitude,
            latitude,
            longitude,
            str(place.get("formattedAddress") or ""),
            is_vegetarian,
            (
                float(place["rating"])
                if isinstance(place.get("rating"), (int, float))
                and math.isfinite(float(place["rating"]))
                else None
            ),
            (
                int(place["userRatingCount"])
                if isinstance(place.get("userRatingCount"), int)
                and place["userRatingCount"] >= 0
                else None
            ),
        ))
    return sorted(results, key=lambda restaurant: restaurant["distance"])[:20]


def search_openstreetmap(
    category: dict[str, Any],
    latitude: float,
    longitude: float,
    radius: int,
    vegetarian_only: bool,
) -> list[dict[str, Any]]:
    """透過 Overpass 搜尋附近餐廳節點，並按分類和素食標籤篩選。"""
    query = (
        "[out:json][timeout:8];"
        f"node(around:{radius},{latitude},{longitude})"
        '[amenity~"^(restaurant|fast_food|cafe)$"];out body;'
    )
    data = request_json(
        OVERPASS_ENDPOINT,
        {"data": query},
        {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": OVERPASS_USER_AGENT,
        },
    )

    elements = data.get("elements", [])
    if not isinstance(elements, list):
        raise PlacesProviderError("InvalidResponse")
    cuisine_filter = {value.lower() for value in category.get("osmCuisine", [])}
    results = []
    for element in elements:
        if not isinstance(element, dict):
            raise PlacesProviderError("InvalidResponse")
        tags = element.get("tags") or {}
        if not isinstance(tags, dict):
            raise PlacesProviderError("InvalidResponse")
        cuisines = {
            value.strip().lower()
            for value in str(tags.get("cuisine", "")).split(";")
            if value.strip()
        }
        if cuisine_filter and not cuisine_filter.intersection(cuisines):
            continue
        is_vegetarian = (
            True
            if tags.get("diet:vegetarian") == "yes" or tags.get("diet:vegan") == "yes"
            else False
            if tags.get("diet:vegetarian") == "no" or tags.get("diet:vegan") == "no"
            else None
        )
        if vegetarian_only and is_vegetarian is not True:
            continue
        try:
            place_latitude = float(element["lat"])
            place_longitude = float(element["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if (
            not math.isfinite(place_latitude)
            or not math.isfinite(place_longitude)
            or not -90 <= place_latitude <= 90
            or not -180 <= place_longitude <= 180
        ):
            continue
        name = tags.get("name")
        if not name:
            continue
        address = " ".join(
            str(tags[key])
            for key in ("addr:city", "addr:district", "addr:street", "addr:housenumber")
            if tags.get(key)
        )
        place_id = f"node/{element.get('id')}"
        results.append(normalized_restaurant(
            place_id,
            str(name),
            category["name"],
            place_latitude,
            place_longitude,
            latitude,
            longitude,
            address,
            is_vegetarian,
        ))
    return sorted(results, key=lambda restaurant: restaurant["distance"])[:20]


@app.get("/api/restaurants")
def get_restaurants(
    request: Request,
    category: str | None = None,
    lat: str | None = None,
    lng: str | None = None,
    radius: str | None = None,
    veg: str | None = None,
) -> dict[str, Any]:
    """驗證搜尋條件、限流、查快取，再呼叫目前選定的資料來源。"""
    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(client_ip, time.monotonic()):
        raise HTTPException(status_code=429, detail="搜尋次數已達上限，請稍後再試。")

    category_config, latitude, longitude, search_radius, vegetarian_only = (
        parse_search_parameters(category, lat, lng, radius, veg)
    )
    cache_key = (
        category_config["name"],
        round(latitude, 3),
        round(longitude, 3),
        search_radius,
        vegetarian_only,
    )
    now = time.monotonic()
    with places_cache_lock:
        cached = places_cache.get(cache_key)
        if cached and now - cached[0] < PLACES_CACHE_TTL_SECONDS:
            places_cache.move_to_end(cache_key)
            logger.info("餐廳搜尋快取命中：category=%s radius=%s", category, search_radius)
            return {"restaurants": cached[1], "usedRadius": search_radius}
        if cached:
            del places_cache[cache_key]

    if PLACES_PROVIDER not in {"google", "osm"}:
        raise HTTPException(status_code=503, detail="餐廳搜尋服務的資料來源設定不正確。")

    try:
        if PLACES_PROVIDER == "google":
            restaurants = search_google_places(
                category_config, latitude, longitude, search_radius, vegetarian_only
            )
        else:
            restaurants = search_openstreetmap(
                category_config, latitude, longitude, search_radius, vegetarian_only
            )
    except HTTPException:
        raise
    except PlacesProviderError as error:
        logger.warning(
            "餐廳搜尋第三方服務失敗：provider=%s error_type=%s",
            PLACES_PROVIDER,
            str(error),
        )
        raise HTTPException(
            status_code=502,
            detail="餐廳搜尋服務暫時無法使用，請稍後重試。",
        ) from error

    with places_cache_lock:
        places_cache[cache_key] = (time.monotonic(), restaurants)
        places_cache.move_to_end(cache_key)
        while len(places_cache) > PLACES_CACHE_MAX_ENTRIES:
            places_cache.popitem(last=False)
    return {"restaurants": restaurants, "usedRadius": search_radius}


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


app.mount("/css", StaticFiles(directory=str(BASE_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(BASE_DIR / "js")), name="js")
app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")
app.mount("/", StaticFiles(directory=str(BASE_DIR / "html"), html=True), name="site")
