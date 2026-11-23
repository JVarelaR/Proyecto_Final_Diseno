"""Generación de embeddings con Ollama local (endpoint compatible con OpenAI).

Se usa tanto al indexar personas (create/update) como en el workflow de n8n
para embeber la pregunta. Las dimensiones deben coincidir con `Vector(768)`.
Ollama corre dentro de la red de Docker: no hay API key ni servicio externo.
"""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

import os

import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
# `nomic-embed-text` produce 768 dimensiones nativas. El prefijo `search_document:`
# es el recomendado por el modelo para el texto indexado; la pregunta en n8n usa
# `search_query:` (contexto.md §6). Cambiar el modelo obliga a reindexar.
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
EMBED_DIMENSIONS = int(os.getenv("OLLAMA_EMBED_DIMENSIONS", "768"))
# La primera petición puede tener que cargar el modelo en memoria: 120 s evita
# timeouts falsos en el arranque o después de un periodo de inactividad.
TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))


async def generar_embedding(texto: str) -> list[float]:
    """Devuelve el vector de 768 números; lanza excepción si Ollama falla.

    Un embedding es una lista de números que representa el significado del
    texto: dos frases parecidas tienen vectores cercanos. Eso permite al RAG
    buscar por significado en vez de por coincidencia exacta de palabras.
    Los llamadores (create/update) tratan el error como mejor esfuerzo: la
    persona queda guardada y solo se pierde la búsqueda semántica.
    """
    # `dimensions` fuerza 768 para que el vector quepa en `Vector(768)` de la BD.
    payload = {
        "model": EMBED_MODEL,
        "input": texto,
        "dimensions": EMBED_DIMENSIONS,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/v1/embeddings",
            headers={"Content-Type": "application/json"},
            json=payload,
        )
    # `raise_for_status()` lanza excepción si Ollama responde 4xx/5xx.
    response.raise_for_status()
    # Ollama expone la misma forma que OpenAI: `data[0].embedding`.
    vector = response.json()["data"][0]["embedding"]
    if len(vector) != EMBED_DIMENSIONS:
        raise ValueError(
            f"Ollama devolvió {len(vector)} dimensiones; se esperaban "
            f"{EMBED_DIMENSIONS}. Revisa OLLAMA_EMBED_DIMENSIONS y la migración."
        )
    return vector


def texto_para_embedding(persona: dict) -> str:
    """Texto indexado: incluye fecha y edad para preguntas agregadas (riesgo #1).

    La pregunta oficial del proyecto es "¿Cuál es el empleado más joven...?".
    Si el texto solo tuviera el nombre, el LLM no podría responder: por eso se
    incluye la fecha de nacimiento (el LLM calcula la edad a partir de ella).
    El prefijo `search_document:` mejora la recuperación con nomic-embed-text;
    n8n usa `search_query:` al embeber la pregunta. Cambiar este formato obliga
    a reindexar a todas las personas.
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
        f"search_document: Persona {nombre}. Documento {persona.get('numero_documento')} "
        f"({persona.get('tipo_documento')}). Fecha de nacimiento {fecha_txt}. "
        f"Género {persona.get('genero')}. Correo {persona.get('correo')}."
    )
