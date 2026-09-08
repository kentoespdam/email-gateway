"""Alembic environment: target metadata from app.models, URL from env."""

import os

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.models import Base

config = context.config
config.set_main_option("sqlalchemy.url", os.environ.get("DATABASE_URL", config.attributes.get("url", "")))

target_metadata = Base.metadata


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
