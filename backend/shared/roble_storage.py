"""Storage síncrono de sesiones ROBLE (excepción documentada en AGENTS.md §4).

El SDK `roble` exige `get_item`/`set_item`/`remove_item` síncronos. Los endpoints
siguen siendo async y usan `get_db`; solo este adaptador usa una sesión síncrona
centralizada. La tabla `roble_token_storage` la crea Alembic.
"""

# `from __future__ import annotations`: ver comentario en `shared.schemas`.
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from shared.database import Base
from shared.models import RobleTokenStorage

SYNC_DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://admin:admin123@postgres-db:5432/gestion_personas"
).replace("+asyncpg", "")

# Excepción controlada: el SDK ROBLE exige métodos síncronos, por eso aquí se
# usa `create_engine` (bloqueante) en lugar del `create_async_engine` de
# `shared.database`. Está aislado en este adaptador; los endpoints siguen async.
engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


class PostgresTokenStorage:
    """Implementa el protocolo TokenStorage del SDK `roble` por usuario.

    Es el patrón Adapter: el SDK espera un objeto con get/set/remove_item y
    nosotros lo implementamos sobre PostgreSQL. `namespace` es el correo del
    usuario para que las sesiones de dos personas no se mezclen.
    SECURITY: los valores son tokens de sesión; no se loguean ni se devuelven.
    """

    def __init__(self, namespace: str):
        self.namespace = namespace

    def _full_key(self, key: str) -> str:
        # Prefijar por usuario evita colisiones de claves en la tabla única.
        return f"{self.namespace}:{key}"

    def get_item(self, key: str) -> str | None:
        with SessionLocal() as db:
            fila = db.get(RobleTokenStorage, self._full_key(key))
            return fila.storage_value if fila else None

    def set_item(self, key: str, value: str) -> None:
        # `with SessionLocal()` cierra la sesión aunque falle el commit; es el
        # equivalente síncrono del `async with AsyncSessionLocal()` de get_db.
        with SessionLocal() as db:
            clave = self._full_key(key)
            fila = db.get(RobleTokenStorage, clave)
            if fila:
                fila.storage_value = value
            else:
                db.add(RobleTokenStorage(storage_key=clave, storage_value=value))
            db.commit()

    def remove_item(self, key: str) -> None:
        with SessionLocal() as db:
            fila = db.get(RobleTokenStorage, self._full_key(key))
            if fila:
                db.delete(fila)
                db.commit()
