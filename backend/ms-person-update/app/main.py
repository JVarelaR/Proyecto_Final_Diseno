"""Microservicio: Modificar Datos Personales (opción 2 del menú)."""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.embedding_client import generar_embedding, texto_para_embedding
from shared.log_client import registrar_transaccion
from shared.models import Persona, PersonaEmbedding
from shared.schemas import Genero, PersonaOut, PersonaUpdate, TipoDocumento
from shared.security import get_access_token, get_current_user
from shared.uploads import guardar_foto

# Logger para avisar si falla la reindexación vectorial sin tirar el CRUD.
logger = logging.getLogger(__name__)
app = FastAPI(title="MS Person Update")
# Prefijo exacto del `location /api/v1/update` de gateway/nginx.conf.
router = APIRouter(prefix="/api/v1/update", tags=["Modificar Personas"])


@router.get("/health", tags=["Salud"])
async def health() -> dict:
    return {"status": "ok", "service": "ms-person-update"}


# Actualización completa (PUT): se envían todos los campos del formulario.
# `@router.put` es el verbo HTTP para "reemplazar el recurso identificado".
@router.put("/{documento}", response_model=PersonaOut)
async def actualizar_persona(
    documento: str,
    tipo_documento: TipoDocumento = Form(...),
    numero_documento: str = Form(...),
    primer_nombre: str = Form(...),
    segundo_nombre: str | None = Form(None),
    apellidos: str = Form(...),
    fecha_nacimiento: str = Form(...),
    genero: Genero = Form(...),
    correo: str = Form(...),
    celular: str = Form(...),
    foto: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    token: str = Depends(get_access_token),
) -> PersonaOut:
    # El número de documento es la llave: no se puede cambiar en una actualización.
    # Si la URL y el formulario difieren, se rechaza (422) antes de tocar la BD.
    if documento != numero_documento:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El documento de la ruta y del formulario deben coincidir",
        )

    datos = PersonaUpdate(
        tipo_documento=tipo_documento,
        numero_documento=numero_documento,
        primer_nombre=primer_nombre,
        segundo_nombre=segundo_nombre,
        apellidos=apellidos,
        fecha_nacimiento=fecha_nacimiento,
        genero=genero,
        correo=correo,
        celular=celular,
        foto_size=foto.size if foto else None,
        foto_nombre=foto.filename if foto else None,
    )

    persona = await db.get(Persona, numero_documento)
    if not persona:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona no encontrada")

    # En SQLAlchemy el objeto ORM se comporta como un objeto normal: asignar un
    # atributo marca la fila como modificada. `setattr` hace lo mismo que
    # `persona.primer_nombre = ...` pero recorriendo todos los campos.
    campos = datos.model_dump(exclude={"foto_size", "foto_nombre"})
    for clave, valor in campos.items():
        setattr(persona, clave, valor)
    if foto:
        persona.foto_url = guardar_foto(foto, numero_documento)
    await db.flush()

    # SECURITY: auditoría ANTES del commit; si ms-logs falla, rollback y no se
    # guarda ningún cambio. Igual patrón que en `ms-person-create`.
    try:
        await registrar_transaccion(
            token, "UPDATE", numero_documento, {"payload": datos.model_dump(mode="json")}
        )
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    await db.commit()

    # Reindexado: el texto de la persona cambió, así que hay que borrar su vector
    # viejo y crear uno nuevo para que el RAG no responda con datos antiguos.
    # `delete(...).where(...)` es un DELETE de SQLAlchemy 2.0 (nunca string SQL).
    try:
        texto = texto_para_embedding(datos.model_dump())
        vector = await generar_embedding(texto)
        if vector:
            await db.execute(
                delete(PersonaEmbedding).where(
                    PersonaEmbedding.numero_documento == numero_documento
                )
            )
            db.add(PersonaEmbedding(
                numero_documento=numero_documento,
                contenido_texto=texto,
                embedding=vector,
            ))
            await db.commit()
    except Exception as exc:  # pragma: no cover
        # Como en create, el reindexado es mejor esfuerzo: la persona ya se
        # actualizó y se registró en el log; solo se pierde la búsqueda semántica.
        await db.rollback()
        logger.warning("No se pudo reindexar el embedding de %s: %s", numero_documento, exc)

    # Tras el commit (y el posible commit del embedding) el objeto quedó expirado:
    # hay que recargarlo en async para que Pydantic pueda leer updated_at.
    await db.refresh(persona)
    return PersonaOut.model_validate(persona)


# Registra las rutas del router en la aplicación FastAPI.
app.include_router(router)
