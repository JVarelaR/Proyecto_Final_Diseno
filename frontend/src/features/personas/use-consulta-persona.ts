/* Hook de búsqueda exacta por documento. Unifica carga, error y estado no encontrado para los tres paneles que consultan personas. */
import { useCallback, useState } from "react";
import { api, type Persona } from "../../shared/lib/api";
import { useAuth } from "../../shared/lib/auth-context";
import { mensajeError } from "../../shared/lib/format";

/**
 * Búsqueda exacta por `numero_documento`, compartida por los paneles de
 * consultar, modificar y borrar. Cada búsqueda se audita en el backend (READ).
 */
export function useConsultaPersona() {
  const { token } = useAuth();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [error, setError] = useState("");
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(
    async (numeroDocumento: string) => {
      if (!token) return;
      setBuscando(true);
      setError("");
      setPersona(null);
      try {
        setPersona(await api.consultarPersona(numeroDocumento, token));
      } catch (fallo) {
        setError(mensajeError(fallo));
      } finally {
        setBuscando(false);
      }
    },
    [token],
  );

  const limpiar = useCallback(() => {
    setPersona(null);
    setError("");
  }, []);

  return { persona, error, buscando, buscar, limpiar };
}
