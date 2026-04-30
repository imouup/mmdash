from pydantic import BaseModel, ConfigDict, EmailStr
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

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── Provider Auth (replaces Notion-specific) ────────────────────────────────

class ProviderAuthUrl(BaseModel):
    auth_url: str


class ProviderCallback(BaseModel):
    code: str


# Backward-compatible aliases
NotionAuthUrl = ProviderAuthUrl
NotionCallback = ProviderCallback
