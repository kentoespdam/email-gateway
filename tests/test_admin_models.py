"""Explicit model checks for AdminUser and AdminSession (UUID PK, unique username, FK, sliding expiry)."""

from datetime import UTC, datetime, timedelta
import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import AdminSession, AdminUser


def test_admin_user_create(db):
    with db() as s:
        u = AdminUser(username="alice", hashed_password="$2b$12$xxxx")
        s.add(u)
        s.commit()
        s.refresh(u)
        assert str(u.id)
        assert u.username == "alice"
        assert u.created_at


def test_admin_user_username_unique(db):
    with db() as s:
        s.add(AdminUser(username="bob", hashed_password="$2b$12$xxxx"))
        s.commit()
        with pytest.raises(IntegrityError):
            s.add(AdminUser(username="bob", hashed_password="$2b$12$yyyy"))
            s.commit()


def test_admin_session_fk_and_sliding_window(db):
    now = datetime.now(UTC)
    with db() as s:
        user = AdminUser(username="carol", hashed_password="$2b$12$xxxx")
        s.add(user)
        s.commit()
        s.refresh(user)

        session = AdminSession(
            user_id=user.id, token=uuid.uuid4(), last_seen_at=datetime.now(UTC), expires_at=datetime.now(UTC) + timedelta(hours=24)
        )
        s.add(session)
        s.commit()

        fetched = s.execute(select(AdminSession).where(AdminSession.user_id == user.id)).scalar_one()
        assert fetched.user_id == user.id
        assert fetched.token == session.token
        assert fetched.last_seen_at
        assert fetched.expires_at

        # Sliding window: recompute expires_at when last_seen_at updates.
        fetched.last_seen_at = now
        fetched.expires_at = now + timedelta(hours=24)
        s.commit()
        assert fetched.expires_at > fetched.last_seen_at


def test_admin_session_token_unique(db):
    now = datetime.now(UTC)
    with db() as s:
        user = AdminUser(username="dave", hashed_password="$2b$12$xxxx")
        s.add(user)
        s.commit()
        s.refresh(user)
        tok = uuid.uuid4()
        s.add_all(
            [
                AdminSession(user_id=user.id, token=tok, last_seen_at=now, expires_at=now + timedelta(hours=24)),
                AdminSession(user_id=user.id, token=tok, last_seen_at=now, expires_at=now + timedelta(hours=24)),
            ]
        )
        with pytest.raises(IntegrityError):
            s.commit()
