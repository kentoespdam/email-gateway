"""Celery application configured with Redis broker and backend."""

from celery import Celery
from app.config import settings

celery_app = Celery(
    "email_gateway",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["worker.tasks"],
)

celery_app.conf.update(
    task_acks_late=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)
