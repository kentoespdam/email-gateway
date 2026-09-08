"""Celery application configured with Redis broker and backend."""

import os

from celery import Celery

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "email_gateway",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["worker.tasks"],
)

celery_app.conf.update(
    task_acks_late=True,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)
