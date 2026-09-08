"""Structured logging setup: JSON in production, console locally."""

import logging
import sys

import structlog


def configure_logging(*, app_env: str = "local", log_level: str = "INFO") -> None:
    level = logging.getLevelNamesMapping().get(log_level.upper(), logging.INFO)
    renderer: structlog.dev.ConsoleRenderer | structlog.processors.JSONRenderer = (
        structlog.dev.ConsoleRenderer()
        if app_env == "local"
        else structlog.processors.JSONRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        cache_logger_on_first_use=True,
    )
