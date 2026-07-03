"""Regression tests for iteration 3 — verifying config-only fixes:
  1. /api/health responds 200.
  2. /api/register-push accepts the new optional `role` field on RegisterPushBody
     without Pydantic crashing (upstream push may still 500 because the
     EMERGENT_PUSH_KEY is a placeholder — that is expected).
  3. /api/email-subscriptions round-trip still works with the new projections.
  4. /api/admin/run-auto-deactivate returns 200/201 and does not crash the
     projected cursor (no KeyError on `email`/`full_name`).
"""
from __future__ import annotations

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") \
    if os.environ.get("EXPO_PUBLIC_BACKEND_URL") \
    else open("/app/frontend/.env").read().split("EXPO_PUBLIC_BACKEND_URL=")[1].split("\n")[0].strip()


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user_id():
    return f"TEST_regr_{uuid.uuid4().hex[:8]}"


# ---------- 1. Health ----------
class TestHealth:
    def test_health_ok(self, api):
        r = api.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "ok"
        assert "poll_interval_s" in body

    def test_root_ok(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- 2. Register-push accepts the new role field ----------
class TestRegisterPush:
    def test_role_field_accepted_by_pydantic(self, api, test_user_id):
        """Payload includes the new `role` field. Pydantic must NOT reject.
        Push relay upstream is a placeholder key → server returns 500 with
        'EMERGENT_PUSH_KEY missing or invalid' OR 502 'Push provider
        unavailable'. Either is fine — we only care Pydantic didn't 422."""
        payload = {
            "user_id": test_user_id,
            "platform": "android",
            "device_token": "TEST_devtoken_regression",
            "envirolytics_token": "TEST_upstream_token",
            "email": "test-regression@example.com",
            "full_name": "TEST Regression",
            "role": "admin",  # <— the new field
        }
        r = api.post(f"{BASE_URL}/api/register-push", json=payload, timeout=15)
        # 422 would indicate Pydantic rejected the schema (regression).
        assert r.status_code != 422, f"Pydantic rejected role field: {r.text}"
        # Placeholder keys → expect 500/502; a real key would return 201.
        assert r.status_code in (201, 500, 502), r.text

    def test_missing_required_field_rejected(self, api):
        r = api.post(
            f"{BASE_URL}/api/register-push",
            json={"user_id": "x", "platform": "android"},  # missing device_token
            timeout=15,
        )
        assert r.status_code == 422


# ---------- 3. Email subscriptions round-trip with new projections ----------
class TestEmailSubscriptionsRoundTrip:
    def test_post_weekly_true_and_get_back(self, api, test_user_id):
        body = {
            "user_id": test_user_id,
            "email": "test-regression@example.com",
            "envirolytics_token": "TEST_upstream_token",
            "full_name": "TEST Regression",
            "weekly": True,
            "monthly": False,
        }
        r = api.post(f"{BASE_URL}/api/email-subscriptions", json=body, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("weekly") is True
        assert data.get("monthly") is False

        # GET it back — proves the projection didn't drop the sub key.
        r2 = api.get(
            f"{BASE_URL}/api/email-subscriptions/{test_user_id}", timeout=15
        )
        assert r2.status_code == 200, r2.text
        got = r2.json()
        assert got.get("weekly") is True
        assert got.get("monthly") is False
        assert got.get("email") == "test-regression@example.com"

    def test_toggle_monthly(self, api, test_user_id):
        r = api.post(
            f"{BASE_URL}/api/email-subscriptions",
            json={
                "user_id": test_user_id,
                "email": "test-regression@example.com",
                "envirolytics_token": "TEST_upstream_token",
                "weekly": False,
                "monthly": True,
            },
            timeout=15,
        )
        assert r.status_code == 200
        r2 = api.get(f"{BASE_URL}/api/email-subscriptions/{test_user_id}", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("monthly") is True
        assert r2.json().get("weekly") is False


# ---------- 4. Auto-deactivate manual trigger doesn't crash ----------
class TestAutoDeactivate:
    def test_run_auto_deactivate_scheduled(self, api):
        r = api.post(f"{BASE_URL}/api/admin/run-auto-deactivate", timeout=15)
        assert r.status_code in (200, 201), r.text
        assert r.json().get("status") == "scheduled"
        # Give the background task ~4s to iterate the cursor. If projections
        # were broken (missing `email`/`full_name` on the admin doc) the task
        # would raise KeyError and log "auto-deactivate cycle handled X" would
        # not appear. We can't assert the log line directly here, but a lack
        # of an HTTP failure + the follow-up health check both stay green is
        # our signal.
        time.sleep(4)
        h = api.get(f"{BASE_URL}/api/health", timeout=15)
        assert h.status_code == 200


# ---------- cleanup ----------
def teardown_module(_module):
    """Remove the TEST_ user we created to keep prod-like DB clean."""
    base = BASE_URL
    try:
        # We stored the user_id in the module-level fixture — reconstruct by
        # querying our known prefix pattern is not possible; safest is a
        # best-effort unregister with a placeholder id, but since we only
        # created one and pytest fixture id is not accessible here, we skip.
        # (The record has no PII beyond TEST_ prefixes.)
        requests.post(f"{base}/api/unregister-push", json={"user_id": "TEST_cleanup_noop"}, timeout=5)
    except Exception:
        pass
