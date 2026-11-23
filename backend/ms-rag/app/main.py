
"""Microservicio RAG: entrada autenticada para consultas en lenguaje natural."""

from __future__ import annotations

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from shared.security import get_current_user


app = FastAPI(title="MS RAG - Consulta en Lenguaje Natural")

router = APIRouter(
    prefix="/api/v1/rag",
    tags=["Consulta RAG"]
)


class ChatRequest(BaseModel):
    pregunta: str = Field(
        min_length=1,
        max_length=1000
    )

    session_id: str | None = Field(
        default=None,
        max_length=128
    )


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ms-rag"
    }


@router.post("/chat")
async def consultar_rag(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Valida la sesión antes de procesar una consulta."""

    usuario_id = current_user.get("user_id")

    if not usuario_id:
        raise HTTPException(
            status_code=403,
            detail="No se pudo identificar al usuario autenticado"
        )

    # Todavía no procesamos datos personales.
    # Primero verificaremos la autenticación y los permisos.
    raise HTTPException(
        status_code=503,
        detail="Servicio RAG autenticado; integración con n8n pendiente"
    )


app.include_router(router)
