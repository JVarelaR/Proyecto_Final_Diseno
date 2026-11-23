
/*
 * Cliente HTTP único hacia el gateway.
 * Centraliza autenticación Bearer, FormData, comprobaciones de salud
 * y el evento de sesión no autorizada.
 *
 * Todos los servicios se consumen a través del gateway.
 */
import type {
  ConsultaDocumentoValues,
  PersonaFormValues,
} from "./validation";

/**
 * Cliente HTTP de la SPA.
 *
 * Las rutas relativas funcionan tanto en desarrollo
 * (proxy de Vite) como en producción (mismo dominio).
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

/**
 * Enlace al chatbot original de n8n.
 * Se conserva por compatibilidad con componentes existentes.
 * El nuevo chat integrado utilizará api.consultarRag().
 */
export const N8N_CHAT_URL =
  import.meta.env.VITE_N8N_CHAT_URL ??
  "/n8n/webhook/chat-rag-consulta-personas/chat";

// ============================================================
// TIPOS GENERALES
// ============================================================

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

// ============================================================
// TIPOS DEL CHATBOT RAG
// ============================================================

/** Respuesta del microservicio RAG. */
export type RespuestaRag = {
  respuesta: string;
  session_id: string;
};

/** Solicitud enviada al microservicio RAG. */
export type SolicitudRag = {
  pregunta: string;
  session_id?: string;
};

// ============================================================
// TIPOS DE AUDITORÍA
// ============================================================

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

// ============================================================
// MANEJO DE ERRORES
// ============================================================

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

/**
 * Función central para todas las peticiones HTTP.
 *
 * - Adjunta el token Bearer si existe.
 * - Detecta cuerpos JSON y FormData.
 * - Controla tiempos de espera.
 * - Notifica errores 401.
 */
async function pedir<T>(
  ruta: string,
  opciones: Opciones = {}
): Promise<T> {
  const {
    metodo = "GET",
    cuerpo,
    token,
    timeoutMs = 20000,
  } = opciones;

  const controlador = new AbortController();

  const temporizador = globalThis.setTimeout(
    () => controlador.abort(),
    timeoutMs
  );

  const cabeceras = new Headers();

  if (token) {
    cabeceras.set("Authorization", `Bearer ${token}`);
  }

  if (cuerpo && !(cuerpo instanceof FormData)) {
    cabeceras.set("Content-Type", "application/json");
  }

  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo,
      signal: controlador.signal,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new ApiError(
        0,
        "La solicitud tardó demasiado tiempo. Inténtalo nuevamente."
      );
    }

    throw new ApiError(
      0,
      "No se pudo conectar con el servicio. Inténtalo de nuevo."
    );
  } finally {
    globalThis.clearTimeout(temporizador);
  }

  if (!respuesta.ok) {
    /*
     * Si el token ha expirado o fue revocado,
     * notificamos al contexto de autenticación.
     */
    if (respuesta.status === 401 && token) {
      window.dispatchEvent(
        new CustomEvent("gd:unauthorized")
      );
    }

    let detalle = `Error ${respuesta.status}`;

    try {
      const datos: unknown = await respuesta.json();

      if (
        datos &&
        typeof datos === "object" &&
        "detail" in datos
      ) {
        const detalleApi = (
          datos as { detail: unknown }
        ).detail;

        detalle =
          typeof detalleApi === "string"
            ? detalleApi
            : JSON.stringify(detalleApi);
      }
    } catch {
      detalle = respuesta.statusText || detalle;
    }

    throw new ApiError(respuesta.status, detalle);
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}

// ============================================================
// FORM DATA PARA PERSONAS
// ============================================================

function aFormData(
  valores: PersonaFormValues
): FormData {
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
    if (valor !== undefined) {
      datos.append(clave, valor);
    }
  }

  const foto = valores.foto as File | undefined;

  if (foto) {
    datos.append("foto", foto, foto.name);
  }

  return datos;
}

// ============================================================
// HEALTH CHECKS
// ============================================================

/**
 * Retorna la ruta de salud del microservicio.
 *
 * RAG ahora utiliza ms-rag en lugar del health check de n8n.
 */
function urlSalud(servicio: Servicio): string {
  return `${API_URL}/${servicio}/health`;
}

/**
 * Comprueba la disponibilidad de los servicios a través
 * del gateway sin interrumpir el resto de la aplicación.
 */
export async function verificarServicio(
  servicio: Servicio
): Promise<boolean> {
  const controlador = new AbortController();

  const temporizador = globalThis.setTimeout(
    () => controlador.abort(),
    4000
  );

  try {
    const respuesta = await fetch(urlSalud(servicio), {
      signal: controlador.signal,
      credentials: "same-origin",
    });

    if (respuesta.status === 401) {
      return true;
    }

    return respuesta.ok;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(temporizador);
  }
}

// ============================================================
// API PRINCIPAL
// ============================================================

export const api = {

  // ----------------------------------------------------------
  // AUTENTICACIÓN
  // ----------------------------------------------------------

  login(email: string, password: string) {
    return pedir<{
      access_token: string;
      token_type: string;
      user: Usuario;
    }>("/auth/login", {
      metodo: "POST",
      cuerpo: JSON.stringify({ email, password }),
    });
  },

  logout(token: string) {
    return pedir<{ message: string }>("/auth/logout", {
      metodo: "POST",
      token,
    });
  },

  // ----------------------------------------------------------
  // GESTIÓN DE PERSONAS
  // ----------------------------------------------------------

  crearPersona(
    valores: PersonaFormValues,
    token: string
  ) {
    return pedir<Persona>("/create", {
      metodo: "POST",
      cuerpo: aFormData(valores),
      token,
      timeoutMs: 40000,
    });
  },

  actualizarPersona(
    documento: string,
    valores: PersonaFormValues,
    token: string
  ) {
    return pedir<Persona>(
      `/update/${encodeURIComponent(documento)}`,
      {
        metodo: "PUT",
        cuerpo: aFormData(valores),
        token,
        timeoutMs: 40000,
      }
    );
  },

  borrarPersona(
    documento: string,
    token: string
  ) {
    return pedir<void>(
      `/delete/${encodeURIComponent(documento)}`,
      {
        metodo: "DELETE",
        token,
      }
    );
  },

  consultarPersona(
    documento: string,
    token: string
  ) {
    return pedir<Persona>(
      `/query/${encodeURIComponent(documento)}`,
      { token }
    );
  },

  // ----------------------------------------------------------
  // REGISTROS DE AUDITORÍA
  // ----------------------------------------------------------

  consultarLogs(
    filtros: FiltrosLog,
    token: string
  ) {
    const parametros = new URLSearchParams();

    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) {
        parametros.set(clave, valor);
      }
    }

    const sufijo = parametros.toString();

    return pedir<RegistroLog[]>(
      `/logs${sufijo ? `?${sufijo}` : ""}`,
      { token }
    );
  },

  // ----------------------------------------------------------
  // CHATBOT RAG AUTENTICADO
  // ----------------------------------------------------------

  /**
   * Envía una pregunta al microservicio ms-rag.
   *
   * Flujo:
   * React -> Gateway -> ms-rag -> n8n -> Ollama
   *
   * El token del usuario se valida en ms-rag.
   * La clave interna de n8n nunca se expone al navegador.
   *
   * La reutilización de session_id aún no equivale
   * a memoria conversacional persistente.
   */
  consultarRag(
    pregunta: string,
    token: string,
    sessionId?: string
  ) {
    const solicitud: SolicitudRag = {
      pregunta: pregunta.trim(),
      ...(sessionId
        ? { session_id: sessionId }
        : {}),
    };

    if (!solicitud.pregunta) {
      return Promise.reject(
        new ApiError(
          400,
          "Debes escribir una pregunta antes de enviarla."
        )
      );
    }

    return pedir<RespuestaRag>("/rag/chat", {
      metodo: "POST",
      cuerpo: JSON.stringify(solicitud),
      token,
      timeoutMs: 180000,
    });
  },
};

export type { ConsultaDocumentoValues };