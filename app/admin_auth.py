"""Dashboard auth: bcrypt password helpers + AdminSession cookie dependency."""

import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import Cookie, HTTPException, status
from sqlalchemy import select

from app import database
from app.models import AdminSession, AdminUser

SESSION_COOKIE = "session_token"
SESSION_TTL = timedelta(hours=24)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _validated_user(session_token: str | None) -> AdminUser:
    """Return the AdminUser for a live session token, sliding the 24h window."""
    if not session_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        token_uuid = uuid.UUID(session_token)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session") from None
    with database.SessionLocal() as db:
        admin_session = db.execute(
            select(AdminSession).where(
                AdminSession.token == token_uuid,
                AdminSession.expires_at > datetime.now(UTC),
            )
        ).scalar_one_or_none()
        if admin_session is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
        now = datetime.now(UTC)
        admin_session.last_seen_at = now
        admin_session.expires_at = now + SESSION_TTL
        user = db.get(AdminUser, admin_session.user_id)
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
        db.commit()
        return user


def require_admin_session_cookie(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> str:
    """Auth dependency for endpoints that only need to delete/inspect the token."""
    _validated_user(session_token)
    return session_token  # type: ignore[return-value]


def require_admin_session(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
) -> AdminUser:
    """Auth dependency returning the authenticated AdminUser."""
    return _validated_user(session_token)
