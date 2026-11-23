"""Crear tabla de memoria conversacional RAG.

Revision ID: b92e7c4a31d0
Revises: 7daaa620ddca
"""

from alembic import op
import sqlalchemy as sa

revision = "b92e7c4a31d0"
down_revision = "7daaa620ddca"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "rag_memoria_sesiones" not in inspector.get_table_names():
        op.create_table(
            "rag_memoria_sesiones",
            sa.Column("session_id", sa.String(128), primary_key=True),
            sa.Column("usuario_id", sa.String(255), nullable=False),
            sa.Column("persona_documento", sa.String(50), nullable=True),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "expires_at",
                sa.DateTime(timezone=True),
                server_default=sa.text(
                    "now() + interval '30 minutes'"
                ),
                nullable=False,
            ),
        )

    inspector = sa.inspect(conn)

    if "idx_rag_memoria_expires" not in {
        idx["name"]
        for idx in inspector.get_indexes("rag_memoria_sesiones")
    }:
        op.create_index(
            "idx_rag_memoria_expires",
            "rag_memoria_sesiones",
            ["expires_at"],
        )


def downgrade():
    op.drop_index(
        "idx_rag_memoria_expires",
        table_name="rag_memoria_sesiones",
    )
    op.drop_table("rag_memoria_sesiones")
