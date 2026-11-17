import os
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://ms-auth:8000").rstrip("/")
REQUEST_TIMEOUT = 10.0

# Permite que Swagger UI (/docs) muestre el botón "Authorize" en cada microservicio
bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Dependencia de FastAPI que valida el Bearer token contra el microservicio ms-auth.
    Retorna los datos del usuario autenticado o lanza 401/503 si falla.
    """
    token = credentials.credentials

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(
                f"{AUTH_SERVICE_URL}/auth/verify-token",
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio de autenticación no está disponible",
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o sesión expirada en ROBLE",
        )

    payload = response.json()
    return payload.get("data", {})