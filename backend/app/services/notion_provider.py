import secrets
from typing import Optional

from app.core.config import get_settings
from app.services.document_provider import DocumentProvider, register_provider
from app.services.notion_fetch import (
    fetch_notion_page_content,
    fetch_notion_page_metadata,
    notion_blocks_to_markdown,
)
from app.services.notion import exchange_code_for_token

settings = get_settings()


class NotionProvider(DocumentProvider):
    """Notion API document provider."""

    def get_provider_type(self) -> str:
        return "notion"

    async def fetch_page_content(self, page_id: str, credentials: dict) -> dict:
        access_token = credentials["access_token"]
        return await fetch_notion_page_content(page_id, access_token)

    async def fetch_page_metadata(self, page_id: str, credentials: dict) -> dict:
        access_token = credentials["access_token"]
        return await fetch_notion_page_metadata(page_id, access_token)

    def get_auth_url(self) -> Optional[str]:
        state = secrets.token_urlsafe(32)
        return (
            f"https://api.notion.com/v1/oauth/authorize?"
            f"client_id={settings.NOTION_CLIENT_ID}&"
            f"redirect_uri={settings.NOTION_REDIRECT_URI}&"
            f"response_type=code&"
            f"state={state}"
        )

    async def exchange_auth_code(self, code: str) -> dict:
        token_data = await exchange_code_for_token(code)
        return {
            "access_token": token_data.get("access_token"),
            "workspace_id": token_data.get("workspace_id"),
            "workspace_name": token_data.get("workspace_name"),
        }


register_provider("notion", NotionProvider)
