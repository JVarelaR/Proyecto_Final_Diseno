/* Formateo de fechas para la UI. Convierte entre ISO y dd-mmm-yyyy usando los meses en español acordados con el backend. */
import { MESES_ESCRITOS } from "./validation";

/** Convierte `YYYY-MM-DD` a `dd-mmm-yyyy` para mostrarlo en la UI. */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const partes = valor.slice(0, 10).split("-");
  if (partes.length !== 3) return valor;
  const [anio, mes, dia] = partes;
  const numeroMes = Number(mes);
  if (!Number.isInteger(numeroMes) || numeroMes < 1 || numeroMes > 12) return valor;
  return `${dia}-${MESES_ESCRITOS[numeroMes - 1]}-${anio}`;
}

/** Texto amable para errores de red/HTTP sin filtrar detalles técnicos. */
export function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado";
}
