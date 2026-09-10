"""Proxy endpoint to send test emails as an admin."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app import database
from app.admin_auth import require_admin_session
from app.models import AdminUser, ApiKey
from app.schemas import EmailPayload, SendAcceptedResponse
from worker.tasks import send_email as send_email_task

router = APIRouter(prefix="/admin/emails", tags=["admin-test-email"])
AdminUserDep = Depends(require_admin_session)


class TestEmailRequest(EmailPayload):
    api_key_id: uuid.UUID


@router.post("/test-send", response_model=SendAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
def proxy_test_send(
    payload: TestEmailRequest, _: AdminUser = AdminUserDep
) -> SendAcceptedResponse:
    with database.SessionLocal() as db:
        api_key = db.get(ApiKey, payload.api_key_id)
        if api_key is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
        
        if payload.from_address not in api_key.allowed_from_addresses:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="From address not in whitelist"
            )

    task_id = str(uuid.uuid4())
    # Send email using task with the payload directly
    send_email_task.delay(task_id, payload.model_dump(mode="json"))
    return SendAcceptedResponse(task_id=task_id)
