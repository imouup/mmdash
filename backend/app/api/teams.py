import random
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Team, TeamMember, User
from app.schemas.team import TeamCreate, TeamResponse, TeamMemberResponse, JoinTeamRequest
from app.api.auth import get_current_user

router = APIRouter()


def _generate_invite_code() -> str:
    """Generate a 6-char uppercase alphanumeric invite code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@router.post("", response_model=TeamResponse)
def create_team(data: TeamCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    invite_code = _generate_invite_code()
    team = Team(
        name=data.name,
        owner_id=current_user.id,
        invite_code=invite_code,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    # Add creator as owner member
    member = TeamMember(team_id=team.id, user_id=current_user.id, role="owner")
    db.add(member)
    db.commit()
    return team


@router.get("", response_model=list[TeamResponse])
def list_teams(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    teams = db.query(Team).join(TeamMember).filter(TeamMember.user_id == current_user.id).all()
    return teams


@router.post("/join")
def join_team(data: JoinTeamRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.invite_code == data.invite_code).first()
    if not team:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    existing = db.query(TeamMember).filter(TeamMember.team_id == team.id, TeamMember.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")
    member = TeamMember(team_id=team.id, user_id=current_user.id, role="member")
    db.add(member)
    db.commit()
    return {"status": "joined", "team_id": team.id}


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(team_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    return team


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
def list_team_members(team_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    members = db.query(TeamMember).filter(TeamMember.team_id == team_id).all()
    result = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        result.append({
            "id": m.id,
            "team_id": m.team_id,
            "user_id": m.user_id,
            "role": m.role,
            "joined_at": m.joined_at,
            "user_email": user.email if user else None,
            "user_name": user.display_name if user else None,
        })
    return result


@router.delete("/{team_id}/members/{user_id}")
def remove_member(team_id: str, user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can remove members")
    member = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"status": "removed"}


@router.delete("/{team_id}")
def delete_team(team_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete team")
    db.delete(team)
    db.commit()
    return {"status": "deleted"}
