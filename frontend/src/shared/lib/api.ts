/* Cliente HTTP único hacia el gateway. Centraliza Bearer, FormData, health checks y el evento de 401 para que ningún feature hable con un microservicio directamente. */
import type { ConsultaDocumentoValues, PersonaFormValues } from "./validation";

/**
 * Cliente HTTP de la SPA: SIEMPRE habla con el gateway, nunca con un
 * microservicio directamente (AGENTS.md §5). Las rutas relativas funcionan
 * tanto en desarrollo (proxy de Vite) como en producción (mismo dominio).
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
export const N8N_CHAT_URL =
  import.meta.env.VITE_N8N_CHAT_URL ?? "/n8n/webhook/chat-rag-consulta-personas/chat";

export type Servicio =
  | "auth"
  | "create"
  | "update"
  | "delete"
  | "query"
  | "logs"
  | "rag";

export type Usuario = {
  user_id: string;
  email: string;
  name: string;
};

export type Persona = PersonaFormValues & {
  foto_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RegistroLog = {
  id: string;
  tipo_transaccion: string;
  numero_documento: string | null;
  detalle: Record<string, unknown>;
  fecha_transaccion: string;
};

export type FiltrosLog = {
  tipo_transaccion?: string;
  numero_documento?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
  }
}

type Opciones = {
  metodo?: string;
  cuerpo?: BodyInit;
  token?: string | null;
  timeoutMs?: number;
};

async function pedir<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = "GET", cuerpo, token, timeoutMs = 20000 } = opciones;
  const controlador = new AbortController();
  const temporizador = globalThis.setTimeout(() => controlador.abort(), timeoutMs);
  const cabeceras = new Headers();
  if (token) cabeceras.set("Authorization", `Bearer ${token}`);
  if (cuerpo && !(cuerpo instanceof FormData)) cabeceras.set("Content-Type", "application/json");

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo,
      signal: controlador.signal,
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servicio. Inténtalo de nuevo.");
  } finally {
    globalThis.clearTimeout(temporizador);
  }

  if (!respuesta.ok) {
    // SEGURIDAD: un 401 significa que el JWT venció o fue revocado: cerramos la sesión
    // SEGURIDAD: cerramos la sesión local para no dejar pantallas muertas.
    if (respuesta.status === 401 && token) {
      window.dispatchEvent(new CustomEvent("gd:unauthorized"));
    }
    let detalle = `Error ${respuesta.status}`;
    try {
      const datos: unknown = await respuesta.json();
      if (datos && typeof datos === "object" && "detail" in datos) {
        const detalleApi = (datos as { detail: unknown }).detail;
        detalle = typeof detalleApi === "string" ? detalleApi : JSON.stringify(detalleApi);
      }
    } catch {
      detalle = respuesta.statusText || detalle;
    }
    throw new ApiError(respuesta.status, detalle);
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

function aFormData(valores: PersonaFormValues): FormData {
  const datos = new FormData();
  const campos: Array<[string, string | undefined]> = [
    ["tipo_documento", valores.tipo_documento],
    ["numero_documento", valores.numero_documento],
    ["primer_nombre", valores.primer_nombre],
    ["segundo_nombre", valores.segundo_nombre || undefined],
    ["apellidos", valores.apellidos],
    ["fecha_nacimiento", valores.fecha_nacimiento],
    ["genero", valores.genero],
    ["correo", valores.correo],
    ["celular", valores.celular],
  ];
  for (const [clave, valor] of campos) {
    if (valor !== undefined) datos.append(clave, valor);
  }
  const foto = valores.foto as File | undefined;
  if (foto) datos.append("foto", foto, foto.name);
  return datos;
}

/** URL pública de salud de cada panel (la de n8n pasa por basic-auth). */
function urlSalud(servicio: Servicio): string {
  if (servicio === "rag") return "/n8n/healthz";
  return `${API_URL}/${servicio}/health`;
}

/**
 * Comprueba la salud de un servicio a través del gateway y permite mostrar
 * "servicio inactivo" sin derribar el resto de la interfaz.
 *
 * En `/n8n/` el gateway pide basic-auth ANTES de contactar a n8n: un 401
 * significa que el gateway responde y que el usuario debe autenticarse, así
 * que no lo tratamos como caída. Un 502/503 sí indica que n8n no responde.
 */
export async function verificarServicio(servicio: Servicio): Promise<boolean> {
  const controlador = new AbortController();
  const temporizador = globalThis.setTimeout(() => controlador.abort(), 4000);
  try {
    const respuesta = await fetch(urlSalud(servicio), {
      signal: controlador.signal,
      credentials: "same-origin",
    });
    if (respuesta.status === 401) return true;
    return respuesta.ok;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(temporizador);
  }
}

export const api = {
  login(email: string, password: string) {
    return pedir<{ access_token: string; token_type: string; user: Usuario }>("/auth/login", {
      metodo: "POST",
      cuerpo: JSON.stringify({ email, password }),
    });
  },

  logout(token: string) {
    return pedir<{ message: string }>("/auth/logout", { metodo: "POST", token });
  },

  crearPersona(valores: PersonaFormValues, token: string) {
    return pedir<Persona>("/create", {
      metodo: "POST",
      cuerpo: aFormData(valores),
      token,
      timeoutMs: 40000,
    });
  },

  actualizarPersona(documento: string, valores: PersonaFormValues, token: string) {
    return pedir<Persona>(`/update/${encodeURIComponent(documento)}`, {
      metodo: "PUT",
      cuerpo: aFormData(valores),
      token,
      timeoutMs: 40000,
    });
  },

  borrarPersona(documento: string, token: string) {
    return pedir<void>(`/delete/${encodeURIComponent(documento)}`, {
      metodo: "DELETE",
      token,
    });
  },

  consultarPersona(documento: string, token: string) {
    return pedir<Persona>(`/query/${encodeURIComponent(documento)}`, { token });
  },

  consultarLogs(filtros: FiltrosLog, token: string) {
    const parametros = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) parametros.set(clave, valor);
    }
    const sufijo = parametros.toString();
    return pedir<RegistroLog[]>(`/logs${sufijo ? `?${sufijo}` : ""}`, { token });
  },
};

export type { ConsultaDocumentoValues };
