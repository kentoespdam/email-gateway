"""Integration checks for the REST API endpoints."""

import uuid

from sqlalchemy import select

from app.models import MailTransaction

PAYLOAD = {
    "from_address": "noreply@x.com",
    "to": ["to@y.com"],
    "subject": "hi",
    "text_content": "hello",
}


def _send(client, headers=None, **overrides):
    body = {**PAYLOAD, **overrides}
    kwargs = {"json": body}
    if headers:
        kwargs["headers"] = headers
    return client.post("/api/v1/emails/send", **kwargs)


def test_send_returns_202(client):
    resp = _send(client)
    assert resp.status_code == 202
    body = resp.json()
    assert body["task_id"]
    assert body["status"] == "queued"


def test_send_401_bad_key(client):
    resp = _send(client, headers={"X-API-Key": "wrong"})
    assert resp.status_code == 401


def test_send_401_no_key(client):
    resp = _send(client, headers={"X-API-Key": ""})
    assert resp.status_code == 401


def test_send_403_sender_not_allowed(client):
    resp = _send(client, from_address="evil@x.com")
    assert resp.status_code == 403


def test_send_422_no_body(client):
    resp = _send(client, text_content=None, html_content=None)
    assert resp.status_code == 422


def test_status_200(client):
    created = _send(client).json()
    resp = client.get(f"/api/v1/emails/{created['task_id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "queued"
    assert body["retry_count"] == 0


def test_status_404_unknown(client):
    resp = client.get(f"/api/v1/emails/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_status_404_other_client(client, db):
    created = _send(client).json()
    # Simulate ownership by another client.
    with db() as s:
        tx = s.execute(select(MailTransaction)).scalar_one()
        tx.client_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
        s.commit()
    resp = client.get(f"/api/v1/emails/{created['task_id']}")
    assert resp.status_code == 404