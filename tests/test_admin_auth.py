"""BE-7 checks: login cookie attributes, logout session deletion, me sliding window."""

import uuid

import pytest
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app import main as app_main
from app.admin_auth import SESSION_COOKIE, SESSION_TTL, hash_password
from app.models import AdminSession, AdminUser


def test_login_sets_httponly_samesite_cookie(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app_main._bootstrap_admin()
    app = app_main.create_app()

    with TestClient(app) as http:
        r = http.post("/admin/auth/login", json={"username": "root", "password": "bootstrap-pass-123"})
        cookie = r.cookies.get(SESSION_COOKIE)
        assert cookie is not None
        set_cookie_header = r.headers.get("set-cookie", "")
        assert "httponly" in set_cookie_header.lower()
        assert "samesite=lax" in set_cookie_header.lower()
        assert cookie is not None


def test_login_rejects_bad_password(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app_main._bootstrap_admin()
    app = app_main.create_app()

    with TestClient(app) as http:
        r = http.post("/admin/auth/login", json={"username": "root", "password": "nope"})
        assert r.status_code == 401


def test_me_returns_user_and_slides_session(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app_main._bootstrap_admin()
    app = app_main.create_app()

    with TestClient(app) as http:
        r = http.post("/admin/auth/login", json={"username": "root", "password": "bootstrap-pass-123"})
        cookie = r.cookies.get(SESSION_COOKIE)
        assert cookie is not None

        r = http.get("/admin/auth/me")
        assert r.status_code == 200
        body = r.json()
        assert body["username"] == "root"
        user_id = body["id"]

    cookie = (cookie or r.cookies.get(SESSION_COOKIE))
    with db() as s:
        session = s.execute(
            select(AdminSession).where(AdminSession.token == uuid.UUID(cookie))
        ).scalar_one()
        assert session.expires_at > session.last_seen_at
        expected = datetime.now(UTC) + SESSION_TTL
        assert abs((session.expires_at.replace(tzinfo=None) - expected.replace(tzinfo=None)).total_seconds()) <= 1


def test_logout_deletes_session_and_cookie(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app_main._bootstrap_admin()
    app = app_main.create_app()

    with TestClient(app) as http:
        r = http.post("/admin/auth/login", json={"username": "root", "password": "bootstrap-pass-123"})
        cookie = r.cookies.get(SESSION_COOKIE)
        assert cookie is not None

        r = http.post("/admin/auth/logout")
        assert r.status_code == 204

    cookie = (cookie or http.cookies.get(SESSION_COOKIE))
    with db() as s:
        session = s.execute(
            select(AdminSession).where(AdminSession.token == uuid.UUID(cookie))
        ).scalar_one_or_none()
        assert session is None


def test_logged_out_session_rejected(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app_main._bootstrap_admin()
    app = app_main.create_app()

    with TestClient(app) as http:
        r = http.post("/admin/auth/login", json={"username": "root", "password": "bootstrap-pass-123"})
        cookie = r.cookies.get(SESSION_COOKIE)

        r = http.post("/admin/auth/logout")
        assert r.status_code == 204

        replay = TestClient(app, cookies={SESSION_COOKIE: cookie})
        assert replay.get("/admin/auth/me").status_code == 401


def test_invalid_session_token_format_rejected(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app_main._bootstrap_admin()
    app = app_main.create_app()

    with TestClient(app) as http:
        http.cookies.set(SESSION_COOKIE, "not-a-uuid")
        assert http.get("/admin/auth/me").status_code == 401


def test_expired_session_rejected(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app_main._bootstrap_admin()
    app = app_main.create_app()

    with db() as s:
        user = s.execute(select(AdminUser)).scalars().one()
        expired = datetime.now(UTC) - timedelta(hours=25)
        token = AdminSession(
            user_id=user.id,
            token=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            last_seen_at=expired,
            expires_at=expired,
        )
        s.add(token)
        s.commit()

    with TestClient(app) as http:
        http.cookies.set(SESSION_COOKIE, "00000000-0000-0000-0000-000000000001")
        assert http.get("/admin/auth/me").status_code == 401
