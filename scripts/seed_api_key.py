"""Seed an API key for manual testing.

Usage: uv run scripts/seed_api_key.py [key_token] [client_name] [allowed_from ...]
Defaults: token printed via secrets.token_hex, client "manual-test",
sender "noreply@example.com".
"""

import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import ApiKey  # noqa: E402


def main() -> None:
    token = sys.argv[1] if len(sys.argv) > 1 else "egw_" + secrets.token_hex(16)
    client_name = sys.argv[2] if len(sys.argv) > 2 else "manual-test"
    allowed = sys.argv[3:] or ["noreply@example.com"]

    with SessionLocal() as session:
        existing = session.execute(
            select(ApiKey).where(ApiKey.key_token == token)
        ).scalar_one_or_none()
        if existing is not None:
            print(f"key already exists: {token}")
            print(f"  client: {existing.client_name}")
            print(f"  allowed senders: {existing.allowed_from_addresses}")
            return
        session.add(
            ApiKey(key_token=token, client_name=client_name, allowed_from_addresses=allowed)
        )
        session.commit()
    print(f"seeded API key: {token}")
    print(f"  client: {client_name}")
    print(f"  allowed senders: {allowed}")


if __name__ == "__main__":
    main()
