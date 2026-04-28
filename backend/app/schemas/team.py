from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class TeamCreate(BaseModel):
    name: str


class TeamResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    invite_code: str
    created_at: datetime

    class Config:
        from_attributes = True


class TeamMemberResponse(BaseModel):
    id: str
    team_id: str
    user_id: str
    role: str
    joined_at: datetime
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class JoinTeamRequest(BaseModel):
    invite_code: str
