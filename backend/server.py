"""Envirolytics companion backend.

Two responsibilities only:
  1. Relay push registration to the Emergent-managed push service.
  2. Run a background poller that queries monitor.envirolytics.in on behalf of
     each registered user and fires push notifications when a device goes
     offline or a limit breach is detected.

The mobile app talks to monitor.envirolytics.in DIRECTLY for all data; this
backend never proxies user-facing reads. It only exists so push works.
"""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
ENVIROLYTICS_BASE_URL = os.environ.get(
    "ENVIROLYTICS_BASE_URL", "https://monitor.envirolytics.in"
)
ALERT_POLL_INTERVAL_SECONDS = int(
    os.environ.get("ALERT_POLL_INTERVAL_SECONDS", "300")
)
PUSH_BASE_URL = "https://integrations.emergentagent.com"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("envirolytics")

_mongo = AsyncIOMotorClient(MONGO_URL)
db = _mongo[DB_NAME]

# One shared httpx client for the Emergent push relay.
_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": EMERGENT_PUSH_KEY},
    timeout=10.0,
)
# One shared httpx client for the Envirolytics upstream API.
_envirolytics_client = httpx.AsyncClient(
    base_url=ENVIROLYTICS_BASE_URL, timeout=15.0
)


# ---------------------------------------------------------------------------
# Push relay
# ---------------------------------------------------------------------------


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str  # "android" | "ios"
    device_token: str
    envirolytics_token: str | None = None  # so the poller can call the upstream


async def send_push(
    recipients: list[str],
    data: dict,
    idempotency_key: str | None = None,
) -> None:
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict[str, Any] = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Alert poller
# ---------------------------------------------------------------------------


def _breach_signature(b: dict) -> str:
    """Stable key so we don't re-notify the same breach every poll."""
    return "|".join(
        str(b.get(k, "")) for k in ("hardware_id", "parameter", "detected_at", "value")
    )


async def _poll_user(user_doc: dict) -> None:
    token = user_doc.get("envirolytics_token")
    user_id = user_doc.get("user_id")
    if not token or not user_id:
        return
    headers = {"Authorization": f"Bearer {token}"}
    try:
        off_resp, breach_resp = await asyncio.gather(
            _envirolytics_client.get(
                "/api/alerts/offline?hours=24", headers=headers
            ),
            _envirolytics_client.get(
                "/api/alerts/limit-breaches", headers=headers
            ),
        )
    except Exception as exc:  # network hiccup — skip this cycle
        logger.warning("Envirolytics poll failed for %s: %s", user_id, exc)
        return

    if off_resp.status_code == 401 or breach_resp.status_code == 401:
        # Token expired — mark user token invalid so we stop polling.
        await db.push_users.update_one(
            {"user_id": user_id},
            {"$unset": {"envirolytics_token": ""}, "$set": {"token_invalid": True}},
        )
        logger.info("Envirolytics token expired for %s", user_id)
        return

    off_ids = {
        d.get("hardware_id")
        for d in (off_resp.json().get("offline") or [])
        if d.get("hardware_id")
    }
    prev_off = set(user_doc.get("known_offline") or [])
    new_offline = off_ids - prev_off

    breaches = breach_resp.json().get("breaches") or []
    breach_sigs = {_breach_signature(b) for b in breaches}
    prev_breaches = set(user_doc.get("known_breaches") or [])
    new_breach_sigs = breach_sigs - prev_breaches

    async def _notify(title: str, message: str, key: str) -> None:
        try:
            await send_push(
                recipients=[user_id],
                data={"title": title, "message": message, "action_url": "/(tabs)/alerts"},
                idempotency_key=key,
            )
        except Exception as exc:  # push failure never blocks the poller
            logger.warning("push send failed: %s", exc)

    for hw in new_offline:
        await _notify(
            "Device offline",
            f"{hw} has not reported in 24h.",
            key=f"offline:{user_id}:{hw}",
        )
    for b in breaches:
        sig = _breach_signature(b)
        if sig not in new_breach_sigs:
            continue
        await _notify(
            "Limit breach",
            f"{b.get('parameter','value')} on {b.get('hardware_id','device')} "
            f"= {b.get('value','?')} (limit {b.get('limit','?')}).",
            key=f"breach:{user_id}:{sig}",
        )

    await db.push_users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "known_offline": list(off_ids),
                "known_breaches": list(breach_sigs),
            }
        },
    )


async def _poller_loop() -> None:
    while True:
        try:
            cursor = db.push_users.find(
                {"envirolytics_token": {"$exists": True, "$ne": None}}
            )
            async for user in cursor:
                await _poll_user(user)
        except Exception as exc:
            logger.exception("Alert poller loop error: %s", exc)
        await asyncio.sleep(ALERT_POLL_INTERVAL_SECONDS)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_poller_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await _push_client.aclose()
        await _envirolytics_client.aclose()
        _mongo.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"status": "ok", "service": "envirolytics-mobile-backend"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "poll_interval_s": ALERT_POLL_INTERVAL_SECONDS}


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    """Register the device token with the Emergent push service AND remember
    the user's Envirolytics token so the poller can check alerts on their
    behalf. Called on every app open — safe to call repeatedly.
    """
    upstream_payload = {
        "user_id": body.user_id,
        "platform": body.platform,
        "device_token": body.device_token,
    }
    resp = await _push_client.post(
        "/api/v1/push/users/register", json=upstream_payload
    )
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()

    # Persist the user record so the poller can query alerts.
    update: dict[str, Any] = {
        "user_id": body.user_id,
        "platform": body.platform,
        "device_token": body.device_token,
        "token_invalid": False,
    }
    if body.envirolytics_token:
        update["envirolytics_token"] = body.envirolytics_token
    await db.push_users.update_one(
        {"user_id": body.user_id},
        {"$set": update, "$setOnInsert": {"known_offline": [], "known_breaches": []}},
        upsert=True,
    )
    return {"status": "registered"}


@api_router.post("/unregister-push")
async def unregister_push(body: dict):
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(400, "user_id required")
    await db.push_users.delete_one({"user_id": user_id})
    return {"status": "unregistered"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
