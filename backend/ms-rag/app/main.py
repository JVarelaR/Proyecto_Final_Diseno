"""Microservicio RAG autenticado."""

from __future__ import annotations

import os
import uuid

import httpx

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from shared.security import get_current_user


app = FastAPI(title="MS RAG - Consulta en Lenguaje Natural")

router = APIRouter(
    prefix="/api/v1/rag",
    tags=["Consulta RAG"],
)


class ChatRequest(BaseModel):
    pregunta: str = Field(min_length=1, max_length=1000)
    session_id: str | None = Field(default=None, max_length=128)


@router.get("/health")
async def health():
    return {"status": "ok", "service": "ms-rag"}


@router.post("/chat")
async def consultar_rag(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    usuario_id = current_user.get("user_id")

    if not usuario_id:
        raise HTTPException(
            status_code=403,
            detail="Usuario autenticado sin identificador válido",
        )

    webhook_url = os.getenv("N8N_WEBHOOK_URL")
    webhook_secret = os.getenv("N8N_RAG_SECRET")

    if not webhook_url or not webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="Integración RAG no configurada",
        )

    session_id = body.session_id or str(uuid.uuid4())

    payload = {
        "pregunta": body.pregunta,
        "session_id": session_id,
        "usuario_id": str(usuario_id),
    }

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
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

    return {
        "respuesta": respuesta,
        "session_id": session_id,
    }


app.include_router(router)