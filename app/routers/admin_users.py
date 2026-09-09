"""Dashboard user management: list, create, delete (not self), reset password."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app import database
from app.admin_auth import hash_password, require_admin_session
from app.models import AdminUser
from app.routers.admin_auth import user_response
from app.schemas import AdminUserResponse

router = APIRouter(prefix="/admin/users", tags=["admin-users"])
AdminUserDep = Depends(require_admin_session)


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=255)


@router.get("", response_model=list[AdminUserResponse])
def list_users(_: AdminUser = AdminUserDep) -> list[AdminUserResponse]:
    with database.SessionLocal() as db:
        users = db.execute(select(AdminUser).order_by(AdminUser.created_at)).scalars().all()
        return [user_response(u) for u in users]


@router.post("", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: CreateUserRequest, current: AdminUser = AdminUserDep) -> AdminUserResponse:
    with database.SessionLocal() as db:
        exists = db.execute(
            select(AdminUser).where(AdminUser.username == payload.username)
        ).scalar_one_or_none()
        if exists is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
        user = AdminUser(username=payload.username, hashed_password=hash_password(payload.password))
        db.add(user)
        db.commit()
        return user_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, current: AdminUser = AdminUserDep) -> None:
    if user_id == current.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete your own account")
    with database.SessionLocal() as db:
        user = db.get(AdminUser, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        db.delete(user)
        db.commit()


@router.put("/{user_id}/password", response_model=AdminUserResponse)
def reset_password(
    user_id: uuid.UUID, payload: ResetPasswordRequest, current: AdminUser = AdminUserDep
) -> AdminUserResponse:
    with database.SessionLocal() as admin_user_db:
        user = admin_user_db.get(AdminUser, user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        user.hashed_password = hash_password(payload.new_password)
        admin_user_db.commit()
        return user_response(user)
