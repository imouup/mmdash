from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    git_remote_url: Optional[str] = None


class ProjectResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}

    id: str
    team_id: str
    name: str
    description: Optional[str]
    base_data_page_id: Optional[str]
    model_data_page_id: Optional[str]
    git_remote_url: Optional[str]
    created_at: datetime
