"""Conexión y sesiones de base de datos compartidas por todos los microservicios.

Existe una sola definición del engine y de la sesión para que los servicios no
dupliquen configuración (AGENTS.md §4): cada microservicio importa `get_db` en
lugar de crear su propio `create_async_engine`.
"""

import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

# `+asyncpg` es el driver asíncrono: mientras se espera la BD, el servidor puede
# atender otras peticiones. La URL por defecto solo aplica si no hay entorno.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://admin:admin123@postgres-db:5432/gestion_personas",
)

# `pool_pre_ping` comprueba que la conexión siga viva antes de usarla; evita
# errores cuando Postgres se reinicia (por ejemplo, al levantar Docker).
engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
# `expire_on_commit=False`: tras guardar, los atributos del objeto siguen
# disponibles para responder sin recargar desde la BD (necesario en create).
AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

# `Base` es el "registro" de clases Python → tablas SQL. Los modelos de
# `shared.models` heredan de ella y Alembic lee esta metadata para migrar.
Base = declarative_base()


async def get_db():
    """Entrega una sesión por petición y la cierra siempre ( patrón `yield`).

    En POO sería equivalente a inyectar un objeto colaborador en el constructor;
    aquí FastAPI lo hace con `Depends(get_db)` en cada endpoint.
    """
    # `async with` garantiza el cierre incluso si hay excepción: no se filtran conexiones.
    async with AsyncSessionLocal() as session:
        yield session
