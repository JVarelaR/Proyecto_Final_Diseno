/* Hook de health por servicio. Consulta el gateway con un timeout corto para decidir si un panel se muestra o se marca inactivo. */
import { useQuery } from "@tanstack/react-query";
import { verificarServicio, type Servicio } from "./api";

/**
 * Estado de salud de un servicio en el panel que lo usa. Si falla, solo ese
 * panel muestra el aviso de "inactivo"; el resto de la app sigue navegable.
 */
export function useServicio(servicio: Servicio) {
  const consulta = useQuery({
    queryKey: ["servicio", servicio],
    queryFn: () => verificarServicio(servicio),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  return {
    activo: consulta.data === true,
    verificando: consulta.isLoading,
    verificar: consulta.refetch,
  };
}
