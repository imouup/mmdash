import difflib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, TeamMember, NotionBinding, ModelSnapshot, User
from app.api.auth import get_current_user
from app.services.notion_fetch import fetch_notion_page_content, notion_blocks_to_markdown

router = APIRouter()


@router.post("/{project_id}/commit")
async def commit_model(project_id: str, message: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    if not project.model_data_page_id:
        raise HTTPException(status_code=400, detail="No model page linked")

    binding = db.query(NotionBinding).filter(NotionBinding.user_id == current_user.id).first()
    if not binding:
        raise HTTPException(status_code=400, detail="Notion not bound")

    content = await fetch_notion_page_content(project.model_data_page_id, binding.access_token)
    markdown = notion_blocks_to_markdown(content.get("blocks", []))

    snapshot = ModelSnapshot(
        project_id=project_id,
        user_id=current_user.id,
        commit_message=message,
        notion_page_id=project.model_data_page_id,
        snapshot_content=markdown,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return {"id": snapshot.id, "message": message, "created_at": snapshot.created_at}


@router.get("/{project_id}/commits")
def list_commits(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    commits = db.query(ModelSnapshot).filter(ModelSnapshot.project_id == project_id).order_by(ModelSnapshot.created_at.desc()).all()
    result = []
    for c in commits:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            "id": c.id,
            "commit_message": c.commit_message,
            "user_email": user.email if user else "未知用户",
            "user_name": user.display_name if user else None,
            "created_at": c.created_at,
            "notion_page_id": c.notion_page_id,
        })
    return result


@router.get("/{project_id}/diff")
async def diff_commits(project_id: str, base_id: str, compare_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    base = db.query(ModelSnapshot).filter(ModelSnapshot.id == base_id, ModelSnapshot.project_id == project_id).first()
    compare = db.query(ModelSnapshot).filter(ModelSnapshot.id == compare_id, ModelSnapshot.project_id == project_id).first()
    if not base or not compare:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    base_user = db.query(User).filter(User.id == base.user_id).first()
    compare_user = db.query(User).filter(User.id == compare.user_id).first()

    diff = list(difflib.unified_diff(
        (base.snapshot_content or "").splitlines(keepends=True),
        (compare.snapshot_content or "").splitlines(keepends=True),
        fromfile=f"{base.commit_message} by {base_user.email if base_user else '未知'}",
        tofile=f"{compare.commit_message} by {compare_user.email if compare_user else '未知'}",
    ))

    return {
        "base": {"id": base.id, "message": base.commit_message, "author": base_user.email if base_user else "未知"},
        "compare": {"id": compare.id, "message": compare.commit_message, "author": compare_user.email if compare_user else "未知"},
        "diff": "".join(diff),
    }


@router.post("/{project_id}/rollback")
async def rollback_model(project_id: str, snapshot_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    snapshot = db.query(ModelSnapshot).filter(ModelSnapshot.id == snapshot_id, ModelSnapshot.project_id == project_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Backup current state before rollback
    binding = db.query(NotionBinding).filter(NotionBinding.user_id == current_user.id).first()
    current_markdown = ""
    if binding and project.model_data_page_id:
        try:
            content = await fetch_notion_page_content(project.model_data_page_id, binding.access_token)
            current_markdown = notion_blocks_to_markdown(content.get("blocks", []))
        except Exception:
            pass

    backup = ModelSnapshot(
        project_id=project_id,
        user_id=current_user.id,
        commit_message=f"Auto-backup before rollback to {snapshot.commit_message}",
        notion_page_id=project.model_data_page_id or snapshot.notion_page_id,
        snapshot_content=current_markdown,
    )
    db.add(backup)
    db.commit()

    # Update model_data_page_id if needed
    if snapshot.notion_page_id and not project.model_data_page_id:
        project.model_data_page_id = snapshot.notion_page_id
        db.commit()

    return {"status": "rollback_prepared", "backup_id": backup.id, "snapshot_id": snapshot.id}
