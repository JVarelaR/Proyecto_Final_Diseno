"""Microservicio: Crear Personas (opción 1 del menú)."""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.embedding_client import generar_embedding, texto_para_embedding
from shared.log_client import registrar_transaccion
from shared.models import Persona, PersonaEmbedding
from shared.schemas import Genero, PersonaCreate, PersonaOut, TipoDocumento
from shared.security import get_access_token, get_current_user
from shared.uploads import guardar_foto

# Logger para avisar si falla la indexación vectorial sin tirar el CRUD.
logger = logging.getLogger(__name__)
app = FastAPI(title="MS Person Create")
# Prefijo exacto del `location /api/v1/create` en gateway/nginx.conf.
router = APIRouter(prefix="/api/v1/create", tags=["Crear Personas"])


@router.get("/health", tags=["Salud"])
async def health() -> dict:
    return {"status": "ok", "service": "ms-person-create"}


# `Form(...)` = campo obligatorio del formulario multipart; `File(None)` = foto
# opcional. FastAPI convierte y valida antes de llamar a la función.
# `Depends` inyecta la sesión de BD, el usuario verificado y el token crudo.
@router.post("", response_model=PersonaOut, status_code=status.HTTP_201_CREATED)
async def crear_persona(
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
    # Aunque FastAPI ya validó los campos, se construye el Pydantic de `shared`
    # para aplicar las MISMAS reglas que el frontend replicará con Zod y para
    # poder usar `model_dump()` a la hora de guardar y de registrar el log.
    datos = PersonaCreate(
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

    # `db.get(Modelo, pk)` busca por llave primaria. El documento es la llave,
    # así que no puede haber dos personas con el mismo número (409 = conflicto).
    existe = await db.get(Persona, datos.numero_documento)
    if existe:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La persona ya existe")

    foto_url = guardar_foto(foto, datos.numero_documento) if foto else None
    persona = Persona(
        **datos.model_dump(exclude={"foto_size", "foto_nombre"}),
        foto_url=foto_url,
    )
    # `model_dump(exclude=...)` quita los campos de control de la foto (no son
    # columnas de la tabla); `foto_url` se guarda aparte.
    db.add(persona)
    # `flush` envía el INSERT a la BD SIN confirmarlo: así la persona ya existe
    # dentro de la transacción, pero todavía podemos hacer rollback si el log falla.
    await db.flush()

    # SECURITY: auditoría obligatoria (rúbrica). Se registra ANTES del commit;
    # si ms-logs no responde, se deshace la creación para no dejar rastro sin log.
    try:
        await registrar_transaccion(
            token, "CREATE", datos.numero_documento, {"payload": datos.model_dump(mode="json")}
        )
    except Exception as exc:
        # Rollback = "deshacer todo lo hecho desde el flush".
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))

    await db.commit()

    # Indexación vectorial: mejor esfuerzo, no bloquea el CRUD si OpenRouter falla.
    # Es un bloque distinto del log: la persona ya quedó guardada, así que un
    # error aquí solo se avisa por logger y el endpoint responde 201 igual.
    try:
        vector = await generar_embedding(texto_para_embedding(datos.model_dump()))
        if vector:
            db.add(PersonaEmbedding(
                numero_documento=persona.numero_documento,
                contenido_texto=texto_para_embedding(datos.model_dump()),
                embedding=vector,
            ))
            await db.commit()
    except Exception as exc:  # pragma: no cover - depende de servicio externo
        # Solo se deshace el commit del embedding; la persona ya estaba confirmada.
        await db.rollback()
        logger.warning("No se pudo indexar el embedding de %s: %s", datos.numero_documento, exc)

    return PersonaOut.model_validate(persona)


# Registra las rutas del router en la aplicación FastAPI.
app.include_router(router)
