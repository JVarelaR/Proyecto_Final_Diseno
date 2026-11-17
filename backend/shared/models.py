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
    __tablename__ = "personas"

    numero_documento = Column(String(10), primary_key=True, index=True)
    tipo_documento = Column(String(30), nullable=False)
    primer_nombre = Column(String(30), nullable=False)
    segundo_nombre = Column(String(30), nullable=True)
    apellidos = Column(String(60), nullable=False)
    fecha_nacimiento = Column(Date, nullable=False)
    genero = Column(String(30), nullable=False)
    correo = Column(String(100), nullable=False)
    celular = Column(String(10), nullable=False)
    foto_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TransaccionLog(Base):
    __tablename__ = "transaccion_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo_transaccion = Column(String(20), nullable=False, index=True)
    numero_documento = Column(String(10), nullable=True, index=True)
    detalle = Column(JSONB, nullable=False, default=dict)
    fecha_transaccion = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class PersonaEmbedding(Base):
    __tablename__ = "persona_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_documento = Column(
        String(10),
        ForeignKey("personas.numero_documento", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    contenido_texto = Column(Text, nullable=False)
    # 768 dimensiones corresponden al modelo 'nomic-embed-text' de Ollama
    embedding = Column(Vector(768), nullable=False)


Index(
    "ix_persona_embeddings_vector",
    PersonaEmbedding.embedding,
    postgresql_using="hnsw",
    postgresql_with={"m": 16, "ef_construction": 64},
    postgresql_ops={"embedding": "vector_cosine_ops"},
)