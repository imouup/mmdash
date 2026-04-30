from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from doc_server.core.config import get_settings
from doc_server.api import pages

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pages.router, prefix="/api", tags=["pages"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
