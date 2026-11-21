"""Seguridad compartida: validación del Bearer token en un solo lugar (SECURITY).

Todos los endpoints protegidos ponen `Depends(get_current_user)`. Si estuviera
copiado en cada microservicio, un arreglo de seguridad habría que repetirlo
cinco veces y alguna ruta se quedaría sin proteger (rúbrica: 4 pts).
"""

import os
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# SECURITY: este microservicio es la autoridad; los demás no decodifican el JWT
# por su cuenta, le preguntan a él. Así un token revocado deja de servir al
# instante, aunque su firma siga siendo válida.
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://ms-auth:8000").rstrip("/")
# Timeout corto: si ms-auth cae, queremos responder 503 rápido, no colgar la petición.
REQUEST_TIMEOUT = 10.0

# Permite que Swagger UI (/docs) muestre el botón "Authorize" en cada microservicio.
# `HTTPBearer` extrae el token de la cabecera `Authorization: Bearer <token>`.
bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Dependencia de FastAPI que valida el Bearer token contra el microservicio ms-auth.
    Retorna los datos del usuario autenticado o lanza 401/503 si falla.

    `Depends` es inyección de dependencias: en POO pasarías el objeto por el
    constructor; aquí el framework lo construye y lo pasa al endpoint. Gracias
    a esto el endpoint recibe `current_user` ya verificado y no puede olvidarse
    de comprobarlo.
    """
    # SECURITY: el token se reenvía a ms-auth; nunca se escribe en logs ni se
    # usa como parte de una URL (solo va en la cabecera Authorization).
    token = credentials.credentials

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(
                f"{AUTH_SERVICE_URL}/api/v1/auth/verify-token",
                headers={"Authorization": f"Bearer {token}"},
            )
    # `RequestError` = no se pudo conectar (ms-auth apagado). No es lo mismo
    # que un token malo: por eso se devuelve 503 y no 401.
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de autenticación no está disponible",
        )

    # SECURITY: cualquier respuesta que no sea 200 se trata como no autenticado.
    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o sesión expirada en ROBLE",
        )

    # ms-auth responde `{"valid": true, "data": {...}}`; solo nos interesa `data`.
    payload = response.json()
    return payload.get("data", {})


async def get_access_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """Devuelve el Bearer crudo para reenviarlo entre microservicios (logs, etc.).

    SECURITY: existe porque `ms-logs` también exige autenticación. El mismo
    token del usuario se pasa a `log_client`, de modo que el evento queda
    asociado a la sesión correcta; JWT_SECRET_KEY sigue solo en ms-auth.
    """
    return credentials.credentials
