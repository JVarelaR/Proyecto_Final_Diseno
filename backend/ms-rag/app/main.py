
"""Microservicio RAG autenticado con memoria conversacional."""

from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.memoria import (
    obtener_o_crear_sesion,
    actualizar_persona_sesion,
)
from shared.database import get_db
from shared.security import get_current_user


app = FastAPI(
    title="MS RAG - Consulta en Lenguaje Natural"
)

router = APIRouter(
    prefix="/api/v1/rag",
    tags=["Consulta RAG"],
)


# =====================================================
# 1. MODELOS DE DATOS
# =====================================================

class ChatRequest(BaseModel):
    pregunta: str = Field(
        min_length=1,
        max_length=1000
    )

    session_id: str | None = Field(
        default=None,
        max_length=128
    )


# =====================================================
# 2. COMPROBACIÓN DE SALUD
# =====================================================

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ms-rag"
    }


# =====================================================
# 3. VALIDACIÓN DE PERSONAS
# =====================================================

async def documento_existe(
    db: AsyncSession,
    documento: str,
) -> bool:
    """Comprueba que el documento exista en PostgreSQL."""

    resultado = await db.execute(
        text("""
            SELECT EXISTS (
                SELECT 1
                FROM personas
                WHERE numero_documento = :documento
            )
        """),
        {
            "documento": documento
        }
    )

    return bool(resultado.scalar())


# =====================================================
# 4. CHAT RAG AUTENTICADO
# =====================================================

@router.post("/chat")
async def consultar_rag(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Procesa preguntas y conserva la referencia conversacional."""

    # -------------------------------------------------
    # A. VALIDAR USUARIO
    # -------------------------------------------------

    usuario_id = current_user.get("user_id")

    if not usuario_id:
        raise HTTPException(
            status_code=403,
            detail="Usuario autenticado sin identificador válido",
        )

    usuario_id = str(usuario_id)

    # -------------------------------------------------
    # B. VALIDAR CONFIGURACIÓN DE N8N
    # -------------------------------------------------

    webhook_url = os.getenv("N8N_WEBHOOK_URL")
    webhook_secret = os.getenv("N8N_RAG_SECRET")

    if not webhook_url or not webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="Integración RAG no configurada",
        )

    # -------------------------------------------------
    # C. RECUPERAR O CREAR SESIÓN
    # -------------------------------------------------

    sesion = await obtener_o_crear_sesion(
        db=db,
        usuario_id=usuario_id,
        session_id=body.session_id,
    )

    session_id = sesion["session_id"]

    persona_recordada = sesion["persona_documento"]

    # -------------------------------------------------
    # D. PREPARAR SOLICITUD A N8N
    # -------------------------------------------------

    payload = {
        "pregunta": body.pregunta.strip(),
        "session_id": session_id,
        "usuario_id": usuario_id,
        "persona_documento": persona_recordada,
    }

    # -------------------------------------------------
    # E. EJECUTAR WORKFLOW RAG
    # -------------------------------------------------

    try:
        async with httpx.AsyncClient(
            timeout=180.0
        ) as client:

            response = await client.post(
                webhook_url,
                json=payload,
                headers={
                    "X-Internal-RAG-Key": webhook_secret,
                },
            )

            response.raise_for_status()
            resultado = response.json()

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="La consulta RAG excedió el tiempo de espera",
        )

    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="No fue posible obtener la respuesta de n8n",
        )

    # -------------------------------------------------
    # F. VALIDAR RESPUESTA DE N8N
    # -------------------------------------------------

    if not isinstance(resultado, dict):
        raise HTTPException(
            status_code=502,
            detail="Respuesta RAG inválida",
        )

    respuesta = resultado.get("respuesta")

    if not isinstance(respuesta, str):
        raise HTTPException(
            status_code=502,
            detail="n8n no devolvió una respuesta válida",
        )

    # -------------------------------------------------
    # G. EXTRAER LA PERSONA IDENTIFICADA
    # -------------------------------------------------

    persona_identificada = resultado.get(
        "persona_documento"
    )

    # Solo guardar documentos explícitamente identificados.
    if persona_identificada is not None:

        if not isinstance(persona_identificada, str):
            raise HTTPException(
                status_code=502,
                detail="Documento devuelto por n8n inválido",
            )

        persona_identificada = persona_identificada.strip()

        if persona_identificada:
            # Verificar que el registro realmente exista.
            existe = await documento_existe(
                db=db,
                documento=persona_identificada,
            )

            if existe:
                # Conserva la referencia para futuras preguntas.
                await actualizar_persona_sesion(
                    db=db,
                    usuario_id=usuario_id,
                    session_id=session_id,
                    persona_documento=persona_identificada,
                )

    # -------------------------------------------------
    # H. DEVOLVER RESPUESTA A REACT
    # -------------------------------------------------

    return {
        "respuesta": respuesta,
        "session_id": session_id,
    }


app.include_router(router)
