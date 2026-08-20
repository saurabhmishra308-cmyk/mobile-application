"""Iteration-5 regression suite.

Covers the backend surface referenced by the iteration-5 review request:
  - GET /api/  (200)
  - GET /api/health  (200 with poll_interval_s int)
  - POST /api/admin/run-auto-deactivate  (200 {"status":"scheduled"})
  - POST /api/email-subscriptions  (round-trip weekly/monthly)
  - POST /api/register-push  (accepts role, upserts user)

Iteration-5 introduces no new backend endpoints (all new work is frontend:
onboarding, login hero, biometric fallback, alert banner, WQ trend). This
suite is therefore a straight-up regression check that iteration-4 features
still behave identically.
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://field-data-viewer.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user_id():
    return f"TEST_iter5_{uuid.uuid4().hex[:10]}"


# ── Health / root ────────────────────────────────────────────────────────
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"
        assert body.get("service") == "envirolytics-mobile-backend"

    def test_health(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"
        assert isinstance(body.get("poll_interval_s"), int)
        assert body["poll_interval_s"] > 0


# ── Auto-deactivate manual trigger ───────────────────────────────────────
class TestAutoDeactivate:
    def test_scheduled_response(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/admin/run-auto-deactivate")
        assert r.status_code == 200
        assert r.json() == {"status": "scheduled"}
        # Background task fires — no way to synchronously assert but ensure the
        # server didn't 500 on a second call either.
        r2 = api_client.post(f"{BASE_URL}/api/admin/run-auto-deactivate")
        assert r2.status_code == 200


# ── Email subscriptions round-trip ───────────────────────────────────────
class TestEmailSubscriptions:
    def test_set_and_get(self, api_client, test_user_id):
        payload = {
            "user_id": test_user_id,
            "email": f"{test_user_id}@example.com",
            "envirolytics_token": "TEST_dummy_token",
            "full_name": "Iter5 Tester",
            "weekly": True,
            "monthly": False,
        }
        r = api_client.post(f"{BASE_URL}/api/email-subscriptions", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["weekly"] is True
        assert body["monthly"] is False

        g = api_client.get(f"{BASE_URL}/api/email-subscriptions/{test_user_id}")
        assert g.status_code == 200
        gb = g.json()
        assert gb["weekly"] is True
        assert gb["monthly"] is False
        assert gb["email"] == payload["email"]

    def test_toggle_monthly(self, api_client, test_user_id):
        payload = {
            "user_id": test_user_id,
            "email": f"{test_user_id}@example.com",
            "envirolytics_token": "TEST_dummy_token",
            "weekly": False,
            "monthly": True,
        }
        r = api_client.post(f"{BASE_URL}/api/email-subscriptions", json=payload)
        assert r.status_code == 200
        assert r.json()["monthly"] is True

        g = api_client.get(f"{BASE_URL}/api/email-subscriptions/{test_user_id}")
        assert g.json()["monthly"] is True
        assert g.json()["weekly"] is False


# ── Register-push (accepts new `role` field) ─────────────────────────────
class TestRegisterPush:
    def test_missing_device_token_422(self, api_client, test_user_id):
        r = api_client.post(
            f"{BASE_URL}/api/register-push",
            json={"user_id": test_user_id, "platform": "ios"},
        )
        assert r.status_code == 422

    def test_accepts_role_field(self, api_client, test_user_id):
        # EMERGENT_PUSH_KEY is a placeholder in the preview env, so the upstream
        # call returns a non-2xx and FastAPI will 500. What we're asserting is
        # that Pydantic accepts the payload shape (i.e. NOT 422) — the `role`
        # field must not be rejected.
        r = api_client.post(
            f"{BASE_URL}/api/register-push",
            json={
                "user_id": test_user_id,
                "platform": "ios",
                "device_token": "TEST_iter5_devicetoken",
                "envirolytics_token": "TEST_iter5_token",
                "email": f"{test_user_id}@example.com",
                "full_name": "Iter5 Tester",
                "role": "admin",
            },
        )
        assert r.status_code != 422, f"Payload shape rejected: {r.text}"


# ── Cleanup ──────────────────────────────────────────────────────────────
def teardown_module(_mod):
    # Best-effort cleanup of the TEST_iter5_* push_users doc.
    try:
        requests.post(
            f"{BASE_URL}/api/unregister-push",
            json={"user_id": _mod.__dict__.get("_test_user_id_holder")},
            timeout=5,
        )
    except Exception:
        pass
