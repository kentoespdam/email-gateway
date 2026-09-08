"""Pydantic V2 request/response contracts and payload validation."""

import base64
import binascii

from pydantic import BaseModel, EmailStr, Field, model_validator

# 15 MB total payload cap; base64 inflates by ~4/3, so raw cap ~10.5 MB.
MAX_TOTAL_PAYLOAD_BYTES = 15 * 1024 * 1024


class Attachment(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=3, max_length=255)
    base64_data: str = Field(min_length=1)


class EmailPayload(BaseModel):
    from_address: EmailStr
    to: list[EmailStr] = Field(min_length=1)
    cc: list[EmailStr] = Field(default_factory=list)
    subject: str = Field(min_length=1, max_length=998)
    text_content: str | None = None
    html_content: str | None = None
    attachments: list[Attachment] = Field(default_factory=list)

    @model_validator(mode="after")
    def _require_some_content(self) -> "EmailPayload":
        if not (self.text_content or self.html_content):
            raise ValueError("either text_content or html_content is required")
        return self

    @model_validator(mode="after")
    def _enforce_payload_size(self) -> "EmailPayload":
        total = 0
        for att in self.attachments:
            try:
                total += len(base64.b64decode(att.base64_data, validate=True))
            except (binascii.Error, ValueError) as exc:
                raise ValueError(f"attachment {att.filename!r} is not valid base64") from exc
        if total > MAX_TOTAL_PAYLOAD_BYTES:
            raise ValueError(f"total attachment size exceeds {MAX_TOTAL_PAYLOAD_BYTES} bytes")
        return self


class SendAcceptedResponse(BaseModel):
    task_id: str
    status: str = "queued"


class StatusResponse(BaseModel):
    task_id: str
    status: str
    retry_count: int
    error_message: str | None
    created_at: str | None = None
    delivered_at: str | None = None
