"""Unit tests for Pydantic schemas: validation, size cap, body requirement."""

import base64

import pytest
from pydantic import ValidationError

from app.schemas import MAX_TOTAL_PAYLOAD_BYTES, EmailPayload

BASE = {"from_address": "a@b.com", "to": ["c@d.com"], "subject": "hi"}


def test_valid_text_payload():
    p = EmailPayload(**BASE, text_content="hello")
    assert p.text_content == "hello"
    assert p.attachments == []


def test_valid_html_only_payload():
    p = EmailPayload(**BASE, html_content="<p>hi</p>")
    assert p.html_content == "<p>hi</p>"


def test_no_body_rejected():
    with pytest.raises(ValidationError, match="text_content or html_content"):
        EmailPayload(**BASE)


def test_invalid_email_rejected():
    with pytest.raises(ValidationError):
        EmailPayload(**{**BASE, "to": ["not-an-email"]}, text_content="x")


def test_attachment_over_15mb_rejected():
    big = base64.b64encode(b"x" * (MAX_TOTAL_PAYLOAD_BYTES + 1)).decode()
    with pytest.raises(ValidationError, match="exceeds"):
        EmailPayload(**BASE, text_content="x", attachments=[
            {"filename": "big.bin", "content_type": "application/octet-stream", "base64_data": big}
        ])


def test_attachment_at_limit_accepted():
    data = base64.b64encode(b"x" * MAX_TOTAL_PAYLOAD_BYTES).decode()
    p = EmailPayload(**BASE, text_content="x", attachments=[
        {"filename": "big.bin", "content_type": "application/octet-stream", "base64_data": data}
    ])
    assert len(p.attachments) == 1


def test_invalid_base64_rejected():
    with pytest.raises(ValidationError, match="base64"):
        EmailPayload(**BASE, text_content="x", attachments=[
            {"filename": "b.txt", "content_type": "text/plain", "base64_data": "!!!not-b64!!!"}
        ])


def test_empty_to_rejected():
    with pytest.raises(ValidationError):
        EmailPayload(**{**BASE, "to": []}, text_content="x")
