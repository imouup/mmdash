import asyncio
import json
import os
from datetime import datetime
from typing import Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Cloud Agent - 数模Dashboard")

# In-memory project context store (would use vector DB in production)
project_contexts: Dict[str, dict] = {}


class ProjectContext(BaseModel):
    project_id: str
    problem_text: str = ""
    model_summary: str = ""
    todo_summary: str = ""


class ContextQuery(BaseModel):
    project_id: str
    query: str = ""


def build_context_vector(project_id: str, problem_text: str, model_summary: str, todo_summary: str) -> dict:
    """Build a global context vector for a project."""
    return {
        "project_id": project_id,
        "problem_text": problem_text[:5000],
        "model_summary": model_summary[:3000],
        "todo_summary": todo_summary[:2000],
        "updated_at": datetime.utcnow().isoformat(),
        "version": 1,
    }


@app.post("/context/update")
async def update_context(ctx: ProjectContext):
    """Update the global context for a project."""
    vector = build_context_vector(ctx.project_id, ctx.problem_text, ctx.model_summary, ctx.todo_summary)
    project_contexts[ctx.project_id] = vector
    return {"status": "updated", "project_id": ctx.project_id}


@app.get("/context/{project_id}")
async def get_context(project_id: str):
    """Get the global context for a project."""
    if project_id not in project_contexts:
        raise HTTPException(status_code=404, detail="Context not found for this project")
    return project_contexts[project_id]


@app.post("/context/distribute")
async def distribute_context(ctx: ContextQuery):
    """Distribute context to local agents for a project."""
    if ctx.project_id not in project_contexts:
        raise HTTPException(status_code=404, detail="Context not found")
    context = project_contexts[ctx.project_id]
    # In a real implementation, this would push to connected local agents
    return {
        "status": "distributed",
        "project_id": ctx.project_id,
        "context": context,
    }


@app.post("/context/build")
async def build_context_from_sources(project_id: str, notion_access_token: str, base_data_page_id: str, model_data_page_id: str):
    """Build context by fetching data from Notion."""
    async with httpx.AsyncClient() as client:
        # Fetch base data (problem)
        problem_text = ""
        try:
            resp = await client.get(
                f"https://api.notion.com/v1/blocks/{base_data_page_id}/children",
                headers={"Authorization": f"Bearer {notion_access_token}", "Notion-Version": "2022-06-28"},
            )
            if resp.status_code == 200:
                blocks = resp.json().get("results", [])
                problem_text = "\n".join(
                    b.get("paragraph", {}).get("rich_text", [{}])[0].get("plain_text", "")
                    for b in blocks if b.get("type") == "paragraph"
                )
        except Exception:
            pass

        # Fetch model summary
        model_summary = ""
        try:
            resp = await client.get(
                f"https://api.notion.com/v1/blocks/{model_data_page_id}/children",
                headers={"Authorization": f"Bearer {notion_access_token}", "Notion-Version": "2022-06-28"},
            )
            if resp.status_code == 200:
                blocks = resp.json().get("results", [])
                model_summary = "\n".join(
                    b.get("paragraph", {}).get("rich_text", [{}])[0].get("plain_text", "")
                    for b in blocks if b.get("type") == "paragraph"
                )
        except Exception:
            pass

    vector = build_context_vector(project_id, problem_text, model_summary, "")
    project_contexts[project_id] = vector
    return {"status": "built", "project_id": project_id}


@app.get("/health")
def health():
    return {"status": "ok", "active_contexts": len(project_contexts)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
