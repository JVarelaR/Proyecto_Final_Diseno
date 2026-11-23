
"""Memoria conversacional para el microservicio RAG."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


DURACION_SESION = timedelta(minutes=30)


async def obtener_o_crear_sesion(
    db: AsyncSession,
    usuario_id: str,
    session_id: str | None = None,
) -> dict:
    """
    Recupera una sesión existente o crea una nueva.

    Impide utilizar sesiones pertenecientes a otro usuario.
    """
    ahora = datetime.now(timezone.utc)

    if session_id:
        resultado = await db.execute(
            text("""
                SELECT session_id, usuario_id,
                       persona_documento, expires_at
                FROM rag_memoria_sesiones
                WHERE session_id = :session_id
                FOR UPDATE
            """),
            {"session_id": session_id},
        )

        sesion = resultado.mappings().first()

        if sesion:
            if sesion["usuario_id"] != usuario_id:
                raise HTTPException(
                    status_code=403,
                    detail="La sesión pertenece a otro usuario",
                )

            if sesion["expires_at"] <= ahora:
                await db.execute(
                    text("""
                        UPDATE rag_memoria_sesiones
                        SET persona_documento = NULL,
                            updated_at = :ahora,
                            expires_at = :expires_at
                        WHERE session_id = :session_id
                    """),
                    {
                        "session_id": session_id,
                        "ahora": ahora,
                        "expires_at": ahora + DURACION_SESION,
                    },
                )
                await db.commit()
                return {
                    "session_id": session_id,
                    "persona_documento": None,
                }

            await db.execute(
                text("""
                    UPDATE rag_memoria_sesiones
                    SET updated_at = :ahora,
                        expires_at = :expires_at
                    WHERE session_id = :session_id
                """),
                {
                    "session_id": session_id,
                    "ahora": ahora,
                    "expires_at": ahora + DURACION_SESION,
                },
            )
            await db.commit()

            return {
                "session_id": session_id,
                "persona_documento": sesion["persona_documento"],
            }

        # No reutilizamos identificadores desconocidos enviados
        # por el cliente. Generamos uno nuevo.
        session_id = None

    nuevo_id = str(uuid4())

    await db.execute(
        text("""
            INSERT INTO rag_memoria_sesiones
                (session_id, usuario_id, persona_documento,
                 updated_at, expires_at)
            VALUES
                (:session_id, :usuario_id, NULL,
                 :ahora, :expires_at)
        """),
        {
            "session_id": nuevo_id,
            "usuario_id": usuario_id,
            "ahora": ahora,
            "expires_at": ahora + DURACION_SESION,
        },
    )

    await db.commit()

    return {
        "session_id": nuevo_id,
        "persona_documento": None,
    }


async def actualizar_persona_sesion(
    db: AsyncSession,
    usuario_id: str,
    session_id: str,
    persona_documento: str,
) -> None:
    """Actualiza la persona recordada en una sesión autorizada."""

    resultado = await db.execute(
        text("""
            UPDATE rag_memoria_sesiones
            SET persona_documento = :persona_documento,
                updated_at = NOW(),
                expires_at = NOW() + INTERVAL '30 minutes'
            WHERE session_id = :session_id
              AND usuario_id = :usuario_id
              AND expires_at > NOW()
        """),
        {
            "persona_documento": persona_documento,
            "session_id": session_id,
            "usuario_id": usuario_id,
        },
    )

    if resultado.rowcount != 1:
        await db.rollback()
        raise HTTPException(
            status_code=403,
            detail="Sesión inexistente, caducada o no autorizada",
        )

    await db.commit()
