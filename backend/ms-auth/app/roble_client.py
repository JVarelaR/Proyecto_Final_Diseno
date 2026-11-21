"""Cliente de sesiones ROBLE.

`AUTH_MODE=mock` permite desarrollar y probar sin contrato ROBLE real.
`AUTH_MODE=roble` usa el SDK oficial con storage en PostgreSQL.
"""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from roble import RobleAuthError, RobleClient, RobleError, User

from shared.roble_storage import PostgresTokenStorage

# SECURITY: ni la llave de contrato ni el secreto JWT se escriben en el código.
# El secreto es obligatorio: sin él el módulo falla al importar (fail fast).
ROBLE_BASE_URL = os.getenv(
    "ROBLE_BASE_URL", "https://roble-api.openlab.uninorte.edu.co"
).rstrip("/")
ROBLE_CONTRACT_ID = os.getenv("ROBLE_CONTRACT_ID", "").strip()
AUTH_MODE = os.getenv("AUTH_MODE", "mock").strip().lower()
JWT_ALGORITHM = "HS256"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY debe estar definida en el entorno")

# Modo mock: permite probar todo el sistema sin contrato ROBLE real. Es la
# puerta de entrada para el trabajo en local y para las pruebas de integración.
MOCK_USER = {
    "user_id": "mock-user-001",
    "email": "usuario.mock@uninorte.edu.co",
    "name": "Usuario Mock",
}

# SECURITY: identidad ficticia para las llamadas internas (n8n → ms-logs).
# `verify_user_session` la reconoce por `sub == "service"`.
SERVICE_USER = {
    "user_id": "service",
    "email": "service@local",
    "name": "Servicio interno",
}


def _get_client(namespace: str) -> RobleClient:
    """Fábrica del SDK ROBLE: inyecta el storage PostgreSQL por usuario.

    El context manager (`with`) del SDK cierra la sesión remota al terminar.
    """
    if not ROBLE_CONTRACT_ID:
        raise ValueError("ROBLE_CONTRACT_ID no está configurado")
    return RobleClient(
        base_url=ROBLE_BASE_URL,
        contract_id=ROBLE_CONTRACT_ID,
        storage=PostgresTokenStorage(namespace),
        timeout=15.0,
    )


def _firmar(claims: dict) -> str:
    """Crea un JWT firmado con HS256 (SECURITY).

    El JWT es un "pase" autocontenido: lleva los claims (sub, email, name) y una
    firma que solo se puede generar con JWT_SECRET_KEY. Si alguien lo modifica,
    la firma deja de coincidir y `verify_token` devuelve 401. `exp` caduca en
    7 días para limitar el daño de un token robado.
    """
    payload = dict(claims)
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_session_jwt(token: str) -> dict:
    """Verifica firma y expiración; lanza `PyJWTError` si el token es inválido."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


def crear_token_usuario(user: dict) -> str:
    return _firmar(
        {"sub": user["user_id"], "email": user["email"], "name": user["name"]}
    )


def crear_token_servicio() -> str:
    return _firmar(
        {"sub": SERVICE_USER["user_id"], "email": SERVICE_USER["email"],
         "name": SERVICE_USER["name"]}
    )


def signup_user(email: str, password: str, name: str) -> dict:
    if AUTH_MODE == "mock":
        return {"message": "Usuario de prueba registrado (modo mock)", "email": email}
    with RobleClient(base_url=ROBLE_BASE_URL, contract_id=ROBLE_CONTRACT_ID) as client:
        return client.register(email=email, password=password, name=name, auto_login=False)


def login_user(email: str, password: str) -> dict:
    """Devuelve el JWT que la SPA enviará como Bearer en cada petición.

    En modo ROBLE se hace login remoto con `persist_session=True`: el SDK guarda
    la sesión en `PostgresTokenStorage` para poder verificarla después sin
    enviar la contraseña en cada llamada.
    """
    if AUTH_MODE == "mock":
        user = dict(MOCK_USER, email=email)
        return {
            "access_token": crear_token_usuario(user),
            "token_type": "bearer",
            "user": user,
        }

    namespace = email.lower().strip()
    with _get_client(namespace) as client:
        user: User = client.login(email=email, password=password, persist_session=True)
        session_token = crear_token_usuario(
            {"user_id": user.user_id, "email": user.email, "name": user.name}
        )
        return {
            "access_token": session_token,
            "token_type": "bearer",
            "user": {
                "user_id": user.user_id,
                "email": user.email,
                "name": user.name,
                "extra": user.extra,
            },
        }


def verify_user_session(session_token: str) -> dict:
    """Comprueba JWT + sesión ROBLE viva (SECURITY).

    Primero valida la firma; luego, si no es el usuario de servicio, restaura
    la sesión desde Postgres. Así un JWT válido pero con logout ROBLE deja de
    funcionar: no basta con decodificar el token.
    """
    claims = decode_session_jwt(session_token)
    if claims.get("sub") == SERVICE_USER["user_id"]:
        return dict(SERVICE_USER)

    if AUTH_MODE == "mock":
        return {
            "user_id": claims["sub"],
            "email": claims["email"],
            "name": claims["name"],
        }

    user_id = claims["sub"]
    namespace = claims["email"].lower().strip()
    with _get_client(namespace) as client:
        if not client.restore_session(verify=True):
            raise RobleAuthError("La sesión en ROBLE ha caducado")
        user = client.current_user()
        return {
            "user_id": user.user_id or user_id,
            "email": user.email,
            "name": user.name,
            "extra": user.extra,
        }


def logout_user(session_token: str) -> None:
    """Cierra la sesión remota en ROBLE; en mock o servicio no hay nada que cerrar."""
    claims = decode_session_jwt(session_token)
    if AUTH_MODE == "mock" or claims.get("sub") == SERVICE_USER["user_id"]:
        return
    with _get_client(claims["email"].lower().strip()) as client:
        client.restore_session(verify=False)
        client.logout()
