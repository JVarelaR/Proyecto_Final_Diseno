"""Microservicio: registro y consulta filtrada de logs (opción 6 del menú)."""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

from datetime import date, datetime, time

from fastapi import APIRouter, Depends, FastAPI, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.models import TransaccionLog
from shared.schemas import LogCreate, LogOut, TipoTransaccion
from shared.security import get_current_user

app = FastAPI(title="MS Logs")
# El prefijo debe coincidir con el `location /api/v1/logs` de gateway/nginx.conf.
router = APIRouter(prefix="/api/v1/logs", tags=["Auditoría"])


@router.get("/health", tags=["Salud"])
async def health() -> dict:
    return {"status": "ok", "service": "ms-logs"}


# `response_model=LogOut` filtra la respuesta: aunque el objeto ORM tuviera más
# atributos, solo se exponen los campos declarados en el esquema de salida.
@router.post("", response_model=LogOut, status_code=status.HTTP_201_CREATED)
async def crear_log(
    body: LogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> LogOut:
    # SECURITY: `Depends(get_current_user)` protege también la ESCRITURA del log:
    # el JWT de servicio de n8n pasa por aquí y se valida igual que el de un usuario.
    registro = TransaccionLog(
        tipo_transaccion=body.tipo_transaccion,
        numero_documento=body.numero_documento,
        detalle=body.detalle,
    )
    # `add` prepara el INSERT, `commit` lo confirma y `refresh` recarga el id
    # UUID y `fecha_transaccion` que calculó Postgres (server_default).
    db.add(registro)
    await db.commit()
    await db.refresh(registro)
    return LogOut.model_validate(registro)


@router.get("", response_model=list[LogOut])
async def consultar_logs(
    tipo_transaccion: TipoTransaccion | None = Query(default=None),
    numero_documento: str | None = Query(default=None, max_length=10),
    fecha_desde: date | None = Query(default=None),
    fecha_hasta: date | None = Query(default=None),
    limite: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> list[LogOut]:
    # `select()` construye un SELECT de SQLAlchemy 2.0: es un objeto que se
    # puede ir modificando con `.where()` antes de ejecutarlo. Equivale a
    # armar una consulta por partes en vez de concatenar strings de SQL
    # (lo cual además evita inyección SQL).
    consulta = select(TransaccionLog)

    # Cada filtro es opcional: si el parámetro no viene, no se añade cláusula.
    if tipo_transaccion is not None:
        consulta = consulta.where(TransaccionLog.tipo_transaccion == tipo_transaccion)
    if numero_documento is not None:
        consulta = consulta.where(TransaccionLog.numero_documento == numero_documento)
    # `datetime.combine(fecha, time.min/max)` convierte un día en un rango
    # completo: desde 00:00:00 hasta 23:59:59.999, para no perder eventos.
    if fecha_desde is not None:
        consulta = consulta.where(
            TransaccionLog.fecha_transaccion >= datetime.combine(fecha_desde, time.min)
        )
    if fecha_hasta is not None:
        consulta = consulta.where(
            TransaccionLog.fecha_transaccion <= datetime.combine(fecha_hasta, time.max)
        )

    # Más recientes primero y tope de 1000 para no devolver la tabla entera.
    consulta = consulta.order_by(TransaccionLog.fecha_transaccion.desc()).limit(limite)
    resultado = await db.execute(consulta)
    # `.scalars()` convierte cada fila en un objeto `TransaccionLog` en vez de
    # una tupla; la comprensión de lista aplica el esquema de salida a cada uno.
    return [LogOut.model_validate(fila) for fila in resultado.scalars()]


app.include_router(router)
