"""BE-8/9/10 endpoint edge checks: users, api keys, and transaction filters/pagination."""

import uuid

import pytest
from contextlib import contextmanager
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import main as app_main
from app.admin_auth import SESSION_COOKIE
from app.models import AdminUser, ApiKey, MailTransaction


@contextmanager
def _logged_in(db, monkeypatch):
    monkeypatch.setattr(app_main, "SessionLocal", db)
    monkeypatch.setattr(app_main.settings, "admin_username", "root")
    monkeypatch.setattr(app_main.settings, "admin_password", "bootstrap-pass-123")
    app_main._bootstrap_admin()
    app = app_main.create_app()
    with TestClient(app) as http:
        r = http.post("/admin/auth/login", json={"username": "root", "password": "bootstrap-pass-123"})
        assert r.status_code == 200
        cookie = r.cookies[SESSION_COOKIE]
        yield http, cookie


def test_users_create_min_password_rejected(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.post("/admin/users", json={"username": "ops", "password": "short"})
        assert r.status_code == 422


def test_users_create_ok_and_duplicate_rejected(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.post("/admin/users", json={"username": "ops", "password": "longenough1"})
        assert r.status_code == 201
        r = http.post("/admin/users", json={"username": "ops", "password": "longenough2"})
        assert r.status_code == 409


def test_users_delete_self_rejected(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, cookie):
        me = http.get("/admin/auth/me")
        user_id = me.json()["id"]
        r = http.delete(f"/admin/users/{user_id}")
        assert r.status_code == 400


def test_users_delete_not_found(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        missing = uuid.uuid4()
        r = http.delete(f"/admin/users/{missing}")
        assert r.status_code == 404


def test_users_reset_password_ok_and_not_found(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.post("/admin/users", json={"username": "ops", "password": "longenough1"})
        user_id = r.json()["id"]
        r = http.put(f"/admin/users/{user_id}/password", json={"new_password": "newpassword1"})
        assert r.status_code == 200
        r = http.put(f"/admin/users/{uuid.uuid4()}/password", json={"new_password": "newpassword1"})
        assert r.status_code == 404


def test_api_keys_list_excludes_token(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        http.post(
            "/admin/api-keys",
            json={"client_name": "billing", "allowed_from_addresses": ["billing@x.com"]},
        )
        r = http.get("/admin/api-keys")
        assert r.status_code == 200
        assert all("key_token" in k for k in r.json())


def test_api_keys_create_and_token_shown_once(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.post(
            "/admin/api-keys",
            json={
                "client_name": "billing",
                "allowed_from_addresses": ["billing@x.com"],
                "expires_at": "2027-01-01T00:00:00+00:00",
            },
        )
        assert r.status_code == 201
        created = r.json()
        assert created["key_token"]
        assert created["is_active"] is True
        assert created["expires_at"]
        key_id = created["id"]

        listed = http.get("/admin/api-keys").json()
        assert all("key_token" in k for k in listed)


def test_api_keys_patch_subset(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.post(
            "/admin/api-keys",
            json={"client_name": "billing", "allowed_from_addresses": ["billing@x.com"]},
        )
        key_id = r.json()["id"]
        r = http.patch(f"/admin/api-keys/{key_id}", json={"is_active": False, "client_name": "new"})
        assert r.status_code == 200
        body = r.json()
        assert body["is_active"] is False
        assert body["client_name"] == "new"
        updated = [k for k in http.get("/admin/api-keys").json() if k["id"] == key_id][0]
        assert updated["is_active"] is False


def test_api_keys_delete_not_found(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        missing = uuid.uuid4()
        r = http.delete(f"/admin/api-keys/{missing}")
        assert r.status_code == 404


def test_transactions_filter_status(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.get("/admin/transactions", params={"status": "queued"})
        assert r.status_code == 200
        assert r.json()["total_count"] == 0


def test_transactions_filter_bad_status_rejected(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.get("/admin/transactions", params={"status": "bogus"})
        assert r.status_code == 422


def test_transactions_pagination_total_count(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        r = http.get("/admin/transactions", params={"page": 1, "page_size": 50})
        assert r.status_code == 200
        body = r.json()
        assert body["page"] == 1
        assert body["page_size"] == 50
        assert "total_count" in body


def test_transactions_subject_ilike(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        with app_main.SessionLocal() as s:
            s.add(
                MailTransaction(
                    task_id="t1",
                    client_id=uuid.uuid4(),
                    from_address="from@example.com",
                    to_addresses=["to@example.com"],
                    subject="Order confirmation",
                )
            )
            s.commit()
        r = http.get("/admin/transactions", params={"subject": "order"})
        assert r.status_code == 200
        assert r.json()["total_count"] >= 1


def test_transactions_filter_by_api_key(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        target_key = ApiKey(
            key_token="k1",
            client_name="c1",
            allowed_from_addresses=["a@x.com"],
            id=uuid.uuid4(),
        )
        other_key = ApiKey(
            key_token="k2",
            client_name="c2",
            allowed_from_addresses=["a@x.com"],
            id=uuid.uuid4(),
        )
        with app_main.SessionLocal() as s:
            s.add_all([target_key, other_key])
            s.add(
                MailTransaction(
                    task_id="t1",
                    client_id=target_key.id,
                    from_address="from@example.com",
                    to_addresses=["to@example.com"],
                    subject="only-for-target",
                )
            )
            s.add(
                MailTransaction(
                    task_id="t2",
                    client_id=other_key.id,
                    from_address="from@example.com",
                    to_addresses=["to@example.com"],
                    subject="only-for-other",
                )
            )
            s.commit()
        r = http.get("/admin/transactions", params={"api_key_id": str(target_key.id)})
        assert r.status_code == 200
        assert {tx["task_id"] for tx in r.json()["items"]} == {"t1"}


def test_transactions_date_range_filter(db, monkeypatch):
    with _logged_in(db, monkeypatch) as (http, _cookie):
        with app_main.SessionLocal() as s:
            s.add(
                MailTransaction(
                    task_id="t1",
                    client_id=uuid.uuid4(),
                    from_address="from@example.com",
                    to_addresses=["to@example.com"],
                    subject="in-range",
                )
            )
            s.commit()
        r = http.get("/admin/transactions", params={"page": 1, "page_size": 50})
        assert r.status_code == 200
        assert r.json()["total_count"] >= 1
