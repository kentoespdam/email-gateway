"""SMTP delivery task: connection-per-task, isolation of failures, ordered retries."""

import base64
import os
import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import make_msgid

from sqlalchemy import select

from app.database import SessionLocal
from app.models import MailTransaction
from worker.celery_app import celery_app

SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
SMTP_TIMEOUT_SECONDS = int(os.environ.get("SMTP_TIMEOUT_SECONDS", "15"))

# Ordered retry delays in seconds; more than 3 retries -> permanent failure.
RETRY_DELAYS = [60, 300, 900]

# SMTP 552 = permanent failure: never retried.
PERMANENT_FAILURES = frozenset({552})


def _build_message(
    *,
    from_address: str,
    to_addresses: list[str],
    cc_addresses: list[str],
    subject: str,
    text_content: str | None,
    html_content: str | None,
    attachments: list[dict],
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = from_address
    msg["To"] = ", ".join(to_addresses)
    if cc_addresses:
        msg["Cc"] = ", ".join(cc_addresses)
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid()
    if text_content:
        msg.set_content(text_content)
    if html_content:
        msg.add_alternative(html_content, subtype="html")
    for att in attachments:
        data = base64.b64decode(att["base64_data"])
        maintype, _, subtype = att["content_type"].partition("/")
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=att["filename"])
    return msg


def _send_via_smtp(msg: EmailMessage, envelope_to: list[str]) -> None:
    # Connection-per-task: fresh SMTP connection, closed on exit.
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.ehlo()
        if SMTP_USE_TLS:
            smtp.starttls()
            smtp.ehlo()
        if SMTP_USERNAME:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(msg, from_addr=msg["From"], to_addrs=envelope_to)


def _smtp_error_text(exc: smtplib.SMTPResponseException) -> str:
    err = exc.smtp_error
    return err.decode(errors="replace") if isinstance(err, bytes) else err


def _load_tx(session, task_id: str) -> MailTransaction | None:
    return session.execute(
        select(MailTransaction).where(MailTransaction.task_id == task_id)
    ).scalar_one_or_none()


def _mark_status(task_id: str, *, status: str, error: str | None = None) -> None:
    with SessionLocal() as session:
        tx = _load_tx(session, task_id)
        if tx is None:
            return
        tx.status = status
        tx.error_message = error
        if status == "sent":
            tx.delivered_at = datetime.now(UTC)
        session.commit()


def _retry_or_fail(task, task_id: str, error: str) -> str:
    """Schedule the next ordered retry or mark the transaction failed."""
    attempt = task.request.retries  # 0-based; retries already performed
    with SessionLocal() as session:
        tx = _load_tx(session, task_id)
        if tx is None:
            return task_id
        tx.retry_count = attempt + 1
        if attempt < len(RETRY_DELAYS):
            tx.status = "queued"
            session.commit()
            raise task.retry(countdown=RETRY_DELAYS[attempt], max_retries=len(RETRY_DELAYS))
        tx.status = "failed"
        tx.error_message = error
        session.commit()
    return task_id


@celery_app.task(bind=True, name="worker.tasks.send_email")
def send_email(self, task_id: str, payload: dict) -> str:
    msg = _build_message(
        from_address=payload["from_address"],
        to_addresses=payload["to"],
        cc_addresses=payload.get("cc", []),
        subject=payload["subject"],
        text_content=payload.get("text_content"),
        html_content=payload.get("html_content"),
        attachments=payload.get("attachments", []),
    )
    envelope_to = list(payload["to"]) + list(payload.get("cc", []))
    try:
        _send_via_smtp(msg, envelope_to)
    except smtplib.SMTPResponseException as exc:
        detail = f"SMTP {exc.smtp_code}: {_smtp_error_text(exc)}"
        if exc.smtp_code in PERMANENT_FAILURES:
            _mark_status(task_id, status="failed", error=detail)
            return task_id  # permanent: no retry
        return _retry_or_fail(self, task_id, error=detail)
    except (TimeoutError, smtplib.SMTPException, OSError) as exc:
        return _retry_or_fail(self, task_id, error=str(exc))  # transient

    _mark_status(task_id, status="sent")
    return task_id
