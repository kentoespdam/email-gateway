"""FastAPI application: email send + status tracking endpoints."""

import uuid
from contextlib import asynccontextmanager
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.config import settings
from app.database import SessionLocal
from app.logging_setup import configure_logging
from app.models import AdminUser, MailTransaction
from app.routers import admin_api_keys, admin_auth, admin_transactions, admin_users, admin_test_email
from app.schemas import EmailPayload, SendAcceptedResponse, StatusResponse
from app.security import Client, authorize_sender, require_client
from worker.tasks import send_email as send_email_task

router = APIRouter(prefix="/api/v1/emails", tags=["emails"])
CurrentClient = Annotated[Client, Depends(require_client)]


@router.post("/send", response_model=SendAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
def send_email(payload: EmailPayload, client: CurrentClient) -> SendAcceptedResponse:
    authorize_sender(client, payload.from_address)
    task_id = str(uuid.uuid4())
    with SessionLocal() as session:
        session.add(
            MailTransaction(
                task_id=task_id,
                client_id=uuid.UUID(client.id),
                from_address=payload.from_address,
                to_addresses=list(payload.to),
                cc_addresses=[str(a) for a in payload.cc],
                subject=payload.subject,
                attachment_count=len(payload.attachments),
                status="queued",
            )
        )
        session.commit()
    send_email_task.delay(task_id, payload.model_dump(mode="json"))
    return SendAcceptedResponse(task_id=task_id)


@router.get("/{task_id}", response_model=StatusResponse)
def get_status(task_id: str, client: CurrentClient) -> StatusResponse:
    with SessionLocal() as session:
        tx = session.execute(
            select(MailTransaction).where(
                MailTransaction.task_id == task_id,
                MailTransaction.client_id == uuid.UUID(client.id),
            )
        ).scalar_one_or_none()
    if tx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    return StatusResponse(
        task_id=tx.task_id,
        status=tx.status,
        retry_count=tx.retry_count,
        error_message=tx.error_message,
        created_at=tx.created_at.isoformat() if tx.created_at else None,
        delivered_at=tx.delivered_at.isoformat() if tx.delivered_at else None,
    )


def _bootstrap_admin() -> None:
    """Create the first AdminUser from ADMIN_USERNAME/ADMIN_PASSWORD if table is empty."""
    if not (settings.admin_username and settings.admin_password):
        return
    with SessionLocal() as session:
        if session.execute(select(func.count()).select_from(AdminUser)).scalar_one() > 0:
            return
        hashed = bcrypt.hashpw(settings.admin_password.encode(), bcrypt.gensalt()).decode()
        session.add(AdminUser(username=settings.admin_username, hashed_password=hashed))
        session.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _bootstrap_admin()
    yield


def create_app() -> FastAPI:
    configure_logging()
    application = FastAPI(title="Centralized Email Gateway", version="1.0.0", lifespan=lifespan)
    origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router)
    application.include_router(admin_auth.router)
    application.include_router(admin_users.router)
    application.include_router(admin_api_keys.router)
    application.include_router(admin_transactions.router)
    application.include_router(admin_test_email.router)
    return application


app = create_app()
