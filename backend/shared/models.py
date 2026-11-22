"""Modelos ORM compartidos: clases Python que representan tablas de PostgreSQL.

Están en `shared` (AGENTS.md §4) para que los cinco microservicios hablen del
mismo esquema. Alembic crea las tablas; el código nunca llama a `create_all()`.
"""

import uuid
from datetime import date, datetime
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from shared.database import Base


class Persona(Base):
    """La tabla `personas`. Heredar de `Base` la registra en la metadata de SQLAlchemy.

    Cada `Column` es un atributo de la clase que se traduce en una columna SQL;
    en POO sería el equivalente a declarar los campos del objeto, pero con el
    tipo de dato y las restricciones de la base de datos incluidos.
    """

    __tablename__ = "personas"

    # Llave primaria: el número de documento identifica a la persona y es la
    # llave de búsqueda exigida por el enunciado (no se usa un id autoincremental).
    numero_documento = Column(String(10), primary_key=True, index=True)
    tipo_documento = Column(String(30), nullable=False)
    primer_nombre = Column(String(30), nullable=False)
    segundo_nombre = Column(String(30), nullable=True)
    apellidos = Column(String(60), nullable=False)
    fecha_nacimiento = Column(Date, nullable=False)
    genero = Column(String(30), nullable=False)
    correo = Column(String(100), nullable=False)
    celular = Column(String(10), nullable=False)
    # La foto no se guarda como binario en la BD: se sube al volumen compartido
    # y aquí solo se guarda la URL que sirve el gateway (/uploads/<archivo>).
    foto_url = Column(Text, nullable=True)
    # `server_default=func.now()` lo calcula Postgres, no Python: así funciona
    # igual si otra herramienta (n8n, psql) inserta una fila directamente.
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TransaccionLog(Base):
    """Auditoría: una fila por CREATE/READ/UPDATE/DELETE/RAG_QUERY (rúbrica).

    `detalle` es JSONB para poder guardar formas distintas de evento (por
    ejemplo `{pregunta, respuesta}` en el RAG) sin crear columnas nuevas.
    """

    __tablename__ = "transaccion_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo_transaccion = Column(String(20), nullable=False, index=True)
    numero_documento = Column(String(10), nullable=True, index=True)
    detalle = Column(JSONB, nullable=False, default=dict)
    fecha_transaccion = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class PersonaEmbedding(Base):
    """Texto indexado de una persona + su vector para búsqueda por similitud.

    Se guarda en tabla separada (1:1 con `personas`) para no mezclar el dato
    operativo con el índice vectorial: si falla OpenRouter, el CRUD sigue vivo.
    """

    __tablename__ = "persona_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_documento = Column(
        String(10),
        ForeignKey("personas.numero_documento", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    contenido_texto = Column(Text, nullable=False)
    # 768 es el tamaño fijo acordado con el proveedor actual (OpenRouter,
    # `openai/text-embedding-3-small` con dimensions=768). Si cambia el modelo,
    # hay que reindexar: este número debe coincidir con la migración y con
    # `EMBED_DIMENSIONS` de `shared.embedding_client` (contexto.md §8).
    embedding = Column(Vector(768), nullable=False)


# Índice HNSW: en lugar de comparar el vector de la pregunta con los 1.000.000
# de filas, pgvector recorre un grafo y devuelve los vecinos más cercanos.
# `vector_cosine_ops` = distancia coseno (comparación de direcciones, no de
# magnitud), que es la que usa el workflow de n8n.
Index(
    "ix_persona_embeddings_vector",
    PersonaEmbedding.embedding,
    postgresql_using="hnsw",
    postgresql_with={"m": 16, "ef_construction": 64},
    postgresql_ops={"embedding": "vector_cosine_ops"},
)


class RobleTokenStorage(Base):
    """Storage de sesiones del SDK ROBLE.

    SECURITY: aquí se guardan tokens de sesión; nunca se exponen por HTTP ni
    se imprimen en logs.

    Excepción documentada: el SDK exige una interfaz síncrona, por lo que se
    atiende desde `shared.roble_storage`. La tabla la crea Alembic, nunca create_all.
    """

    __tablename__ = "roble_token_storage"

    storage_key = Column(String(255), primary_key=True)
    storage_value = Column(Text, nullable=False)
