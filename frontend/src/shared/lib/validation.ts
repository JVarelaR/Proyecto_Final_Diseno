/* Reglas Zod del formulario y los filtros. Espejo de backend/shared/schemas.py: validan en el navegador antes de llamar al gateway. */
import { z } from "zod";

/**
 * Reglas de validación del formulario de personas.
 *
 * Espejo exacto de `backend/shared/schemas.py` (contexto.md §2.3). Si cambia
 * una regla aquí, debe cambiar igual en Pydantic; la rúbrica evalúa ambos lados.
 */
export const TIPOS_DOCUMENTO = ["Tarjeta de identidad", "Cédula"] as const;
export const GENEROS = [
  "Masculino",
  "Femenino",
  "No binario",
  "Prefiero no reportar",
] as const;
export const TIPOS_TRANSACCION = ["CREATE", "READ", "UPDATE", "DELETE", "RAG_QUERY"] as const;
export const MESES_ES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};
export const MESES_ESCRITOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
] as const;
export const MAX_FOTO_BYTES = 2 * 1024 * 1024;

/** Comprueba una fecha real (incluye años < 100, evitando el atajo Date.UTC). */
function esFechaReal(anio: number, mes: number, dia: number): boolean {
  const fecha = new Date(Date.UTC(2000, mes - 1, dia));
  fecha.setUTCFullYear(anio);
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/**
 * Acepta `dd-mmm-yyyy` con meses en español (formato del enunciado) y también
 * `YYYY-MM-DD`, que es lo que envía un input type="date" (datepicker).
 */
export function fechaValida(valor: string): boolean {
  const texto = valor.trim();
  const partes = texto.split("-");
  if (partes.length === 3) {
    const numeroMes = MESES_ES[partes[1]!.trim().toLowerCase()];
    if (numeroMes !== undefined) {
      const dia = Number(partes[0]);
      const anio = Number(partes[2]);
      return esFechaReal(anio, numeroMes, dia);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      const anio = Number(partes[0]);
      const mes = Number(partes[1]);
      const dia = Number(partes[2]);
      return esFechaReal(anio, mes, dia);
    }
  }
  return false;
}

const texto = () => z.string().trim();

/**
 * `refine` devuelve un ZodEffects, que ya no admite `.min()`/`.max()`: por eso
 * las reglas de tamaño van ANTES y la de dígitos al final.
 */
const textoSinDigitos = (
  mensajeDigitos: string,
  max: number,
  mensajeObligatorio?: string,
) => {
  const base = texto().max(max, `Máximo ${max} caracteres`);
  const conLongitud = mensajeObligatorio ? base.min(1, mensajeObligatorio) : base;
  return conLongitud.refine((valor) => !/\d/.test(valor), mensajeDigitos);
};

/** Foto opcional; el límite de 2 MB se comprueba en el navegador y en Pydantic. */
const fotoSchema = z
  .any()
  .optional()
  .refine(
    (archivo) => !archivo || (typeof archivo.size === "number" && archivo.size <= MAX_FOTO_BYTES),
    "La foto no puede superar los 2 MB",
  );

export const personaSchema = z.object({
  tipo_documento: z.enum(TIPOS_DOCUMENTO, {
    errorMap: () => ({ message: "Selecciona un tipo de documento" }),
  }),
  numero_documento: texto()
    .min(1, "El número de documento es obligatorio")
    .max(10, "Máximo 10 caracteres")
    .regex(/^\d{1,10}$/, "Debe ser un número de máximo 10 dígitos"),
  primer_nombre: textoSinDigitos(
    "El primer nombre no puede contener números",
    30,
    "El primer nombre es obligatorio",
  ),
  segundo_nombre: z
    .union([
      textoSinDigitos("El segundo nombre no puede contener números", 30),
      z.literal(""),
    ])
    .optional(),
  apellidos: textoSinDigitos(
    "Los apellidos no pueden contener números",
    60,
    "Los apellidos son obligatorios",
  ),
  fecha_nacimiento: texto()
    .min(1, "La fecha de nacimiento es obligatoria")
    .refine(fechaValida, "Usa dd-mmm-yyyy (meses en español) o el calendario"),
  genero: z.enum(GENEROS, {
    errorMap: () => ({ message: "Selecciona un género" }),
  }),
  correo: texto().min(1, "El correo es obligatorio").email("Correo electrónico inválido"),
  celular: texto().regex(/^\d{10}$/, "El celular debe tener exactamente 10 dígitos"),
  foto: fotoSchema,
});

export type PersonaFormValues = z.infer<typeof personaSchema>;

export const valoresVacios: PersonaFormValues = {
  tipo_documento: "Cédula",
  numero_documento: "",
  primer_nombre: "",
  segundo_nombre: "",
  apellidos: "",
  fecha_nacimiento: "",
  genero: "Masculino",
  correo: "",
  celular: "",
  foto: undefined,
};

/** Esquema de búsqueda: la llave es el documento (rúbrica R2). */
export const consultaDocumentoSchema = z.object({
  numero_documento: texto()
    .trim()
    .regex(/^\d{1,10}$/, "Digita un número de documento de máximo 10 dígitos"),
});

export type ConsultaDocumentoValues = z.infer<typeof consultaDocumentoSchema>;

/** Filtros del log: tipo, documento y rango de fechas (rúbrica R9). */
export const filtrosLogSchema = z
  .object({
    tipo_transaccion: z.union([z.enum(TIPOS_TRANSACCION), z.literal("")]),
    numero_documento: texto().max(10, "Máximo 10 caracteres"),
    fecha_desde: texto(),
    fecha_hasta: texto(),
  })
  .refine(
    (filtros) =>
      !filtros.fecha_desde ||
      !filtros.fecha_hasta ||
      filtros.fecha_desde <= filtros.fecha_hasta,
    {
      message: "La fecha inicial no puede ser mayor que la final",
      path: ["fecha_hasta"],
    },
  );

export type FiltrosLogValues = z.infer<typeof filtrosLogSchema>;

export const filtrosLogVacios: FiltrosLogValues = {
  tipo_transaccion: "",
  numero_documento: "",
  fecha_desde: "",
  fecha_hasta: "",
};
