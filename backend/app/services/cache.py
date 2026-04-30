import json
import redis
from app.core.config import get_settings

settings = get_settings()

# Lazy initialization to allow import without Redis being available
_redis_client = None

def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def _cache_key(provider_type: str, page_id: str) -> str:
    return f"{provider_type}:page:{page_id}"


def get_cached_page(provider_type: str, page_id: str) -> dict | None:
    try:
        key = _cache_key(provider_type, page_id)
        data = _get_redis().get(key)
        if data:
            return json.loads(data)
    except redis.ConnectionError:
        pass
    return None


def set_cached_page(provider_type: str, page_id: str, content: dict, expire_seconds: int = 300):
    try:
        key = _cache_key(provider_type, page_id)
        _get_redis().setex(key, expire_seconds, json.dumps(content))
    except redis.ConnectionError:
        pass


def invalidate_page(provider_type: str, page_id: str):
    try:
        key = _cache_key(provider_type, page_id)
        _get_redis().delete(key)
    except redis.ConnectionError:
        pass


# ─── Backward-compatible aliases for Notion ──────────────────────────────────

def get_cached_notion_page(page_id: str) -> dict | None:
    """Deprecated: use get_cached_page(provider_type, page_id)."""
    return get_cached_page("notion", page_id)


def set_cached_notion_page(page_id: str, content: dict, expire_seconds: int = 300):
    """Deprecated: use set_cached_page(provider_type, page_id, content)."""
    set_cached_page("notion", page_id, content, expire_seconds)


def invalidate_notion_page(page_id: str):
    """Deprecated: use invalidate_page(provider_type, page_id)."""
    invalidate_page("notion", page_id)
