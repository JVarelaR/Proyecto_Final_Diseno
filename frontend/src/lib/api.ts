const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const TOKEN_KEY = "nexo.access_token";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function guardarToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function obtenerToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function limpiarToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

function mensajeDeError(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "object" && item !== null && "msg" in item) {
            return String(item.msg);
          }
          return String(item);
        })
        .join(" · ");
    }
  }
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = obtenerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${path.replace(/^\//, "")}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      "No fue posible conectar con el gateway. Verifica que los servicios estén levantados.",
      0,
    );
  }

  if (response.status === 401 && obtenerToken()) {
    limpiarToken();
    window.dispatchEvent(new Event("nexo:session-expired"));
  }

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    throw new ApiError(
      mensajeDeError(payload, `La solicitud falló (${response.status}).`),
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function servicioSalud(endpoint: string): Promise<{ status: string }> {
  return apiRequest(endpoint);
}
