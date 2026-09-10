import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.models import ApiKey, AdminUser, MailTransaction
from app.database import SessionLocal
from app.routers import admin_test_email

def test_test_email_proxy(db, monkeypatch):
    monkeypatch.setattr("app.main.SessionLocal", db)
    monkeypatch.setattr("app.routers.admin_test_email.send_email_task.delay", lambda *args, **kwargs: None)
    monkeypatch.setattr("app.main.settings.admin_username", "root")
    monkeypatch.setattr("app.main.settings.admin_password", "bootstrap-pass-123")
    from app.main import _bootstrap_admin
    _bootstrap_admin()

    with TestClient(app) as http:
        # Login
        http.post("/admin/auth/login", json={"username": "root", "password": "bootstrap-pass-123"})
        
        # Create an API Key for whitelist
        with db() as session:
            api_key = ApiKey(
                key_token=f"test-token-{uuid.uuid4()}",
                client_name="test-client",
                allowed_from_addresses=["test@example.com"],
            )
            session.add(api_key)
            session.commit()
            api_key_id = api_key.id
    
        # Valid send
        r = http.post(
            "/admin/emails/test-send",
            json={
                "api_key_id": str(api_key_id),
                "from_address": "test@example.com",
                "to": ["receiver@example.com"],
                "subject": "Test Email",
                "text_content": "Hello world"
            }
        )
        assert r.status_code == 202
        assert "task_id" in r.json()
        task_id = r.json()["task_id"]

        with db() as session:
            tx = session.query(MailTransaction).filter_by(task_id=task_id).first()
            assert tx is not None
            assert tx.client_id == api_key_id
            assert tx.status == "queued"
            assert tx.from_address == "test@example.com"
        
        # Invalid whitelist
        r = http.post(
            "/admin/emails/test-send",
            json={
                "api_key_id": str(api_key_id),
                "from_address": "unauthorized@example.com",
                "to": ["receiver@example.com"],
                "subject": "Test Email",
                "text_content": "Hello world"
            }
        )
        assert r.status_code == 403
