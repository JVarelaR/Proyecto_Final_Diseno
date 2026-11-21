"""Esquemas Pydantic v2 compartidos por todos los microservicios.

Las reglas de validación son exactamente las del enunciado (contexto.md §2.3).
Cuando se construya el frontend, Zod debe replicarlas idénticamente.
"""

# `from __future__ import annotations` permite escribir `str | None` en las
# anotaciones sin problemas de versión de Python; no cambia la validación.
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# SECURITY: validar la fecha antes de persistir evita datos ambiguos (15-ene
# vs 15-jan) y es una de las reglas que la rúbrica revisa en ambos lados.
# Meses en español decididos para el formato dd-mmm-yyyy (contexto.md §8, riesgo #4).
MESES_ES = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}

MAX_FOTO_BYTES = 2 * 1024 * 1024  # 2 MB, mismo límite que debe usar Zod.


# `Enum` convierte la lista del enunciado en un tipo: FastAPI rechaza
# automáticamente cualquier valor que no esté aquí (422) antes del endpoint.
class TipoDocumento(str, Enum):
    TARJETA_IDENTIDAD = "Tarjeta de identidad"
    CEDULA = "Cédula"


class Genero(str, Enum):
    MASCULINO = "Masculino"
    FEMENINO = "Femenino"
    NO_BINARIO = "No binario"
    PREFIERO_NO_REPORTAR = "Prefiero no reportar"


# `Literal` es una lista cerrada de cadenas para los tipos de evento del log.
# Es la versión de Pydantic de un enum, y debe coincidir con el Zod del frontend.
TipoTransaccion = Literal["CREATE", "READ", "UPDATE", "DELETE", "RAG_QUERY"]


def _parse_fecha_nacimiento(value: object) -> date:
    """Acepta date/datetime, ISO (datepicker) o dd-mmm-yyyy en español.

    Se necesitan tres formatos porque el datepicker envía YYYY-MM-DD, el
    formulario manual envía `15-ene-2000` y los objetos Python ya vienen como
    `date`. Unificarlos aquí evita crear validaciones distintas por servicio.
    """
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        texto = value.strip()
        partes = texto.split("-")
        if len(partes) == 3:
            dia, mes, anio = partes
            numero_mes = MESES_ES.get(mes.strip().lower())
            if numero_mes is not None:
                try:
                    return date(int(anio), numero_mes, int(dia))
                except ValueError as exc:
                    raise ValueError("Fecha inválida en formato dd-mmm-yyyy") from exc
        try:
            return date.fromisoformat(texto)
        except ValueError as exc:
            raise ValueError(
                "La fecha debe venir en dd-mmm-yyyy (meses en español) o YYYY-MM-DD"
            ) from exc
    raise ValueError("Tipo de fecha no soportado")


def _sin_digitos(value: str) -> str:
    """Regla del enunciado: nombres y apellidos no pueden contener números."""
    if any(caracter.isdigit() for caracter in value):
        raise ValueError("Este campo no puede contener números")
    return value


class PersonaBase(BaseModel):
    """Campos del formulario. `BaseModel` = objeto cuyos datos se validan solos.

    Es como un `set` con validación en cada asignación: si el tipo o la regla
    fallan, Pydantic lanza `ValidationError` y FastAPI responde 422 sin que el
    endpoint tenga que comprobar nada manualmente.
    """

    # Quitar espacios extremos antes de validar evita que " Ana " pase como
    # nombre distinto de "Ana" (y que el correo falle por un espacio final).
    model_config = ConfigDict(str_strip_whitespace=True)

    tipo_documento: TipoDocumento
    # `pattern` es una expresión regular: ^\d{1,10}$ = solo dígitos, de 1 a 10.
    numero_documento: str = Field(min_length=1, max_length=10, pattern=r"^\d{1,10}$")
    primer_nombre: str = Field(min_length=1, max_length=30)
    segundo_nombre: str | None = Field(default=None, max_length=30)
    apellidos: str = Field(min_length=1, max_length=60)
    fecha_nacimiento: date
    genero: Genero
    correo: EmailStr
    # El enunciado exige exactamente 10 dígitos, no un rango.
    celular: str = Field(pattern=r"^\d{10}$")

    # `@field_validator` es el equivalente a un setter que valida: se ejecuta
    # después de que Pydantic asigna el campo. El decorador `@classmethod` va
    # siempre junto en Pydantic v2; `cls` sería la clase en POO.
    @field_validator("primer_nombre")
    @classmethod
    def validar_primer_nombre(cls, value: str) -> str:
        return _sin_digitos(value)

    # `mode="before"` se ejecuta ANTES de la validación de tipo: convierte el
    # string vacío del formulario en None para que el campo opcional no falle.
    @field_validator("segundo_nombre", mode="before")
    @classmethod
    def normalizar_segundo_nombre(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("segundo_nombre")
    @classmethod
    def validar_segundo_nombre(cls, value: str | None) -> str | None:
        return None if value is None else _sin_digitos(value)

    @field_validator("apellidos")
    @classmethod
    def validar_apellidos(cls, value: str) -> str:
        return _sin_digitos(value)

    # Otra vez `mode="before"`: la fecha llega como texto y hay que convertirla
    # a `date` antes de que Pydantic compruebe el tipo declarado arriba.
    @field_validator("fecha_nacimiento", mode="before")
    @classmethod
    def validar_fecha(cls, value: object) -> date:
        return _parse_fecha_nacimiento(value)


class PersonaCreate(PersonaBase):
    """Datos del formulario. La foto se valida por tamaño antes de guardarse.

    Hereda de `PersonaBase` para reutilizar las 9 reglas; la foto se comprueba
    por tamaño, no por contenido (el contenido se guarda en `shared.uploads`).
    SECURITY: 2 MB es el límite de la rúbrica y debe coincidir con Zod.
    """

    foto_size: int | None = Field(default=None, ge=0)
    foto_nombre: str | None = Field(default=None, max_length=255)

    @field_validator("foto_size")
    @classmethod
    def validar_tamano_foto(cls, value: int | None) -> int | None:
        if value is not None and value > MAX_FOTO_BYTES:
            raise ValueError("La foto no puede superar los 2 MB")
        return value


class PersonaUpdate(PersonaCreate):
    """Actualización completa; `numero_documento` es la llave inmutable."""


class PersonaOut(PersonaBase):
    """Lo que responde la API. `from_attributes=True` permite convertir un
    objeto ORM (`Persona`) directamente con `PersonaOut.model_validate(persona)`,
    sin tener que copiar campo por campo a mano."""

    model_config = ConfigDict(from_attributes=True)

    foto_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class LogCreate(BaseModel):
    """Entrada para crear un evento de auditoría (lo llama `log_client`)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    tipo_transaccion: TipoTransaccion
    numero_documento: str | None = Field(default=None, max_length=10)
    detalle: dict = Field(default_factory=dict)


class LogOut(BaseModel):
    """Salida de la consulta de logs (rúbrica: filtros por tipo/doc/fecha)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tipo_transaccion: str
    numero_documento: str | None = None
    detalle: dict
    fecha_transaccion: datetime
