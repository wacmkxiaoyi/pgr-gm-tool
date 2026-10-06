"""Request-local resource selection and language-partitioned table caches."""

from contextvars import ContextVar
from functools import lru_cache, wraps
from pathlib import Path


resource_language: ContextVar[str] = ContextVar("resource_language", default="EN")
BACKEND_DIR = Path(__file__).resolve().parents[2]


def normalize_resource_language(locale: str) -> str:
    primary = locale.split(",", 1)[0].split(";", 1)[0].strip().lower()
    return "CN" if primary == "cn" or primary.startswith("zh") else "EN"


def resolve_resource_path(path: Path) -> Path:
    absolute = path if path.is_absolute() else BACKEND_DIR / path
    try:
        relative = absolute.relative_to(BACKEND_DIR / "assets")
    except ValueError:
        return absolute
    if relative.parts[0] in {"EN", "CN"}:
        return absolute
    return BACKEND_DIR / "assets" / resource_language.get() / relative


def language_cache(maxsize=1):
    """Keep independent LRU stores so one language cannot evict the other."""
    def decorate(function):
        caches = {language: lru_cache(maxsize=maxsize)(function) for language in ("EN", "CN")}

        @wraps(function)
        def wrapped(*args, **kwargs):
            return caches[resource_language.get()](*args, **kwargs)

        def cache_clear():
            for cache in caches.values():
                cache.cache_clear()

        wrapped.cache_clear = cache_clear
        wrapped.cache_info = lambda: caches[resource_language.get()].cache_info()
        return wrapped
    return decorate


class ResourceLanguageMiddleware:
    """ASGI scope isolation also propagates to sync endpoint worker threads."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers", []))
        language = normalize_resource_language(headers.get(b"accept-language", b"").decode("latin-1"))
        token = resource_language.set(language)
        try:
            await self.app(scope, receive, send)
        finally:
            resource_language.reset(token)
