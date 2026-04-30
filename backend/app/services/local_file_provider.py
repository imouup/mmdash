import httpx

from app.core.config import get_settings
from app.services.document_provider import DocumentProvider, register_provider

settings = get_settings()


class LocalFileProvider(DocumentProvider):
    """Local filesystem document provider via doc_server HTTP API."""

    def get_provider_type(self) -> str:
        return "local_file"

    async def fetch_page_content(self, page_id: str, credentials: dict) -> dict:
        api_key = credentials["api_key"]
        url = f"{settings.DOC_SERVER_URL}/api/pages/{page_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                headers={"X-API-Key": api_key},
            )
            resp.raise_for_status()
            data = resp.json()
        return {
            "page_id": data["page_id"],
            "blocks": data.get("blocks", []),
            "title": data.get("title", ""),
        }

    async def fetch_page_metadata(self, page_id: str, credentials: dict) -> dict:
        content = await self.fetch_page_content(page_id, credentials)
        return {
            "page_id": content["page_id"],
            "title": content.get("title", ""),
        }


register_provider("local_file", LocalFileProvider)
