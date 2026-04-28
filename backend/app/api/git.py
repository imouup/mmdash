import os
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, TeamMember
from app.api.auth import get_current_user
from app.models import User

router = APIRouter()


def _extract_params_from_python(file_path: str) -> list:
    """Extract tunable parameters from a Python solver file."""
    params = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Look for variable assignments that look like parameters
        for match in re.finditer(r"^(\w+)\s*=\s*([^#\n]+)", content, re.MULTILINE):
            name = match.group(1)
            value = match.group(2).strip()
            # Filter out common non-parameter names
            if name.startswith("_") or name in ["import", "from", "def", "class", "if", "for", "while", "return", "print"]:
                continue
            # Try to detect numeric values
            try:
                float(value)
                params.append({"name": name, "default": value, "type": "number"})
            except ValueError:
                if value in ["True", "False"]:
                    params.append({"name": name, "default": value, "type": "boolean"})
                elif value.startswith("[") and value.endswith("]"):
                    params.append({"name": name, "default": value, "type": "list"})
    except Exception:
        pass
    return params


@router.get("/{project_id}/scan")
def scan_solvers(project_id: str, repo_path: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    if not os.path.isdir(repo_path):
        raise HTTPException(status_code=400, detail="Invalid repository path")

    git_dir = os.path.join(repo_path, ".git")
    if not os.path.isdir(git_dir):
        raise HTTPException(status_code=400, detail="Not a git repository")

    solvers = []
    for root, dirs, files in os.walk(repo_path):
        # Skip hidden dirs and common non-source dirs
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ["node_modules", "__pycache__", "venv", ".venv"]]
        for f in files:
            if f.endswith((".py", ".m", ".cpp", ".c", ".java")):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, repo_path)
                solvers.append({"name": f, "path": full_path, "rel_path": rel_path})

    return {"repo_path": repo_path, "solvers": solvers}


@router.get("/{project_id}/params")
def extract_params(project_id: str, solver_path: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    if not os.path.exists(solver_path):
        raise HTTPException(status_code=404, detail="Solver file not found")

    params = _extract_params_from_python(solver_path)
    return {"solver_path": solver_path, "params": params}


@router.get("/{project_id}/log")
def git_log(project_id: str, repo_path: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    import subprocess
    try:
        result = subprocess.run(
            ["git", "-C", repo_path, "log", "--oneline", "-20"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=400, detail=result.stderr)
        lines = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
        return {"repo_path": repo_path, "commits": lines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
