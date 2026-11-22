/* Pruebas de las reglas Zod. Sirven como contrato ejecutable frente a las reglas Pydantic del backend. */
import { describe, expect, it } from "vitest";
import {
  MAX_FOTO_BYTES,
  consultaDocumentoSchema,
  filtrosLogSchema,
  personaSchema,
  valoresVacios,
  type PersonaFormValues,
} from "./validation";

const personaValida = (): PersonaFormValues => ({
  ...valoresVacios,
  numero_documento: "100200300",
  primer_nombre: "Ana María",
  apellidos: "Pérez Gómez",
  fecha_nacimiento: "20-mar-2005",
  correo: "ana@example.com",
  celular: "3001234567",
});

describe("personaSchema", () => {
  it("acepta los campos del enunciado, incluido el segundo nombre opcional", () => {
    expect(personaSchema.safeParse(personaValida()).success).toBe(true);
    expect(
      personaSchema.safeParse({ ...personaValida(), segundo_nombre: "José" }).success,
    ).toBe(true);
  });

  it("acepta la fecha ISO que envía el calendario", () => {
    expect(
      personaSchema.safeParse({ ...personaValida(), fecha_nacimiento: "2005-03-20" }).success,
    ).toBe(true);
  });

  it("rechaza documento no numérico o mayor de 10 caracteres", () => {
    expect(
      personaSchema.safeParse({ ...personaValida(), numero_documento: "abc123" }).success,
    ).toBe(false);
    expect(
      personaSchema.safeParse({ ...personaValida(), numero_documento: "12345678901" }).success,
    ).toBe(false);
  });

  it("rechaza números y exceso de longitud en nombres y apellidos", () => {
    expect(
      personaSchema.safeParse({ ...personaValida(), primer_nombre: "Ana1" }).success,
    ).toBe(false);
    expect(
      personaSchema.safeParse({ ...personaValida(), apellidos: "a".repeat(61) }).success,
    ).toBe(false);
    expect(
      personaSchema.safeParse({ ...personaValida(), primer_nombre: "a".repeat(31) }).success,
    ).toBe(false);
    expect(
      personaSchema.safeParse({ ...personaValida(), segundo_nombre: "José2" }).success,
    ).toBe(false);
  });

  it("rechaza fechas inexistentes o con mes inglés", () => {
    expect(
      personaSchema.safeParse({ ...personaValida(), fecha_nacimiento: "30-feb-2005" }).success,
    ).toBe(false);
    expect(
      personaSchema.safeParse({ ...personaValida(), fecha_nacimiento: "20-mar-abc" }).success,
    ).toBe(false);
    expect(
      personaSchema.safeParse({ ...personaValida(), fecha_nacimiento: "20-mar-2005" }).success,
    ).toBe(true);
  });

  it("valida correo, celular exacto y foto de hasta 2 MB", () => {
    expect(personaSchema.safeParse({ ...personaValida(), correo: "no-es-correo" }).success).toBe(false);
    expect(personaSchema.safeParse({ ...personaValida(), celular: "300123456" }).success).toBe(false);
    expect(
      personaSchema.safeParse({ ...personaValida(), foto: { size: MAX_FOTO_BYTES } }).success,
    ).toBe(true);
    expect(
      personaSchema.safeParse({ ...personaValida(), foto: { size: MAX_FOTO_BYTES + 1 } }).success,
    ).toBe(false);
  });
});

describe("consultas y filtros", () => {
  it("la búsqueda exige un documento de máximo 10 dígitos", () => {
    expect(consultaDocumentoSchema.safeParse({ numero_documento: "100200300" }).success).toBe(true);
    expect(consultaDocumentoSchema.safeParse({ numero_documento: "abc" }).success).toBe(false);
  });

  it("el rango de fechas del log no puede estar invertido", () => {
    const base = {
      tipo_transaccion: "",
      numero_documento: "",
    };
    expect(
      filtrosLogSchema.safeParse({ ...base, fecha_desde: "2026-01-02", fecha_hasta: "2026-01-01" })
        .success,
    ).toBe(false);
    expect(
      filtrosLogSchema.safeParse({ ...base, fecha_desde: "2026-01-01", fecha_hasta: "2026-01-02" })
        .success,
    ).toBe(true);
  });
});
