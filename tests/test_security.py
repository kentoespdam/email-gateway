"""Runnable checks for security layer (auth + sender whitelist)."""

import pytest
from fastapi import HTTPException

from app.security import Client, authorize_sender, require_client


def test_authorize_sender_ok():
    client = Client(id="1", key_token="k", client_name="c", allowed_from_addresses=["noreply@x.com"])
    authorize_sender(client, "noreply@x.com")  # case-insensitive


def test_authorize_sender_forbidden():
    client = Client(id="1", key_token="k", client_name="c", allowed_from_addresses=["noreply@x.com"])
    with pytest.raises(HTTPException) as exc:
        authorize_sender(client, "other@x.com")
    assert exc.value.status_code == 403


def test_require_client_missing_key():
    with pytest.raises(HTTPException) as exc:
        require_client(x_api_key="")
    assert exc.value.status_code == 401
