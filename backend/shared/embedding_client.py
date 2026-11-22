"""Generación de embeddings con OpenRouter (compatible con OpenAI).

Se usa tanto al indexar personas (create/update) como en el workflow de n8n
para embeber la pregunta. Las dimensiones deben coincidir con `Vector(768)`.
"""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

import os

import httpx

# SECURITY: la API key nunca se escribe aquí; se lee del entorno (.env, ignorado
# por Git). Si no hay key, el sistema sigue funcionando sin IA (CRUD + logs).
OPENROUTER_BASE_URL = os.getenv(
    "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
).rstrip("/")
# Modelo validado con la key del equipo (2026-11-21): devuelve 768 dimensiones
# con `dimensions=768`. Los modelos :free del catálogo dan 2048 o están
# sobrecargados, por lo que no sirven para el VECTOR(768) actual.
EMBED_MODEL = os.getenv("OPENROUTER_EMBED_MODEL", "openai/text-embedding-3-small")
EMBED_DIMENSIONS = int(os.getenv("OPENROUTER_EMBED_DIMENSIONS", "768"))
TIMEOUT_SECONDS = float(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "20"))


async def generar_embedding(texto: str) -> list[float] | None:
    """Devuelve el vector, o None si no hay API key (modo sin IA).

    Un embedding es una lista de números que representa el significado del
    texto: dos frases parecidas tienen vectores cercanos. Eso permite al RAG
    buscar por significado en vez de por coincidencia exacta de palabras.
    """
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        return None

    # `dimensions` fuerza 768 para que el vector quepa en `Vector(768)` de la BD.
    payload = {
        "model": EMBED_MODEL,
        "input": texto,
        "dimensions": EMBED_DIMENSIONS,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{OPENROUTER_BASE_URL}/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    # `raise_for_status()` lanza excepción si OpenRouter responde 4xx/5xx:
    # así el llamador decide si bloquea o solo avisa (en create/update es mejor
    # esfuerzo; en el RAG de n8n es obligatorio para poder responder).
    response.raise_for_status()
    vector = response.json()["data"][0]["embedding"]
    if len(vector) != EMBED_DIMENSIONS:
        raise ValueError(
            f"OpenRouter devolvió {len(vector)} dimensiones; se esperaban "
            f"{EMBED_DIMENSIONS}. Revisa OPENROUTER_EMBED_DIMENSIONS y la migración."
        )
    return vector


def texto_para_embedding(persona: dict) -> str:
    """Texto indexado: incluye fecha y edad para preguntas agregadas (riesgo #1).

    La pregunta oficial del proyecto es "¿Cuál es el empleado más joven...?".
    Si el texto solo tuviera el nombre, el LLM no podría responder: por eso se
    incluye la fecha de nacimiento (el LLM calcula la edad a partir de ella).
    Cambiar este formato obliga a reindexar a todas las personas.
    """
    nombre = " ".join(
        filtro for filtro in (
            persona.get("primer_nombre"),
            persona.get("segundo_nombre"),
            persona.get("apellidos"),
        ) if filtro
    )
    fecha = persona.get("fecha_nacimiento")
    fecha_txt = fecha.isoformat() if hasattr(fecha, "isoformat") else str(fecha or "")
    return (
        f"Persona {nombre}. Documento {persona.get('numero_documento')} "
        f"({persona.get('tipo_documento')}). Fecha de nacimiento {fecha_txt}. "
        f"Género {persona.get('genero')}. Correo {persona.get('correo')}."
    )
