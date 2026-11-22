/* Tipos de Vite para TypeScript. Sin esta referencia, import.meta.env no se reconoce y las variables VITE_* del build quedarían fuera del tipado. */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_N8N_CHAT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
