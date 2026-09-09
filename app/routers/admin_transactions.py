"""Dashboard log monitoring: filtered, paginated mail transaction list."""

import uuid
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session as SASession

from app import database
from app.admin_auth import require_admin_session
from app.models import AdminUser, MailTransaction
from app.schemas import TransactionResponse

router = APIRouter(prefix="/admin/transactions", tags=["admin-transactions"])
AdminUserDep = Depends(require_admin_session)


class TransactionPage(BaseModel):
    items: list[TransactionResponse]
    total_count: int
    page: int
    page_size: int


def _to_response(tx: MailTransaction) -> TransactionResponse:
    return TransactionResponse(
        id=str(tx.id),
        task_id=tx.task_id,
        from_address=tx.from_address,
        to_addresses=list(tx.to_addresses or []),
        cc_addresses=list(tx.cc_addresses or []),
        subject=tx.subject,
        attachment_count=tx.attachment_count,
        status=tx.status,
        error_message=tx.error_message,
        retry_count=tx.retry_count,
        created_at=tx.created_at.isoformat() if tx.created_at else None,
        delivered_at=tx.delivered_at.isoformat() if tx.delivered_at else None,
    )


def _load_page(db: SASession, filters: dict, page: int, page_size: int) -> TransactionPage:
    where = [MailTransaction.status == filters["status"]] if filters["status"] else []
    if filters["from_date"]:
        where.append(MailTransaction.created_at >= filters["from_date"])
    if filters["to_date"]:
        where.append(MailTransaction.created_at <= filters["to_date"])
    if filters["api_key_id"]:
        where.append(MailTransaction.client_id == filters["api_key_id"])
    if filters["subject"]:
        where.append(MailTransaction.subject.ilike(f"%{filters['subject']}%"))
    total_count = db.execute(
        select(func.count()).select_from(MailTransaction).where(*where)
    ).scalar_one()
    rows = db.execute(
        select(MailTransaction)
        .where(*where)
        .order_by(MailTransaction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return TransactionPage(
        items=[_to_response(tx) for tx in rows],
        total_count=total_count,
        page=page,
        page_size=page_size,
    )


@router.get("", response_model=TransactionPage)
def list_transactions(
    _: AdminUser = AdminUserDep,
    filter_status: str | None = Query(
        default=None, alias="status", pattern="^(queued|sent|failed)$"
    ),
    from_date: date | None = None,
    to_date: date | None = None,
    api_key_id: uuid.UUID | None = None,
    subject: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> TransactionPage:
    server_tz = datetime.now().astimezone().tzinfo  # server-local tz
    from_dt = datetime.combine(from_date, time.min, tzinfo=server_tz) if from_date else None
    to_dt = datetime.combine(to_date, time.max, tzinfo=server_tz) if to_date else None
    with database.SessionLocal() as db:
        return _load_page(
            db,
            {
                "status": filter_status,
                "from_date": from_dt,
                "to_date": to_dt,
                "api_key_id": api_key_id,
                "subject": subject,
            },
            page,
            page_size,
        )
