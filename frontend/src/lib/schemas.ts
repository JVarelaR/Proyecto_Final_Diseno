import { z } from "zod";

const numeroUnicode = /^\p{Decimal_Number}+$/u;
const contieneNumero = /\p{N}/u;

function fechaISOValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const fecha = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === value;
}

function longitud(value: string): number {
  return Array.from(value).length;
}

export const personaSchema = z.object({
  tipo_documento: z.enum(["Tarjeta de identidad", "Cédula"]),
  numero_documento: z
    .string()
    .regex(numeroUnicode, "Ingresa solo números.")
    .refine((value) => longitud(value) <= 10, "El documento no puede superar 10 dígitos.")
    .min(1, "El documento es obligatorio."),
  primer_nombre: z
    .string()
    .trim()
    .min(1, "El primer nombre es obligatorio.")
    .refine((value) => longitud(value) <= 30, "Máximo 30 caracteres.")
    .refine((value) => !contieneNumero.test(value), "No puede contener números."),
  segundo_nombre: z
    .string()
    .trim()
    .refine((value) => longitud(value) <= 30, "Máximo 30 caracteres.")
    .refine((value) => !contieneNumero.test(value), "No puede contener números."),
  apellidos: z
    .string()
    .trim()
    .min(1, "Los apellidos son obligatorios.")
    .refine((value) => longitud(value) <= 60, "Máximo 60 caracteres.")
    .refine((value) => !contieneNumero.test(value), "No puede contener números."),
  fecha_nacimiento: z
    .string()
    .refine(fechaISOValida, "Selecciona una fecha de nacimiento válida."),
  genero: z.enum([
    "Masculino",
    "Femenino",
    "No binario",
    "Prefiero no reportar",
  ]),
  correo: z.string().trim().email("Ingresa un correo electrónico válido."),
  celular: z
    .string()
    .regex(numeroUnicode, "Ingresa solo números.")
    .refine((value) => longitud(value) === 10, "El celular debe tener exactamente 10 dígitos."),
  foto: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.size <= 2 * 1024 * 1024, "La foto no puede superar 2 MB."),
});

export type PersonaFormValues = z.infer<typeof personaSchema>;

export const accesoSchema = z.object({
  email: z.string().trim().email("Ingresa un correo electrónico válido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export const registroSchema = accesoSchema.extend({
  name: z.string().trim().min(1, "Ingresa tu nombre.").max(100),
  password: z.string().min(8, "Usa al menos 8 caracteres."),
});

export type AccesoValues = z.infer<typeof accesoSchema>;
export type RegistroValues = z.infer<typeof registroSchema>;
