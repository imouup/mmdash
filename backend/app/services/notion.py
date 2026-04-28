import httpx
from app.core.config import get_settings

settings = get_settings()


async def exchange_code_for_token(code: str) -> dict:
    """Exchange Notion OAuth code for access token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.notion.com/v1/oauth/token",
            auth=(settings.NOTION_CLIENT_ID, settings.NOTION_CLIENT_SECRET),
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.NOTION_REDIRECT_URI,
            },
            headers={
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def create_page(parent_page_id: str, title: str, access_token: str) -> str:
    """Create a new Notion page under parent_page_id. Returns the new page id."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.notion.com/v1/pages",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
            json={
                "parent": {"page_id": parent_page_id},
                "properties": {
                    "title": {
                        "title": [{"text": {"content": title}}]
                    }
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["id"]
