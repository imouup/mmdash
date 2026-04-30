import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import get_db
from app.models import User, NotionBinding, ProviderBinding
from app.schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse, ProviderAuthUrl, ProviderCallback
from app.services.document_provider import get_provider

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=TokenResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        display_name=user_data.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


def _get_user_provider_binding(db: Session, user_id: str) -> Optional[ProviderBinding]:
    """Get the active provider binding for a user."""
    return db.query(ProviderBinding).filter(ProviderBinding.user_id == user_id).first()


@router.get("/provider/url", response_model=ProviderAuthUrl)
def get_provider_auth_url(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    binding = _get_user_provider_binding(db, current_user.id)
    provider_type = binding.provider_type if binding else settings.DOCUMENT_PROVIDER
    provider = get_provider(provider_type)
    auth_url = provider.get_auth_url()
    if not auth_url:
        raise HTTPException(status_code=400, detail="This provider does not require OAuth")
    return {"auth_url": auth_url}


@router.post("/provider/callback")
async def provider_callback(data: ProviderCallback, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    binding = _get_user_provider_binding(db, current_user.id)
    provider_type = binding.provider_type if binding else settings.DOCUMENT_PROVIDER
    provider = get_provider(provider_type)
    try:
        creds = await provider.exchange_auth_code(data.code)
        # Remove old binding if exists
        old = db.query(ProviderBinding).filter(ProviderBinding.user_id == current_user.id).first()
        if old:
            db.delete(old)
        new_binding = ProviderBinding(
            user_id=current_user.id,
            provider_type=provider_type,
            credentials=__import__("json").dumps(creds),
            workspace_id=creds.get("workspace_id"),
            workspace_name=creds.get("workspace_name"),
        )
        db.add(new_binding)
        db.commit()
        return {"status": "success", "provider_type": provider_type}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Provider auth failed: {str(e)}")


# ─── Backward-compatible Notion endpoints ─────────────────────────────────────

@router.get("/notion/url", response_model=ProviderAuthUrl)
def get_notion_auth_url_compat(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_provider_auth_url(current_user, db)


@router.post("/notion/callback")
async def notion_callback_compat(data: ProviderCallback, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await provider_callback(data, current_user, db)
