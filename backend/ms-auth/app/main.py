"""Microservicio de autenticación (SSO ROBLE o modo mock)."""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

import os
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr

from app.roble_client import (
    crear_token_servicio,
    login_user,
    logout_user,
    signup_user,
    verify_user_session,
)
from roble import RobleAuthError, RobleError, RobleHttpError

# `FastAPI` crea la aplicación (el "controlador principal"); `APIRouter` agrupa
# rutas bajo un prefijo. Este prefijo debe coincidir con `gateway/nginx.conf`:
# si cambia aquí pero no allí, el gateway devuelve 404.
app = FastAPI(title="Microservicio de Autenticación - ROBLE / Mock")
router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])

security = HTTPBearer()
# SECURITY: clave compartida solo conocida por n8n y este servicio; no es el
# token del usuario, es la credencial que autoriza a pedir un JWT de servicio.
SERVICE_API_KEY = os.getenv("SERVICE_API_KEY", "").strip()


class LoginRequest(BaseModel):
    """Cuerpo esperado en /login; `EmailStr` valida el formato de correo."""

    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


# El decorador `@router.get` registra la función como manejador HTTP: en POO
# sería como registrar un método en una tabla de despacho. `/health` se dejó
# público para que Docker compruebe que el contenedor está vivo.
@router.get("/health", tags=["Salud"])
async def health() -> dict:
    return {"status": "ok", "service": "ms-auth"}


# `def` (no `async def`) porque la llamada al SDK ROBLE es síncrona y bloqueante:
# FastAPI la ejecuta en un hilo aparte para no congelar otras peticiones.
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


# SECURITY: este endpoint es el que llama `shared.security.get_current_user`
# en todos los microservicios. Es la única fuente de verdad de la sesión.
@router.get("/verify-token")
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        return {"valid": True, "data": verify_user_session(token)}
    except (jwt.PyJWTError, RobleAuthError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))
    except RobleHttpError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except RobleError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/service-token")
def service_token(
    x_service_key: Annotated[str | None, Header(alias="X-Service-Key")] = None,
):
    """Token para llamadas internas (n8n → ms-logs) sin exponer ROBLE.

    SECURITY: `Header(alias="X-Service-Key")` lee esa cabecera HTTP. Si falta o
    no coincide, 401. Así n8n puede registrar el RAG_QUERY sin credenciales de
    usuario, pero un extraño no puede pedir tokens de servicio.
    """
    if not SERVICE_API_KEY or x_service_key != SERVICE_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clave de servicio inválida")
    return {"access_token": crear_token_servicio(), "token_type": "bearer"}


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


# Sin esta línea las rutas del router no se registran en la aplicación.
app.include_router(router)
