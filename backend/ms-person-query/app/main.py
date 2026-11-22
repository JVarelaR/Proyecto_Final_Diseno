"""Microservicio: Consultar Datos Personales (opción 3 del menú).

Contenedor independiente: si se detiene, las demás rutas siguen funcionando.
"""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.log_client import registrar_transaccion
from shared.models import Persona
from shared.schemas import PersonaOut
from shared.security import get_access_token, get_current_user

app = FastAPI(title="MS Person Query")
# Prefijo exacto del `location /api/v1/query` de gateway/nginx.conf. Nginx usa
# una variable en el proxy_pass para poder devolver 503 si este contenedor no
# está levantado (prueba R7) sin afectar a los otros microservicios.
router = APIRouter(prefix="/api/v1/query", tags=["Consultar Personas"])


@router.get("/health", tags=["Salud"])
async def health() -> dict:
    return {"status": "ok", "service": "ms-person-query"}


# `{numero_documento}` es un parámetro de la URL: FastAPI lo pasa a la función.
# SECURITY: `Depends(get_current_user)` exige Bearer válido antes de leer datos.
@router.get("/{numero_documento}", response_model=PersonaOut)
async def consultar_persona(
    numero_documento: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    token: str = Depends(get_access_token),
) -> PersonaOut:
    resultado = await db.execute(
        select(Persona).where(Persona.numero_documento == numero_documento)
    )
    # `scalar_one_or_none()` devuelve el objeto o None (nunca una lista) y
    # fallaría si hubiera más de una fila, lo cual no puede pasar: es la PK.
    persona = resultado.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona no encontrada")

    # SECURITY: toda lectura también se audita (rúbrica: log de TODA transacción).
    # `current_user` viene de la dependencia y se guarda como `consultado_por`.
    try:
        await registrar_transaccion(
            token,
            "READ",
            numero_documento,
            {"numero_documento": numero_documento, "consultado_por": current_user.get("email")},
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    return PersonaOut.model_validate(persona)


# Registra las rutas del router en la aplicación FastAPI.
app.include_router(router)
