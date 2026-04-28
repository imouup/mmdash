from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, TeamMember, NotionBinding
from app.api.auth import get_current_user
from app.models import User
from app.services.notion_fetch import fetch_notion_page_content, notion_blocks_to_markdown
from app.services.cache import get_cached_notion_page, set_cached_notion_page
from app.services.openai_service import analyze_symbols, analyze_structure, explain_formula

router = APIRouter()


@router.get("/{project_id}/content")
async def get_model_content(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    if not project.model_data_page_id:
        raise HTTPException(status_code=400, detail="No model page linked to this project")

    binding = db.query(NotionBinding).filter(NotionBinding.user_id == current_user.id).first()
    if not binding:
        raise HTTPException(status_code=400, detail="Notion not bound")

    try:
        content = await fetch_notion_page_content(project.model_data_page_id, binding.access_token)
        markdown = notion_blocks_to_markdown(content.get("blocks", []))
        return {"page_id": project.model_data_page_id, "markdown": markdown, "blocks": content.get("blocks", [])}
    except Exception as e:
        # Fallback to cache if available
        cached = get_cached_notion_page(project.model_data_page_id)
        if cached:
            markdown = notion_blocks_to_markdown(cached.get("blocks", []))
            return {"page_id": project.model_data_page_id, "markdown": markdown, "blocks": cached.get("blocks", []), "from_cache": True}
        raise HTTPException(status_code=500, detail=f"Failed to fetch Notion content: {str(e)}")


@router.get("/{project_id}/export/md")
async def export_markdown(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = await get_model_content(project_id, current_user, db)
    md_content = result.get("markdown", "")
    return Response(content=md_content, media_type="text/markdown", headers={"Content-Disposition": f"attachment; filename=model_{project_id}.md"})


@router.post("/{project_id}/link")
def link_model_page(project_id: str, page_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")
    project.model_data_page_id = page_id
    db.commit()
    return {"status": "linked", "model_data_page_id": page_id}


@router.get("/{project_id}/analyze/symbols")
async def get_symbols(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = await get_model_content(project_id, current_user, db)
    markdown = result.get("markdown", "")
    symbols = await analyze_symbols(markdown)
    return {"symbols": symbols, "disclaimer": "仅供参考"}


@router.get("/{project_id}/analyze/structure")
async def get_structure(project_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = await get_model_content(project_id, current_user, db)
    markdown = result.get("markdown", "")
    structure = await analyze_structure(markdown)
    return {"structure": structure, "disclaimer": "仅供参考"}


@router.post("/{project_id}/analyze/formula")
async def explain_formula_endpoint(project_id: str, formula: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = await get_model_content(project_id, current_user, db)
    markdown = result.get("markdown", "")
    explanation = await explain_formula(formula, markdown[:2000])
    return {"explanation": explanation, "disclaimer": "仅供参考"}
