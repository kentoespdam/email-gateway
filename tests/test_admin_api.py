"""Runnable checks for the admin dashboard flow: bootstrap, auth, users, api keys, logs."""

from fastapi.testclient import TestClient

from app import main as app_main
from app.admin_auth import SESSION_COOKIE
from app.main import app


def test_admin_flow(db, monkeypatch):
    monkeypatch.setattr(app_main, "SessionLocal", db)
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    app_main._bootstrap_admin()

    with TestClient(app) as http:
        # Login: wrong password rejected, correct one sets HttpOnly cookie.
        r = http.post("/admin/auth/login", json={"username": "root", "password": "nope"})
        assert r.status_code == 401
        r = http.post("/admin/auth/login", json={"username": "root", "password": "bootstrap-pass-123"})
        assert r.status_code == 200
        assert SESSION_COOKIE in r.cookies
        cookie = r.cookies[SESSION_COOKIE]

        # me() returns the user and slides the session window.
        r = http.get("/admin/auth/me")
        assert r.status_code == 200
        assert r.json()["username"] == "root"
        user_id = r.json()["id"]

        # User management: create (min 8 chars), duplicate rejected, delete self rejected.
        r = http.post("/admin/users", json={"username": "ops", "password": "short"})
        assert r.status_code == 422
        r = http.post("/admin/users", json={"username": "ops", "password": "longenough1"})
        assert r.status_code == 201
        r = http.post("/admin/users", json={"username": "ops", "password": "longenough2"})
        assert r.status_code == 409
        r = http.delete(f"/admin/users/{user_id}")
        assert r.status_code == 400
        r = http.get("/admin/users")
        assert {u["username"] for u in r.json()} == {"root", "ops"}

        # API keys: token shown once, then never again.
        r = http.post(
            "/admin/api-keys",
            json={"client_name": "billing", "allowed_from_addresses": ["billing@x.com"]},
        )
        assert r.status_code == 201
        created = r.json()
        assert created["key_token"]
        key_id = created["id"]
        r = http.get("/admin/api-keys")
        assert all("key_token" not in k for k in r.json())
        r = http.patch(f"/admin/api-keys/{key_id}", json={"is_active": False})
        assert r.status_code == 200 and r.json()["is_active"] is False

        # Transactions: empty page is fine, bad status rejected.
        r = http.get("/admin/transactions")
        assert r.status_code == 200 and r.json()["total_count"] == 0
        r = http.get("/admin/transactions", params={"status": "bogus"})
        assert r.status_code == 422

        # Auth failures return 401 without a valid session.
        bad = TestClient(app)
        assert bad.get("/admin/auth/me").status_code == 401
        assert bad.get("/admin/api-keys").status_code == 401

        # Logout deletes the session server-side: cookie replay is rejected.
        r = http.post("/admin/auth/logout")
        assert r.status_code == 204
        replay = TestClient(app, cookies={SESSION_COOKIE: cookie})
        assert replay.get("/admin/auth/me").status_code == 401
