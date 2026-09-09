"""X-API-Key authentication and sender-whitelist authorization."""

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ApiKey


@dataclass(frozen=True)
class Client:
    id: str
    key_token: str
    client_name: str
    allowed_from_addresses: list[str]


def _lookup_api_key(session: Session, key_token: str) -> ApiKey | None:
    return session.execute(
        select(ApiKey).where(
            ApiKey.key_token == key_token,
            ApiKey.is_active.is_(True),
            (ApiKey.expires_at.is_(None)) | (ApiKey.expires_at > datetime.now(UTC)),
        )
    ).scalar_one_or_none()


def require_client(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> Client:
    """Authenticate caller via X-API-Key. 401 if missing/unknown/inactive."""
    if not x_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing API key")
    with SessionLocal() as session:
        api_key = _lookup_api_key(session, x_api_key)
    if api_key is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or inactive API key")
    return Client(
        id=str(api_key.id),
        key_token=api_key.key_token,
        client_name=api_key.client_name,
        allowed_from_addresses=list(api_key.allowed_from_addresses or []),
    )


def authorize_sender(client: Client, from_address: str) -> None:
    """Raise 403 if from_address is not whitelisted for this client."""
    if from_address.lower() not in {a.lower() for a in client.allowed_from_addresses}:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Sender {from_address!r} not allowed for this API key",
        )
