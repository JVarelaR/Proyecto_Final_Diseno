"""Almacenamiento local de fotos en el volumen compartido `uploads_data`.

Create y update comparten esta función para no duplicar el nombrado de archivos.
El volumen se monta tanto en los microservicios como en el gateway (solo lectura),
que es quien sirve las imágenes por `/uploads/<archivo>`.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
URL_PREFIX = "/uploads"


def guardar_foto(foto: UploadFile, numero_documento: str) -> str:
    """Guarda la foto y devuelve la URL pública que servirá el gateway.

    `UploadFile` es el tipo de FastAPI para archivos subidos en un formulario
    multipart (equivalente a un objeto archivo con nombre y contenido).
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    sufijo = Path(foto.filename or "").suffix.lower() or ".jpg"
    # El UUID evita que dos fotos de la misma persona se sobrescriban y que un
    # nombre manipulado por el usuario controle la ruta final (SECURITY).
    nombre = f"{numero_documento}_{uuid.uuid4().hex}{sufijo}"
    destino = UPLOAD_DIR / nombre
    # `write_bytes` es E/S síncrona: el tamaño está limitado a 2 MB por Zod y
    # Pydantic, así que no bloquea el bucle de eventos de forma apreciable.
    destino.write_bytes(foto.file.read())
    return f"{URL_PREFIX}/{nombre}"
