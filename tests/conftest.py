"""Shared fixtures: temp SQLite DB, seeded API key, FastAPI TestClient."""

import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import SessionLocal
from app.models import ApiKey, Base
from app.security import Client

API_KEY = "test-key-123"
CLIENT = Client(id="00000000-0000-0000-0000-000000000001", key_token=API_KEY, client_name="test", allowed_from_addresses=["noreply@x.com"])


@pytest.fixture()
def db(monkeypatch):
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    url = f"sqlite+pysqlite:///{path}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr("app.database.SessionLocal", TestingSession)
    monkeypatch.setattr("app.main.SessionLocal", TestingSession)
    with TestingSession() as s:
        s.add(ApiKey(key_token=API_KEY, client_name="test", allowed_from_addresses=["noreply@x.com"]))
        s.commit()
    yield TestingSession
    engine.dispose()
    os.unlink(path)


@pytest.fixture()
def client(db, monkeypatch):
    from app import security
    from app.main import app

    monkeypatch.setattr(security, "SessionLocal", db)
    monkeypatch.setattr("app.main.send_email_task.delay", lambda *a, **k: None)
    return TestClient(app, headers={"X-API-Key": API_KEY})
