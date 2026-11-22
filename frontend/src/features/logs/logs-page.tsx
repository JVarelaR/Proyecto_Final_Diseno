/* Consulta de transaccion_logs con filtros y cards. Valida el rango de fechas en el navegador antes de llamar al gateway. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Badge, Button, Col, Form, Row, Spinner } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { api, type FiltrosLog, type RegistroLog } from "../../shared/lib/api";
import { useAuth } from "../../shared/lib/auth-context";
import { mensajeError } from "../../shared/lib/format";
import {
  TIPOS_TRANSACCION,
  filtrosLogSchema,
  filtrosLogVacios,
  type FiltrosLogValues,
} from "../../shared/lib/validation";
import { ServicioPanel } from "../../shared/components/ui/estado-servicio";
import { ListaTarjetas, Tarjeta } from "../../shared/components/ui/lista-tarjetas";
import estilos from "./logs-page.module.css";

const COLORES: Record<string, string> = {
  CREATE: "success",
  READ: "primary",
  UPDATE: "warning",
  DELETE: "danger",
  RAG_QUERY: "info",
};

function formatearFechaHora(valor: string): string {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

/** Los filtros vacíos no se envían al backend (sus parámetros son opcionales). */
function aFiltrosApi(valores: FiltrosLogValues): FiltrosLog {
  return {
    tipo_transaccion: valores.tipo_transaccion || undefined,
    numero_documento: valores.numero_documento.trim() || undefined,
    fecha_desde: valores.fecha_desde || undefined,
    fecha_hasta: valores.fecha_hasta || undefined,
  };
}

function TarjetaLog({ registro }: { registro: RegistroLog }) {
  return (
    <Tarjeta>
      <div className={estilos.encabezadoTarjeta}>
        <div className="d-flex align-items-center gap-2">
          <Badge bg={COLORES[registro.tipo_transaccion] ?? "secondary"}>
            {registro.tipo_transaccion}
          </Badge>
          <span className="small text-muted">#{registro.id.slice(0, 8)}</span>
        </div>
        <time className={estilos.fecha} dateTime={registro.fecha_transaccion}>
          {formatearFechaHora(registro.fecha_transaccion)}
        </time>
      </div>
      <p className="mt-2 mb-0 small">
        <strong>Documento:</strong> {registro.numero_documento || "—"}
      </p>
      <pre className={estilos.detalle} aria-label="Detalle de la transacción">
        {JSON.stringify(registro.detalle, null, 2)}
      </pre>
    </Tarjeta>
  );
}

export function LogsPage() {
  const { token } = useAuth();
  const [filtros, setFiltros] = useState<FiltrosLog>({});
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FiltrosLogValues>({
    resolver: zodResolver(filtrosLogSchema),
    defaultValues: filtrosLogVacios,
    mode: "onSubmit",
  });

  const consulta = useQuery({
    queryKey: ["logs", filtros, token],
    queryFn: () => api.consultarLogs(filtros, token!),
    enabled: Boolean(token),
    staleTime: 15_000,
  });

  const aplicar = handleSubmit((valores) => setFiltros(aFiltrosApi(valores)));
  const limpiar = () => {
    reset(filtrosLogVacios);
    setFiltros({});
  };

  return (
    <ServicioPanel servicio="logs" nombre="Consultar log">
      <div className={estilos.filtros}>
        <Form noValidate onSubmit={aplicar}>
          <Row className="g-3">
            <Col xs={12} md={6} lg={3}>
              <Form.Group controlId="log-tipo">
                <Form.Label className="fw-semibold">Tipo de transacción</Form.Label>
                <Form.Select {...register("tipo_transaccion")}>
                  <option value="">Todos</option>
                  {TIPOS_TRANSACCION.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} md={6} lg={3}>
              <Form.Group controlId="log-documento">
                <Form.Label className="fw-semibold">Nro. documento</Form.Label>
                <Form.Control
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Opcional"
                  isInvalid={!!errors.numero_documento}
                  {...register("numero_documento")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.numero_documento?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12} md={6} lg={2}>
              <Form.Group controlId="log-desde">
                <Form.Label className="fw-semibold">Desde</Form.Label>
                <Form.Control type="date" {...register("fecha_desde")} />
              </Form.Group>
            </Col>
            <Col xs={12} md={6} lg={2}>
              <Form.Group controlId="log-hasta">
                <Form.Label className="fw-semibold">Hasta</Form.Label>
                <Form.Control
                  type="date"
                  isInvalid={!!errors.fecha_hasta}
                  {...register("fecha_hasta")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.fecha_hasta?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12} lg={2} className="d-flex align-items-end gap-2">
              <Button type="submit" variant="primary" className="flex-fill" disabled={consulta.isFetching}>
                Filtrar
              </Button>
              <Button type="button" variant="outline-secondary" onClick={limpiar}>
                Limpiar
              </Button>
            </Col>
          </Row>
        </Form>
      </div>

      <div aria-live="polite" className="mb-2 text-muted small">
        {consulta.isFetching && !consulta.isLoading
          ? "Actualizando resultados…"
          : consulta.data
            ? `${consulta.data.length} transacción(es) registrada(s)`
            : ""}
      </div>

      {consulta.isLoading ? (
        <div className="d-flex align-items-center gap-2 text-muted py-4" role="status">
          <Spinner animation="border" size="sm" />
          Cargando auditoría…
        </div>
      ) : null}

      {consulta.error ? (
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
          No se pudo cargar el log: {mensajeError(consulta.error)}
          <div className="mt-2">
            <Button variant="outline-danger" size="sm" onClick={() => void consulta.refetch()}>
              Reintentar
            </Button>
          </div>
        </Alert>
      ) : null}

      {consulta.data?.length === 0 ? (
        <Alert variant="info">
          No hay transacciones con estos filtros. Prueba con otro documento o rango de fechas.
        </Alert>
      ) : null}

      {consulta.data && consulta.data.length > 0 ? (
        <ListaTarjetas>
          {consulta.data.map((registro) => (
            <TarjetaLog key={registro.id} registro={registro} />
          ))}
        </ListaTarjetas>
      ) : null}
    </ServicioPanel>
  );
}
