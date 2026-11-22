/* Sesión JWT de la SPA. Aísla el storage y el evento de expiración para que todas las pantallas compartan el mismo estado de autenticación. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type Usuario } from "./api";

const CLAVE_SESION = "gd_sesion";

type DatosSesion = { token: string; usuario: Usuario };

type AuthContextValue = {
  token: string | null;
  usuario: Usuario | null;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function leerSesion(): DatosSesion | null {
  try {
    const guardado = window.sessionStorage.getItem(CLAVE_SESION);
    return guardado ? (JSON.parse(guardado) as DatosSesion) : null;
  } catch {
    return null;
  }
}

/**
 * Guarda el JWT de ROBLE en `sessionStorage` (no en localStorage) y lo expone
 * a toda la SPA. Cada petición al gateway lo enviará como `Authorization: Bearer`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<DatosSesion | null>(leerSesion);

  // SEGURIDAD: `api.ts` avisa cuando un endpoint responde 401; cerramos la sesión
  // aunque el token haya vencido mientras el usuario estaba navegando.
  useEffect(() => {
    const cerrarPor401 = () => {
      window.sessionStorage.removeItem(CLAVE_SESION);
      setSesion(null);
    };
    window.addEventListener("gd:unauthorized", cerrarPor401);
    return () => window.removeEventListener("gd:unauthorized", cerrarPor401);
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const respuesta = await api.login(email, password);
    const nueva: DatosSesion = { token: respuesta.access_token, usuario: respuesta.user };
    window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(nueva));
    setSesion(nueva);
  }, []);

  const cerrarSesion = useCallback(async () => {
    if (sesion) {
      try {
        await api.logout(sesion.token);
      } catch {
        // Cerrar la sesión local nunca debe fallar aunque ms-auth esté caído.
      }
    }
    window.sessionStorage.removeItem(CLAVE_SESION);
    setSesion(null);
  }, [sesion]);

  const valor = useMemo<AuthContextValue>(
    () => ({
      token: sesion?.token ?? null,
      usuario: sesion?.usuario ?? null,
      iniciarSesion,
      cerrarSesion,
    }),
    [sesion, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return contexto;
}
