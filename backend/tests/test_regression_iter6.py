"""Iteration-6 regression suite.

Focus: user-reported "app crashes on open" bug. Root cause was 3 duplicate
object keys in `frontend/src/api/client.ts` (borewellConsumption,
levelVsRainfall, hourlyPumpingVsLevel). Backend surface unchanged — this
suite verifies the iteration-4/5 endpoints still behave.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else "https://field-data-viewer.preview.emergentagent.com"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user_id():
    return f"TEST_iter6_{uuid.uuid4().hex[:10]}"


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


# ── Auto-deactivate manual trigger ───────────────────────────────────────
class TestAutoDeactivate:
    def test_scheduled_response(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/admin/run-auto-deactivate")
        assert r.status_code == 200
        assert r.json() == {"status": "scheduled"}


# ── Email subscriptions round-trip ───────────────────────────────────────
class TestEmailSubscriptions:
    def test_set_and_get(self, api_client, test_user_id):
        payload = {
            "user_id": test_user_id,
            "email": f"{test_user_id}@example.com",
            "envirolytics_token": "TEST_dummy_token",
            "full_name": "Iter6 Tester",
            "weekly": True,
            "monthly": False,
        }
        r = api_client.post(f"{BASE_URL}/api/email-subscriptions", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["weekly"] is True
        assert body["monthly"] is False

        g = api_client.get(f"{BASE_URL}/api/email-subscriptions/{test_user_id}")
        assert g.status_code == 200
        gb = g.json()
        assert gb["weekly"] is True
        assert gb["monthly"] is False
        assert gb["email"] == payload["email"]


def teardown_module(_mod):
    try:
        # Best-effort cleanup of the TEST_iter6_* push_users doc.
        # We don't know the exact user_id here (fixture scope), so no-op.
        pass
    except Exception:
        pass
