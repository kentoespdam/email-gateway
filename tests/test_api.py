"""Integration checks for the REST API endpoints."""


def test_send_returns_202(client):
    resp = client.post(
        "/api/v1/emails/send",
        json={
            "from_address": "noreply@x.com",
            "to": ["to@y.com"],
            "subject": "hi",
            "text_content": "hello",
        },
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["task_id"]
    assert body["status"] == "queued"


def test_send_401_bad_key(client):
    resp = client.post(
        "/api/v1/emails/send",
        headers={"X-API-Key": "wrong"},
        json={"from_address": "noreply@x.com", "to": ["to@y.com"], "subject": "hi", "text_content": "x"},
    )
    assert resp.status_code == 401


def test_send_401_no_key(client):
    resp = client.post(
        "/api/v1/emails/send",
        headers={"X-API-Key": ""},
        json={"from_address": "noreply@x.com", "to": ["to@y.com"], "subject": "hi", "text_content": "x"},
    )
    assert resp.status_code == 401


def test_send_403_sender_not_allowed(client):
    resp = client.post(
        "/api/v1/emails/send",
        json={"from_address": "evil@x.com", "to": ["to@y.com"], "subject": "hi", "text_content": "x"},
    )
    assert resp.status_code == 403


def test_send_422_no_body(client):
    resp = client.post(
        "/api/v1/emails/send",
        json={"from_address": "noreply@x.com", "to": ["to@y.com"], "subject": "hi"},
    )
    assert resp.status_code == 422


def test_status_200(client):
    created = client.post(
        "/api/v1/emails/send",
        json={"from_address": "noreply@x.com", "to": ["to@y.com"], "subject": "hi", "text_content": "x"},
    ).json()
    resp = client.get(f"/api/v1/emails/{created['task_id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "queued"
    assert body["retry_count"] == 0


def test_status_404_unknown(client):
    resp = client.get("/api/v1/emails/00000000-0000-0000-0000-000000000099")
    assert resp.status_code == 404


def test_status_404_other_client(client, db):
    created = client.post(
        "/api/v1/emails/send",
        json={"from_address": "noreply@x.com", "to": ["to@y.com"], "subject": "hi", "text_content": "x"},
    ).json()
    # Simulate ownership by another client.
    with db() as s:
        tx = s.execute(
            __import__("sqlalchemy").select(__import__("app.models", fromlist=["MailTransaction"]).MailTransaction)
        ).scalar_one()
        tx.client_id = __import__("uuid").UUID("00000000-0000-0000-0000-000000000002")
        s.commit()
    resp = client.get(f"/api/v1/emails/{created['task_id']}")
    assert resp.status_code == 404
