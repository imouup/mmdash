import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import get_db
from app.models import User, NotionBinding
from app.schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse, NotionAuthUrl, NotionCallback

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
settings = get_settings()


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


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


@router.get("/notion/url", response_model=NotionAuthUrl)
def get_notion_auth_url(current_user: User = Depends(get_current_user)):
    state = secrets.token_urlsafe(32)
    auth_url = (
        f"https://api.notion.com/v1/oauth/authorize?"
        f"client_id={settings.NOTION_CLIENT_ID}&"
        f"redirect_uri={settings.NOTION_REDIRECT_URI}&"
        f"response_type=code&"
        f"state={state}"
    )
    return {"auth_url": auth_url}


from app.services.notion import exchange_code_for_token

@router.post("/notion/callback")
async def notion_callback(data: NotionCallback, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        token_data = await exchange_code_for_token(data.code)
        access_token = token_data.get("access_token")
        workspace_id = token_data.get("workspace_id")
        workspace_name = token_data.get("workspace_name")
        # Remove old binding if exists
        old = db.query(NotionBinding).filter(NotionBinding.user_id == current_user.id).first()
        if old:
            db.delete(old)
        binding = NotionBinding(
            user_id=current_user.id,
            access_token=access_token,
            workspace_id=workspace_id,
            workspace_name=workspace_name,
        )
        db.add(binding)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Notion auth failed: {str(e)}")
