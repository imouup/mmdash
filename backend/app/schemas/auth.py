from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class NotionAuthUrl(BaseModel):
    auth_url: str


class NotionCallback(BaseModel):
    code: str
