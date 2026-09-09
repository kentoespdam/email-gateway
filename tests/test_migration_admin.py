"""Verify Alembic migration creates admin_users, admin_sessions, and api_keys.expires_at."""

import os
import tempfile

import pytest
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import sessionmaker

from app.models import AdminUser, AdminSession, ApiKey, Base

os.environ["DATABASE_URL"] = "postgresql+psycopg2://placeholder"

ALEMBIC_INI = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
ALEMBIC_SCRIPT_LOCATION = os.path.join(os.path.dirname(__file__), "..", "alembic")


@pytest.fixture()
def migrated_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    url = f"sqlite+pysqlite:///{path}"
    os.environ["DATABASE_URL"] = url
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    cfg = Config(ALEMBIC_INI)
    cfg.set_main_option("sqlalchemy.url", url)
    cfg.set_main_option("script_location", ALEMBIC_SCRIPT_LOCATION)
    with engine.connect() as conn:
        conn.exec_driver_sql(
            "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) PRIMARY KEY)"
        )
    command.stamp(cfg, "base")
    Base.metadata.drop_all(engine)
    command.upgrade(cfg, "head")
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    yield TestingSession
    engine.dispose()
    os.unlink(path)


def test_migration_creates_admin_tables(migrated_db):
    with migrated_db() as s:
        assert s.execute(select(AdminUser)).scalars().all() == []
        assert s.execute(select(AdminSession)).scalars().all() == []
        assert s.execute(select(ApiKey)).scalars().all() == []


def test_api_key_expires_at_nullable(migrated_db):
    inspector = inspect(migrated_db().bind)
    cols = {c["name"]: c for c in inspector.get_columns("api_keys")}
    assert cols["expires_at"]["nullable"] is True
