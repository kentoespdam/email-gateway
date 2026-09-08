"""Runnable checks for security layer (auth + sender whitelist)."""

import pytest
from fastapi import HTTPException

from app.security import Client, authorize_sender, require_client


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
