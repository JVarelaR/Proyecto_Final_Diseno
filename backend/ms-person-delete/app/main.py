"""Microservicio: Borrar Personas (opción 5 del menú)."""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.log_client import registrar_transaccion
from shared.models import Persona
from shared.security import get_access_token, get_current_user

app = FastAPI(title="MS Person Delete")
# Prefijo exacto del `location /api/v1/delete` de gateway/nginx.conf.
router = APIRouter(prefix="/api/v1/delete", tags=["Borrar Personas"])


@router.get("/health", tags=["Salud"])
async def health() -> dict:
    return {"status": "ok", "service": "ms-person-delete"}


# 204 = "borrado correctamente, sin cuerpo de respuesta". Es el código HTTP
# estándar para DELETE; por eso la función devuelve `None`.
@router.delete("/{numero_documento}", status_code=status.HTTP_204_NO_CONTENT)
async def borrar_persona(
    numero_documento: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    token: str = Depends(get_access_token),
) -> None:
    persona = await db.get(Persona, numero_documento)
    if not persona:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona no encontrada")

    # SECURITY: se registra ANTES de borrar. Así queda constancia del documento
    # eliminado aunque la fila desaparezca. Si el log falla, no se borra nada.
    try:
        await registrar_transaccion(token, "DELETE", numero_documento, {"eliminado": True})
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    # El borrado en cascada de `persona_embeddings` lo hace Postgres gracias a
    # la FOREIGN KEY ... ON DELETE CASCADE de la migración (no hay que hacerlo aquí).
    await db.delete(persona)
    await db.commit()


# Registra las rutas del router en la aplicación FastAPI.
app.include_router(router)
