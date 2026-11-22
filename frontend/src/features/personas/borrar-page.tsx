/* Flujo de borrado con confirmación. La llave de búsqueda es el documento y la acción destructiva siempre pasa por un modal explícito. */
import { useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { api } from "../../shared/lib/api";
import { useAuth } from "../../shared/lib/auth-context";
import { formatearFecha, mensajeError } from "../../shared/lib/format";
import { ServicioPanel } from "../../shared/components/ui/estado-servicio";
import { ConfirmarModal } from "../../shared/components/ui/confirmar-modal";
import { Tarjeta } from "../../shared/components/ui/lista-tarjetas";
import { BuscarDocumentoForm } from "./buscar-documento-form";
import { useConsultaPersona } from "./use-consulta-persona";
import estilos from "./personas-page.module.css";

export function BorrarPage() {
  const { token } = useAuth();
  const consulta = useConsultaPersona();
  const [confirmando, setConfirmando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState("");
  const [borrado, setBorrado] = useState("");

  const borrar = async () => {
    const persona = consulta.persona;
    if (!token || !persona) return;
    setConfirmando(true);
    setErrorBorrado("");
    try {
      await api.borrarPersona(persona.numero_documento, token);
      setBorrado(
        `${persona.primer_nombre} ${persona.apellidos} (${persona.numero_documento})`,
      );
      setModalAbierto(false);
      consulta.limpiar();
    } catch (fallo) {
      setErrorBorrado(mensajeError(fallo));
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <ServicioPanel servicio="delete" nombre="Borrar personas">
      <div className={estilos.encabezado}>
        <div>
          <h1 className={estilos.titulo}>Borrar personas</h1>
          <p className={estilos.descripcion}>
            El borrado se audita antes de eliminar el registro y no se puede deshacer.
          </p>
        </div>
      </div>

      <BuscarDocumentoForm
        onBuscar={(documento) => {
          setBorrado("");
          setErrorBorrado("");
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

      {errorBorrado && !modalAbierto ? (
        <Alert variant="danger" className="mt-3" onClose={() => setErrorBorrado("")} dismissible>
          {errorBorrado}
        </Alert>
      ) : null}

      {borrado ? (
        <Alert variant="success" className="mt-3">
          <i className="bi bi-check-circle me-2" aria-hidden="true" />
          Persona eliminada y registrada en el log: <strong>{borrado}</strong>.
        </Alert>
      ) : null}

      {consulta.persona ? (
        <Tarjeta className="mt-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h2 className="h5 fw-bold mb-1">
                {consulta.persona.primer_nombre} {consulta.persona.segundo_nombre ?? ""}{" "}
                {consulta.persona.apellidos}
              </h2>
              <div className={estilos.detalle}>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Documento</span>
                  <span className={estilos.valor}>{consulta.persona.numero_documento}</span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Nacimiento</span>
                  <span className={estilos.valor}>
                    {formatearFecha(consulta.persona.fecha_nacimiento)}
                  </span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Correo</span>
                  <span className={estilos.valor}>{consulta.persona.correo}</span>
                </div>
              </div>
            </div>
            <Button
              variant="outline-danger"
              onClick={() => {
                setErrorBorrado("");
                setModalAbierto(true);
              }}
            >
              <i className="bi bi-trash3 me-1" aria-hidden="true" />
              Borrar persona
            </Button>
          </div>
        </Tarjeta>
      ) : null}

      <ConfirmarModal
        show={modalAbierto}
        titulo="Confirmar borrado"
        mensaje={`¿Eliminar a ${consulta.persona?.primer_nombre ?? ""} ${
          consulta.persona?.apellidos ?? ""
        } con documento ${consulta.persona?.numero_documento ?? ""}? Esta acción no se puede deshacer.`}
        confirmando={confirmando}
        error={errorBorrado}
        onConfirmar={() => void borrar()}
        onCancelar={() => setModalAbierto(false)}
      />
    </ServicioPanel>
  );
}
