"""Dashboard auth endpoints: login, logout, me (HttpOnly cookie session)."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app import database
from app.admin_auth import (
    SESSION_COOKIE,
    SESSION_TTL,
    require_admin_session,
    require_admin_session_cookie,
    verify_password,
)
from app.models import AdminSession, AdminUser
from app.schemas import AdminUserResponse

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])
CurrentUser = Annotated[AdminUser, Depends(require_admin_session)]
SessionCookie = Depends(require_admin_session_cookie)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


def user_response(user: AdminUser) -> AdminUserResponse:
    return AdminUserResponse(
        id=str(user.id),
        username=user.username,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.post("/login", response_model=AdminUserResponse)
def login(payload: LoginRequest, response: Response) -> AdminUserResponse:
    with database.SessionLocal() as db:
        user = db.execute(
            select(AdminUser).where(AdminUser.username == payload.username)
        ).scalar_one_or_none()
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
        token = AdminSession(
            user_id=user.id,
            expires_at=datetime.now(UTC) + SESSION_TTL,
        )
        db.add(token)
        db.commit()
        response.set_cookie(
            key=SESSION_COOKIE,
            value=str(token.token),
            httponly=True,
            samesite="lax",
        )
        return user_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session_token: str = SessionCookie,
) -> None:
    with database.SessionLocal() as db:
        admin_session = db.execute(
            select(AdminSession).where(AdminSession.token == uuid.UUID(session_token))
        ).scalar_one_or_none()
        if admin_session is not None:
            db.delete(admin_session)
            db.commit()
    response.delete_cookie(SESSION_COOKIE)


@router.get("/me", response_model=AdminUserResponse)
def me(user: CurrentUser) -> AdminUserResponse:
    return user_response(user)
