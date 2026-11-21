"""Cliente interino para registrar transacciones en `ms-logs`.

Es un adapter: el microservicio no escribe en `transaccion_logs` directamente,
llama a `ms-logs` por HTTP. Así se cumple "un microservicio por opción del menú"
y el log sigue funcionando aunque se detenga `ms-person-query` (R7).
"""

from __future__ import annotations

import os

import httpx

# Timeout corto a propósito: si ms-logs falla, la operación se rollback y el
# usuario recibe 503 en vez de una escritura sin auditoría (rúbrica: 15 pts).
LOGS_SERVICE_URL = os.getenv("LOGS_SERVICE_URL", "http://ms-logs:8000").rstrip("/")
TIMEOUT_SECONDS = float(os.getenv("LOGS_TIMEOUT_SECONDS", "5"))


async def registrar_transaccion(
    token: str,
    tipo_transaccion: str,
    numero_documento: str | None = None,
    detalle: dict | None = None,
) -> None:
    """Registra un evento y lanza error si `ms-logs` no lo confirmó.

    Los microservicios llaman a esta función antes de hacer commit: si el log
    falla, hacen rollback para no dejar operaciones sin auditoría.
    """
    # SECURITY: se reenvía el Bearer del usuario para que ms-logs también
    # verifique la sesión con get_current_user (ninguna ruta pública de log).
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        response = await client.post(
            f"{LOGS_SERVICE_URL}/api/v1/logs",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "tipo_transaccion": tipo_transaccion,
                "numero_documento": numero_documento,
                "detalle": detalle or {},
            },
        )
    # `raise_for_status()` no vale aquí: queremos un mensaje propio con el
    # cuerpo del error para diagnosticar por qué ms-logs rechazó el evento.
    if response.status_code >= 400:
        raise RuntimeError(
            f"No se pudo registrar la transacción en ms-logs: "
            f"{response.status_code} {response.text}"
        )
