import json
import redis
from app.core.config import get_settings

settings = get_settings()
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


def get_cached_notion_page(page_id: str) -> dict | None:
    key = f"notion:page:{page_id}"
    data = redis_client.get(key)
    if data:
        return json.loads(data)
    return None


def set_cached_notion_page(page_id: str, content: dict, expire_seconds: int = 300):
    key = f"notion:page:{page_id}"
    redis_client.setex(key, expire_seconds, json.dumps(content))


def invalidate_notion_page(page_id: str):
    key = f"notion:page:{page_id}"
    redis_client.delete(key)
