export type TipoDocumento = "Tarjeta de identidad" | "Cédula";

export type Genero =
  | "Masculino"
  | "Femenino"
  | "No binario"
  | "Prefiero no reportar";

export type TipoTransaccion =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "RAG_QUERY";

export interface Usuario {
  user_id: string;
  email: string;
  name: string;
}

export interface Persona {
  tipo_documento: TipoDocumento;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  apellidos: string;
  fecha_nacimiento: string;
  genero: Genero;
  correo: string;
  celular: string;
  foto_url: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

export interface RegistroLog {
  id: string;
  tipo_transaccion: TipoTransaccion;
  numero_documento: string | null;
  detalle: Record<string, unknown>;
  fecha_transaccion: string;
}

export interface EstadoServicio {
  nombre: string;
  endpoint: string;
  disponible: boolean;
}
