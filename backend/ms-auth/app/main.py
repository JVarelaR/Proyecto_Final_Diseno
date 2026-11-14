import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr
from roble import RobleAuthError, RobleError, RobleHttpError

from app.roble_client import (
    login_user,
    logout_user,
    signup_user,
    verify_user_session,
)

app = FastAPI(title="Microservicio de Autenticación - Librería ROBLE")
router = APIRouter(prefix="/auth", tags=["Autenticación ROBLE"])

# Esquema oficial de seguridad Bearer para FastAPI y Swagger UI
security = HTTPBearer()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest):
    try:
        return signup_user(email=body.email, password=body.password, name=body.name)
    except RobleHttpError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except RobleError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/login")
def login(body: LoginRequest):
    try:
        return login_user(email=body.email, password=body.password)
    except RobleHttpError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except RobleError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/verify-token")
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_data = verify_user_session(token)
        return {"valid": True, "data": user_data}
    except (jwt.PyJWTError, RobleAuthError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    except RobleHttpError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except RobleError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        logout_user(token)
        return {"message": "Sesión cerrada correctamente"}
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    except RobleError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


app.include_router(router)