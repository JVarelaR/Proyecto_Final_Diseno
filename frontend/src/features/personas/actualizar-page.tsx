/* Flujo de edición: buscar por documento, cargar el modal y enviar FormData. Separa la búsqueda de la mutación para reutilizar el hook común. */
import { useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { api, type Persona } from "../../shared/lib/api";
import { useAuth } from "../../shared/lib/auth-context";
import { formatearFecha, mensajeError } from "../../shared/lib/format";
import type { PersonaFormValues } from "../../shared/lib/validation";
import { ServicioPanel } from "../../shared/components/ui/estado-servicio";
import { PersonaFormModal } from "../../shared/components/ui/persona-form-modal";
import { Tarjeta } from "../../shared/components/ui/lista-tarjetas";
import { BuscarDocumentoForm } from "./buscar-documento-form";
import { useConsultaPersona } from "./use-consulta-persona";
import estilos from "./personas-page.module.css";

export function ActualizarPage() {
  const { token } = useAuth();
  const consulta = useConsultaPersona();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");
  const [actualizada, setActualizada] = useState<Persona | null>(null);

  const guardar = async (valores: PersonaFormValues) => {
    const persona = consulta.persona;
    if (!token || !persona) return;
    setGuardando(true);
    setErrorGuardado("");
    try {
      setActualizada(await api.actualizarPersona(persona.numero_documento, valores, token));
      setModalAbierto(false);
    } catch (fallo) {
      setErrorGuardado(mensajeError(fallo));
    } finally {
      setGuardando(false);
    }
  };

  const personaMostrada = actualizada ?? consulta.persona;

  return (
    <ServicioPanel servicio="update" nombre="Modificar datos personales">
      <div className={estilos.encabezado}>
        <div>
          <h1 className={estilos.titulo}>Modificar datos personales</h1>
          <p className={estilos.descripcion}>
            Busca por documento, ajusta los campos y guarda: el cambio queda registrado en el log.
          </p>
        </div>
      </div>

      <BuscarDocumentoForm
        onBuscar={(documento) => {
          setActualizada(null);
          setErrorGuardado("");
          void consulta.buscar(documento);
        }}
        buscando={consulta.buscando}
      />

      {consulta.error ? (
        <Alert variant="danger" className="mt-3">
          <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
          {consulta.error}
        </Alert>
      ) : null}

      {errorGuardado && !modalAbierto ? (
        <Alert variant="danger" className="mt-3" onClose={() => setErrorGuardado("")} dismissible>
          {errorGuardado}
        </Alert>
      ) : null}

      {personaMostrada ? (
        <Tarjeta className="mt-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h2 className="h5 fw-bold mb-1">
                {personaMostrada.primer_nombre} {personaMostrada.segundo_nombre ?? ""}{" "}
                {personaMostrada.apellidos}
              </h2>
              <div className={estilos.detalle}>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Documento</span>
                  <span className={estilos.valor}>{personaMostrada.numero_documento}</span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Nacimiento</span>
                  <span className={estilos.valor}>{formatearFecha(personaMostrada.fecha_nacimiento)}</span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Correo</span>
                  <span className={estilos.valor}>{personaMostrada.correo}</span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Celular</span>
                  <span className={estilos.valor}>{personaMostrada.celular}</span>
                </div>
              </div>
            </div>
            <Button variant="primary" onClick={() => setModalAbierto(true)}>
              <i className="bi bi-pencil me-1" aria-hidden="true" />
              Editar datos
            </Button>
          </div>
          {actualizada ? (
            <Alert variant="success" className="mt-3 mb-0">
              <i className="bi bi-check-circle me-2" aria-hidden="true" />
              Cambios guardados y registrados en el log.
            </Alert>
          ) : null}
        </Tarjeta>
      ) : null}

      <PersonaFormModal
        show={modalAbierto}
        persona={consulta.persona}
        esEdicion
        guardando={guardando}
        error={errorGuardado}
        onClose={() => setModalAbierto(false)}
        onGuardar={(valores) => void guardar(valores)}
      />
    </ServicioPanel>
  );
}
