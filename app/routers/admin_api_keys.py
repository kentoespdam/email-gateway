"""Dashboard API key management: list, create (token shown once), patch, delete."""

import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app import database
from app.admin_auth import require_admin_session
from app.models import AdminUser, ApiKey
from app.schemas import ApiKeyCreatedResponse, ApiKeyResponse

router = APIRouter(prefix="/admin/api-keys", tags=["admin-api-keys"])
AdminUserDep = Depends(require_admin_session)


class CreateApiKeyRequest(BaseModel):
    client_name: str = Field(min_length=1, max_length=255)
    allowed_from_addresses: list[EmailStr] = Field(min_length=1)
    expires_at: datetime | None = None


class UpdateApiKeyRequest(BaseModel):
    client_name: str | None = Field(default=None, min_length=1, max_length=255)
    allowed_from_addresses: list[EmailStr] | None = None
    is_active: bool | None = None
    expires_at: datetime | None = None


def _to_response(key: ApiKey) -> ApiKeyResponse:
    return ApiKeyResponse(
        id=str(key.id),
        client_name=key.client_name,
        allowed_from_addresses=list(key.allowed_from_addresses or []),
        is_active=key.is_active,
        expires_at=key.expires_at.isoformat() if key.expires_at else None,
        created_at=key.created_at.isoformat() if key.created_at else None,
    )


@router.get("", response_model=list[ApiKeyResponse])
def list_api_keys(_: AdminUser = AdminUserDep) -> list[ApiKeyResponse]:
    with database.SessionLocal() as db:
        keys = db.execute(select(ApiKey).order_by(ApiKey.created_at)).scalars().all()
        return [_to_response(k) for k in keys]


@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_api_key(
    payload: CreateApiKeyRequest, _: AdminUser = AdminUserDep
) -> ApiKeyCreatedResponse:
    key = ApiKey(
        key_token=secrets.token_urlsafe(32),
        client_name=payload.client_name,
        allowed_from_addresses=[str(a) for a in payload.allowed_from_addresses],
        expires_at=payload.expires_at,
    )
    with database.SessionLocal() as db:
        db.add(key)
        db.commit()
        return ApiKeyCreatedResponse(
            **_to_response(key).model_dump(),
            key_token=key.key_token,  # returned only here, never again
        )


@router.patch("/{key_id}", response_model=ApiKeyResponse)
def update_api_key(
    key_id: uuid.UUID, payload: UpdateApiKeyRequest, _: AdminUser = AdminUserDep
) -> ApiKeyResponse:
    with database.SessionLocal() as db:
        key = db.get(ApiKey, key_id)
        if key is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
        if payload.client_name is not None:
            key.client_name = payload.client_name
        if payload.allowed_from_addresses is not None:
            key.allowed_from_addresses = [str(a) for a in payload.allowed_from_addresses]
        if payload.is_active is not None:
            key.is_active = payload.is_active
        if payload.expires_at is not None:
            key.expires_at = payload.expires_at
        db.commit()
        return _to_response(key)


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_api_key(key_id: uuid.UUID, _: AdminUser = AdminUserDep) -> None:
    with database.SessionLocal() as db:
        key = db.get(ApiKey, key_id)
        if key is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
        db.delete(key)
        db.commit()
