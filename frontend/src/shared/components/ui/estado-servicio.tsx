/* Envoltorio de resiliencia visual por panel. Verifica la salud del servicio y sustituye solo ese panel cuando está caído. */
import { Alert, Button, Spinner } from "react-bootstrap";
import type { ReactNode } from "react";
import type { Servicio } from "../../lib/api";
import { useServicio } from "../../lib/use-servicio";

/**
 * Envuelve el contenido de un panel con su estado de salud.
 * Si el microservicio está apagado se muestra este aviso y NO se llama a sus
 * endpoints; los demás paneles siguen funcionando con normalidad.
 */
export function ServicioPanel({
  servicio,
  nombre,
  children,
}: {
  servicio: Servicio;
  nombre: string;
  children: ReactNode;
}) {
  const { activo, verificando, verificar } = useServicio(servicio);

  if (verificando) {
    return (
      <div className="d-flex align-items-center gap-2 text-muted py-4" role="status">
        <Spinner animation="border" size="sm" />
        Verificando el servicio {nombre}…
      </div>
    );
  }

  if (!activo) {
    return (
      <Alert variant="warning" className="shadow-sm">
        <Alert.Heading>
          <i className="bi bi-wifi-off me-2" aria-hidden="true" />
          {nombre}: servicio inactivo
        </Alert.Heading>
        <p className="mb-3">
          Este servicio no está disponible en este momento. Los demás servicios siguen
          funcionando; puedes intentarlo de nuevo cuando vuelva a estar activo.
        </p>
        <Button variant="outline-primary" size="sm" onClick={() => void verificar()}>
          <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
          Reintentar
        </Button>
      </Alert>
    );
  }

  return <>{children}</>;
}
