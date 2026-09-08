"""Checks for the SMTP delivery task (mocked SMTP, fake DB row)."""

from unittest.mock import MagicMock, patch

import pytest
import smtplib

from worker import tasks
from worker.tasks import RETRY_DELAYS, send_email


@pytest.fixture()
def tx_row(monkeypatch):
    row = MagicMock()
    session = MagicMock()
    session.__enter__ = lambda s: session
    session.__exit__ = lambda s, *a: False
    session.execute.return_value.scalar_one_or_none.return_value = row
    monkeypatch.setattr(tasks, "SessionLocal", lambda: session)
    return row


PAYLOAD = {
    "from_address": "noreply@x.com",
    "to_addresses": ["to@y.com"],
    "cc_addresses": [],
    "subject": "s",
    "text_content": "hello",
    "attachments": [],
}


def _run(retries: int) -> None:
    """Run the bound task with a simulated retry count."""
    send_email.push_request(retries=retries)
    try:
        send_email.run("t1", PAYLOAD)
    finally:
        send_email.pop_request()


def test_success_marks_sent(tx_row):
    with patch.object(tasks, "_send_via_smtp"):
        _run(retries=0)
    assert tx_row.status == "sent"
    assert tx_row.delivered_at is not None


def test_552_no_retry(tx_row):
    err = smtplib.SMTPResponseException(552, "quota exceeded")
    with patch.object(tasks, "_send_via_smtp", side_effect=err):
        _run(retries=0)
    assert tx_row.status == "failed"
    assert "552" in tx_row.error_message


def test_transient_schedules_retry(tx_row):
    retry_mock = MagicMock(side_effect=RuntimeError("retry-scheduled"))
    with patch.object(tasks, "_send_via_smtp", side_effect=smtplib.SMTPException("down")), \
         patch.object(send_email, "retry", retry_mock), \
         pytest.raises(RuntimeError, match="retry-scheduled"):
        _run(retries=0)
    assert tx_row.retry_count == 1
    retry_mock.assert_called_once_with(countdown=RETRY_DELAYS[0], max_retries=3)


def test_retries_exhausted_marks_failed(tx_row):
    with patch.object(tasks, "_send_via_smtp", side_effect=smtplib.SMTPException("down")):
        _run(retries=3)
    assert tx_row.status == "failed"
