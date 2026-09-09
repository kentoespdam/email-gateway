"""Runnable checks for security layer (auth + sender whitelist)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.models import ApiKey
from app.security import Client, _lookup_api_key, authorize_sender, require_client


def _client() -> Client:
    return Client(
        id="1",
        key_token="k",
        client_name="c",
        allowed_from_addresses=["noreply@x.com"],
    )


def test_authorize_sender_ok():
    authorize_sender(_client(), "noreply@x.com")  # case-insensitive


def test_authorize_sender_forbidden():
    with pytest.raises(HTTPException) as exc:
        authorize_sender(_client(), "other@x.com")
    assert exc.value.status_code == 403


def test_require_client_missing_key():
    with pytest.raises(HTTPException) as exc:
        require_client(x_api_key="")
    assert exc.value.status_code == 401


def test_lookup_api_key_expiry(db):
    now = datetime.now(UTC)
    with db() as s:
        s.add_all(
            [
                ApiKey(
                    key_token="expired",
                    client_name="c",
                    allowed_from_addresses=[],
                    expires_at=now - timedelta(days=1),
                ),
                ApiKey(
                    key_token="not-yet",
                    client_name="c",
                    allowed_from_addresses=[],
                    expires_at=now + timedelta(days=1),
                ),
                ApiKey(key_token="never", client_name="c", allowed_from_addresses=[]),
            ]
        )
        s.commit()
        assert _lookup_api_key(s, "expired") is None
        assert _lookup_api_key(s, "not-yet") is not None
        assert _lookup_api_key(s, "never") is not None


def test_expired_api_key_rejected_via_http(db, monkeypatch):
    from fastapi.testclient import TestClient

    from app import security
    from app.main import app

    with db() as s:
        s.add(
            ApiKey(
                key_token="expired",
                client_name="c",
                allowed_from_addresses=["noreply@x.com"],
                expires_at=datetime.now(UTC) - timedelta(days=1),
            )
        )
        s.commit()
    monkeypatch.setattr(security, "SessionLocal", db)
    with TestClient(app) as http:
        resp = http.get("/api/v1/emails/some-task", headers={"X-API-Key": "expired"})
    assert resp.status_code == 401
