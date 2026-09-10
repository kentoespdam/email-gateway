"""Seed an admin user for dashboard access.

Usage: uv run scripts/seed_admin.py [username] [password]
Reads ADMIN_USERNAME and ADMIN_PASSWORD from env, defaulting to admin / changeme123.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.admin_auth import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import AdminUser  # noqa: E402


def main() -> None:
    username = sys.argv[1] if len(sys.argv) > 1 else os.getenv("ADMIN_USERNAME", "admin")
    password = sys.argv[2] if len(sys.argv) > 2 else os.getenv("ADMIN_PASSWORD", "changeme123")

    with SessionLocal() as session:
        user = session.execute(
            select(AdminUser).where(AdminUser.username == username)
        ).scalar_one_or_none()
        if user is not None:
            user.hashed_password = hash_password(password)
            session.commit()
            print(f"Updated admin user: {username}")
        else:
            user = AdminUser(username=username, hashed_password=hash_password(password))
            session.add(user)
            session.commit()
            print(f"Created admin user: {username}")


if __name__ == "__main__":
    main()
