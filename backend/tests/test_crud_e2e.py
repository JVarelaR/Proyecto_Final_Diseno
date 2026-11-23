"""
Test de integración E2E: CRUD completo de personas vía gateway HTTP.

Verifica para 5 personas:
  - CREATE  → POST /api/v1/create          (multipart/form-data)
  - READ    → GET  /api/v1/query/{doc}
  - UPDATE  → PUT  /api/v1/update/{doc}    (multipart/form-data)
  - DELETE  → DELETE /api/v1/delete/{doc}
  - LOGS    → GET  /api/v1/logs?numero_documento={doc}

Requisitos:
  - El stack Docker debe estar corriendo (docker compose up -d).
  - No necesita pytest ni librerías externas: solo la stdlib de Python.

Uso:
  python backend/tests/test_crud_e2e.py
  python backend/tests/test_crud_e2e.py --base-url http://localhost
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

BOUNDARY = "----TestBoundary7MA4YWxkTrZu0gW"

PERSONAS_TEST = [
    {
        "tipo_documento": "Cédula",
        "numero_documento": "9910000001",
        "primer_nombre": "Test",
        "segundo_nombre": "Uno",
        "apellidos": "Prueba Alpha",
        "fecha_nacimiento": "2000-01-15",
        "genero": "Masculino",
        "correo": "test.uno@prueba.com",
        "celular": "3200000001",
    },
    {
        "tipo_documento": "Cédula",
        "numero_documento": "9910000002",
        "primer_nombre": "Test",
        "segundo_nombre": "Dos",
        "apellidos": "Prueba Beta",
        "fecha_nacimiento": "1995-06-20",
        "genero": "Femenino",
        "correo": "test.dos@prueba.com",
        "celular": "3200000002",
    },
    {
        "tipo_documento": "Cédula",
        "numero_documento": "9910000003",
        "primer_nombre": "Test",
        "segundo_nombre": "Tres",
        "apellidos": "Prueba Gamma",
        "fecha_nacimiento": "1988-11-30",
        "genero": "No binario",
        "correo": "test.tres@prueba.com",
        "celular": "3200000003",
    },
    {
        "tipo_documento": "Tarjeta de identidad",
        "numero_documento": "9910000004",
        "primer_nombre": "Test",
        "segundo_nombre": "Cuatro",
        "apellidos": "Prueba Delta",
        "fecha_nacimiento": "2005-03-08",
        "genero": "Femenino",
        "correo": "test.cuatro@prueba.com",
        "celular": "3200000004",
    },
    {
        "tipo_documento": "Cédula",
        "numero_documento": "9910000005",
        "primer_nombre": "Test",
        "segundo_nombre": "Cinco",
        "apellidos": "Prueba Epsilon",
        "fecha_nacimiento": "1979-09-14",
        "genero": "Masculino",
        "correo": "test.cinco@prueba.com",
        "celular": "3200000005",
    },
]

# Campos a modificar en el UPDATE (el resto se mantiene igual).
ACTUALIZACIONES = {
    "9910000001": {"correo": "actualizado.uno@prueba.com", "celular": "3211000001"},
    "9910000002": {"correo": "actualizado.dos@prueba.com", "celular": "3211000002"},
    "9910000003": {"correo": "actualizado.tres@prueba.com", "celular": "3211000003"},
    "9910000004": {"correo": "actualizado.cuatro@prueba.com", "celular": "3211000004"},
    "9910000005": {"correo": "actualizado.cinco@prueba.com", "celular": "3211000005"},
}

# ---------------------------------------------------------------------------
# Utilidades HTTP
# ---------------------------------------------------------------------------


def _multipart_body(fields: dict[str, str]) -> bytes:
    """Construye el cuerpo de un request multipart/form-data."""
    parts: list[str] = []
    for key, value in fields.items():
        parts.append(
            f"--{BOUNDARY}\r\n"
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'
            f"{value}\r\n"
        )
    parts.append(f"--{BOUNDARY}--\r\n")
    return "".join(parts).encode("utf-8")


def _request(
    method: str,
    url: str,
    *,
    token: str | None = None,
    fields: dict[str, str] | None = None,
    expected_status: int | None = None,
) -> tuple[int, Any]:
    """Ejecuta una petición HTTP y devuelve (status_code, body_json_o_none)."""
    headers: dict[str, str] = {}
    data: bytes | None = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if fields is not None:
        data = _multipart_body(fields)
        headers["Content-Type"] = f"multipart/form-data; boundary={BOUNDARY}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            body = json.loads(raw) if raw else None
            return resp.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        body = json.loads(raw) if raw else None
        return exc.code, body


def _get_token(base_url: str) -> str:
    """Obtiene un Bearer token (AUTH_MODE=mock acepta cualquier credencial)."""
    login_data = json.dumps(
        {"email": "test@uninorte.edu.co", "password": "test123"}
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/v1/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read())
    return body["access_token"]


# ---------------------------------------------------------------------------
# Suite de tests
# ---------------------------------------------------------------------------


class Colores:
    OK = "\033[92m"
    FAIL = "\033[91m"
    WARN = "\033[93m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def _ok(msg: str) -> None:
    print(f"  {Colores.OK}✓{Colores.RESET} {msg}")


def _fail(msg: str) -> None:
    print(f"  {Colores.FAIL}✗{Colores.RESET} {msg}")


def _header(msg: str) -> None:
    print(f"\n{Colores.BOLD}{msg}{Colores.RESET}")


def assert_eq(label: str, expected: Any, actual: Any) -> bool:
    if expected == actual:
        _ok(f"{label}: {actual!r}")
        return True
    _fail(f"{label}: esperado={expected!r}, obtenido={actual!r}")
    return False


def assert_in(label: str, key: Any, collection: Any) -> bool:
    if key in collection:
        _ok(f"{label}: '{key}' presente")
        return True
    _fail(f"{label}: '{key}' NO encontrado en {collection!r}")
    return False


def run_tests(base_url: str) -> bool:
    total = passed = 0

    # -----------------------------------------------------------------------
    # Login
    # -----------------------------------------------------------------------
    _header("0. Obteniendo token de autenticación…")
    try:
        token = _get_token(base_url)
        _ok(f"Token obtenido: {token[:30]}…")
    except Exception as exc:
        _fail(f"No se pudo obtener token: {exc}")
        return False

    # -----------------------------------------------------------------------
    # Limpieza previa: eliminar documentos de prueba si ya existen
    # -----------------------------------------------------------------------
    _header("1. Limpieza previa (elimina test-docs si ya existen)…")
    for p in PERSONAS_TEST:
        doc = p["numero_documento"]
        status_code, _ = _request(
            "DELETE",
            f"{base_url}/api/v1/delete/{doc}",
            token=token,
        )
        if status_code == 204:
            print(f"  → Documento {doc} eliminado (existía de antes).")
        elif status_code == 404:
            print(f"  → Documento {doc} no existía (OK).")
        else:
            print(f"  → Documento {doc}: respuesta inesperada {status_code}.")

    # -----------------------------------------------------------------------
    # CREATE
    # -----------------------------------------------------------------------
    _header("2. CREATE → POST /api/v1/create")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        status_code, body = _request(
            "POST",
            f"{base_url}/api/v1/create",
            token=token,
            fields=p,
        )
        ok1 = assert_eq(f"  [{doc}] status", 201, status_code)
        ok2 = body is not None and assert_eq(
            f"  [{doc}] numero_documento", doc, body.get("numero_documento")
        )
        if ok1 and ok2:
            passed += 1
        else:
            _fail(f"  [{doc}] body: {body}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # READ (query)
    # -----------------------------------------------------------------------
    _header("3. READ → GET /api/v1/query/{doc}")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        status_code, body = _request(
            "GET",
            f"{base_url}/api/v1/query/{doc}",
            token=token,
        )
        ok1 = assert_eq(f"  [{doc}] status", 200, status_code)
        ok2 = body is not None and assert_eq(
            f"  [{doc}] primer_nombre", p["primer_nombre"], body.get("primer_nombre")
        )
        ok3 = body is not None and assert_eq(
            f"  [{doc}] apellidos", p["apellidos"], body.get("apellidos")
        )
        if ok1 and ok2 and ok3:
            passed += 1
        else:
            _fail(f"  [{doc}] body: {body}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # UPDATE
    # -----------------------------------------------------------------------
    _header("4. UPDATE → PUT /api/v1/update/{doc}")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        # Combina los datos originales con los campos actualizados.
        payload = {**p, **ACTUALIZACIONES[doc]}
        status_code, body = _request(
            "PUT",
            f"{base_url}/api/v1/update/{doc}",
            token=token,
            fields=payload,
        )
        nuevo_correo = ACTUALIZACIONES[doc]["correo"]
        ok1 = assert_eq(f"  [{doc}] status", 200, status_code)
        ok2 = body is not None and assert_eq(
            f"  [{doc}] correo actualizado", nuevo_correo, body.get("correo")
        )
        if ok1 and ok2:
            passed += 1
        else:
            _fail(f"  [{doc}] body: {body}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # Verificar READ post-UPDATE
    # -----------------------------------------------------------------------
    _header("5. READ post-UPDATE (verifica que los cambios persisten)")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        status_code, body = _request(
            "GET",
            f"{base_url}/api/v1/query/{doc}",
            token=token,
        )
        nuevo_correo = ACTUALIZACIONES[doc]["correo"]
        ok1 = assert_eq(f"  [{doc}] status", 200, status_code)
        ok2 = body is not None and assert_eq(
            f"  [{doc}] correo persistido", nuevo_correo, body.get("correo")
        )
        if ok1 and ok2:
            passed += 1
        else:
            _fail(f"  [{doc}] body: {body}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # Verificar LOGS (CREATE + READ + UPDATE + READ = 4 eventos por persona)
    # -----------------------------------------------------------------------
    _header("6. LOGS → GET /api/v1/logs?numero_documento={doc}")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        status_code, body = _request(
            "GET",
            f"{base_url}/api/v1/logs?numero_documento={doc}",
            token=token,
        )
        ok1 = assert_eq(f"  [{doc}] status logs", 200, status_code)
        tipos = [e.get("tipo_transaccion") for e in (body or [])]
        ok2 = assert_in(f"  [{doc}] tiene CREATE", "CREATE", tipos)
        ok3 = assert_in(f"  [{doc}] tiene READ", "READ", tipos)
        ok4 = assert_in(f"  [{doc}] tiene UPDATE", "UPDATE", tipos)
        if ok1 and ok2 and ok3 and ok4:
            passed += 1
        else:
            _fail(f"  [{doc}] tipos encontrados: {tipos}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # DELETE
    # -----------------------------------------------------------------------
    _header("7. DELETE → DELETE /api/v1/delete/{doc}")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        status_code, body = _request(
            "DELETE",
            f"{base_url}/api/v1/delete/{doc}",
            token=token,
        )
        ok1 = assert_eq(f"  [{doc}] status", 204, status_code)
        if ok1:
            passed += 1
        else:
            _fail(f"  [{doc}] body: {body}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # Verificar que el DELETE fue real (404 después de borrar)
    # -----------------------------------------------------------------------
    _header("8. Verificar 404 post-DELETE")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        status_code, body = _request(
            "GET",
            f"{base_url}/api/v1/query/{doc}",
            token=token,
        )
        ok1 = assert_eq(f"  [{doc}] status 404 tras borrar", 404, status_code)
        if ok1:
            passed += 1
        else:
            _fail(f"  [{doc}] body: {body}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # Verificar que el log de DELETE también quedó registrado
    # -----------------------------------------------------------------------
    _header("9. LOGS post-DELETE (debe contener evento DELETE)")
    for p in PERSONAS_TEST:
        total += 1
        doc = p["numero_documento"]
        status_code, body = _request(
            "GET",
            f"{base_url}/api/v1/logs?numero_documento={doc}",
            token=token,
        )
        tipos = [e.get("tipo_transaccion") for e in (body or [])]
        ok1 = assert_in(f"  [{doc}] tiene DELETE en log", "DELETE", tipos)
        if ok1:
            passed += 1
        else:
            _fail(f"  [{doc}] tipos encontrados: {tipos}")
        time.sleep(0.1)

    # -----------------------------------------------------------------------
    # Resumen
    # -----------------------------------------------------------------------
    color = Colores.OK if passed == total else Colores.FAIL
    print(f"\n{color}{Colores.BOLD}{'='*50}{Colores.RESET}")
    print(f"{color}{Colores.BOLD}  Resultado: {passed}/{total} tests pasaron{Colores.RESET}")
    print(f"{color}{Colores.BOLD}{'='*50}{Colores.RESET}\n")
    return passed == total


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test E2E CRUD de personas")
    parser.add_argument(
        "--base-url",
        default="http://localhost",
        help="URL base del gateway (default: http://localhost)",
    )
    args = parser.parse_args()

    ok = run_tests(args.base_url)
    sys.exit(0 if ok else 1)
