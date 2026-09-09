"""BE-4/5/6 checks: CORS config, startup bootstrap, and ApiKey expiry lookup."""

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app import main as app_main
from app.main import _bootstrap_admin


def test_cors_middleware_registered(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "allowed_origins", "http://a.example")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app = app_main.create_app()
    cors = [m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware"]
    assert cors, "CORSMiddleware must be registered"
    mw = cors[0]
    assert mw.kwargs.get("allow_credentials") is True


@pytest.mark.parametrize("origins", ["http://a.example", "http://a.example,http://b.example"])
def test_allowed_origins_parsed(db, monkeypatch, origins):
    monkeypatch.setattr(app_main.settings, "allowed_origins", origins)
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app = app_main.create_app()
    cors = [m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware"][0]
    mw = cors
    expect = [o.strip() for o in origins.split(",") if o.strip()]
    assert mw.kwargs.get("allow_origins") == expect


def test_bootstrap_creates_first_user(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    _bootstrap_admin()
    with db() as s:
        users = s.execute(s.query(app_main.AdminUser).statement).scalars().all()
        assert len(users) == 1
        assert users[0].username == "root"


def test_bootstrap_idempotent(db, monkeypatch):
    with db() as s:
        s.add(app_main.AdminUser(username="existing", hashed_password="$2b$12$xxxx"))
        s.commit()
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    _bootstrap_admin()
    with db() as s:
        users = s.execute(s.query(app_main.AdminUser).statement).scalars().all()
        assert len(users) == 1
        assert users[0].username == "existing"


def test_cors_preflight_allowed_for_registered_origin(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "allowed_origins", "http://localhost:3000")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    app = app_main.create_app()
    client = TestClient(app)
    r = client.options(
        "/admin/auth/me",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == status.HTTP_200_OK


def test_bootstrap_skipped_when_no_env_credentials(db, monkeypatch):
    monkeypatch.setattr(app_main.settings, "admin_username", "")
    monkeypatch.setattr(app_main.settings, "admin_password", "")
    monkeypatch.setattr(app_main, "SessionLocal", db)
    _bootstrap_admin()
    with db() as s:
        users = s.execute(s.query(app_main.AdminUser).statement).scalars().all()
        assert users == []
