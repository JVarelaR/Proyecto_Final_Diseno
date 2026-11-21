"""Pruebas unitarias de las validaciones compartidas (Pydantic v2).

Pytest ejecuta cualquier función que empiece con `test_`. Aquí se comprueba
que las reglas de `shared.schemas` (que Zod debe replicar) aceptan y rechazan
los valores correctos. Es la red de seguridad antes de tocar validaciones.
"""

from datetime import date

import pytest
from pydantic import ValidationError

from shared.schemas import MAX_FOTO_BYTES, LogCreate, PersonaCreate


# `**cambios` permite reutilizar la misma base y sobrescribir solo un campo
# en cada prueba (por ejemplo, `datos_validos(celular="300123")`).
def datos_validos(**cambios):
    base = {
        "tipo_documento": "Cédula",
        "numero_documento": "1234567890",
        "primer_nombre": "Ana",
        "segundo_nombre": "",
        "apellidos": "Pérez",
        "fecha_nacimiento": "15-ene-2000",
        "genero": "Femenino",
        "correo": "ana@example.com",
        "celular": "3001234567",
    }
    base.update(cambios)
    return base


def test_persona_valida_con_fecha_espanyol_y_segundo_nombre_vacio():
    persona = PersonaCreate(**datos_validos())
    assert persona.fecha_nacimiento == date(2000, 1, 15)
    assert persona.segundo_nombre is None


# `@parametrize` ejecuta la misma prueba una vez por pareja de la lista:
# son 9 casos con una sola función, en vez de 9 funciones casi idénticas.
@pytest.mark.parametrize("campo,valor", [
    ("numero_documento", "12345a"),
    ("numero_documento", "12345678901"),
    ("primer_nombre", "Juan2"),
    ("apellidos", "Pérez3"),
    ("celular", "300123"),
    ("correo", "no-es-correo"),
    ("tipo_documento", "Pasaporte"),
    ("genero", "Otro"),
    ("fecha_nacimiento", "15-jan-2000"),
])
def test_reglas_rechazan_datos_invalidos(campo, valor):
    with pytest.raises(ValidationError):
        PersonaCreate(**datos_validos(**{campo: valor}))


def test_foto_mayor_a_2mb_se_rechaza():
    with pytest.raises(ValidationError):
        PersonaCreate(**datos_validos(foto_size=MAX_FOTO_BYTES + 1))


# Según la rúbrica, la pregunta y la respuesta del RAG deben quedar en el log.
def test_log_rag_query_acepta_pregunta_y_respuesta():
    log = LogCreate(
        tipo_transaccion="RAG_QUERY",
        detalle={"pregunta": "¿Quién es el más joven?", "respuesta": "Pedro Pérez"},
    )
    assert log.detalle["respuesta"] == "Pedro Pérez"
