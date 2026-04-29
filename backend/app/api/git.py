import json
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


def _parse_experiment_dir_name(dir_name: str) -> dict:
    """Parse experiment directory name like '20240115_143022_solver_v2'."""
    parts = dir_name.split("_", 2)
    if len(parts) >= 3:
        timestamp = f"{parts[0]}_{parts[1]}"
        solver_name = parts[2]
    elif len(parts) == 2:
        timestamp = parts[0]
        solver_name = parts[1]
    else:
        timestamp = dir_name
        solver_name = "unknown"
    return {"timestamp": timestamp, "solver_name": solver_name}


def _check_experiment_structure(result_dir: str) -> dict:
    """Check if experiment directory has required structure."""
    has_fig = os.path.isdir(os.path.join(result_dir, "fig"))
    has_log = os.path.isfile(os.path.join(result_dir, "log.txt"))
    has_analysis = os.path.isfile(os.path.join(result_dir, "analysis.md"))
    has_params = os.path.isfile(os.path.join(result_dir, "params_snapshot.json"))
    is_complete = has_fig and has_log and has_analysis and has_params
    missing = []
    if not has_fig:
        missing.append("fig/")
    if not has_log:
        missing.append("log.txt")
    if not has_analysis:
        missing.append("analysis.md")
    if not has_params:
        missing.append("params_snapshot.json")
    return {
        "is_complete": is_complete,
        "missing": missing,
        "has_fig": has_fig,
        "has_log": has_log,
        "has_analysis": has_analysis,
        "has_params": has_params,
    }


@router.get("/{project_id}/experiments")
def list_experiments(project_id: str, repo_path: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    if not os.path.isdir(repo_path):
        raise HTTPException(status_code=400, detail="Invalid repository path")

    results_dir = os.path.join(repo_path, "results")
    if not os.path.isdir(results_dir):
        return {"repo_path": repo_path, "experiments": []}

    experiments = []
    for entry in os.listdir(results_dir):
        entry_path = os.path.join(results_dir, entry)
        if not os.path.isdir(entry_path):
            continue
        parsed = _parse_experiment_dir_name(entry)
        structure = _check_experiment_structure(entry_path)
        params_data = {}
        if structure["has_params"]:
            try:
                with open(os.path.join(entry_path, "params_snapshot.json"), "r", encoding="utf-8") as f:
                    params_data = json.load(f)
            except Exception:
                pass
        experiments.append({
            "dir_name": entry,
            "dir_path": entry_path,
            "timestamp": parsed["timestamp"],
            "solver_name": parsed["solver_name"],
            "structure": structure,
            "params_snapshot": params_data,
        })

    # Sort by timestamp descending
    experiments.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"repo_path": repo_path, "experiments": experiments}


@router.get("/{project_id}/experiment")
def get_experiment_detail(project_id: str, experiment_dir: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    member = db.query(TeamMember).filter(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a team member")

    if not os.path.isdir(experiment_dir):
        raise HTTPException(status_code=404, detail="Experiment directory not found")

    structure = _check_experiment_structure(experiment_dir)
    parsed = _parse_experiment_dir_name(os.path.basename(experiment_dir))

    log_content = ""
    if structure["has_log"]:
        try:
            with open(os.path.join(experiment_dir, "log.txt"), "r", encoding="utf-8") as f:
                log_content = f.read()
        except Exception:
            pass

    analysis_content = ""
    if structure["has_analysis"]:
        try:
            with open(os.path.join(experiment_dir, "analysis.md"), "r", encoding="utf-8") as f:
                analysis_content = f.read()
        except Exception:
            pass

    params_data = {}
    if structure["has_params"]:
        try:
            with open(os.path.join(experiment_dir, "params_snapshot.json"), "r", encoding="utf-8") as f:
                params_data = json.load(f)
        except Exception:
            pass

    fig_files = []
    fig_dir = os.path.join(experiment_dir, "fig")
    if os.path.isdir(fig_dir):
        fig_files = [f for f in os.listdir(fig_dir) if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".svg"))]

    return {
        "dir_name": os.path.basename(experiment_dir),
        "dir_path": experiment_dir,
        "timestamp": parsed["timestamp"],
        "solver_name": parsed["solver_name"],
        "structure": structure,
        "log": log_content,
        "analysis": analysis_content,
        "params_snapshot": params_data,
        "fig_files": fig_files,
    }
