from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.database import engine, Base
from app.api import auth, teams, projects, home, timeline

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(teams.router, prefix="/api/teams", tags=["团队"])
app.include_router(projects.router, prefix="/api/projects", tags=["项目"])
app.include_router(home.router, prefix="/api/home", tags=["主页"])
app.include_router(timeline.router, prefix="/api/timeline", tags=["时间线"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
