/* Modal genérico de confirmación. Se usa para el borrado para que la acción destructiva tenga un paso explícito en la UI. */
import { Alert, Button, Modal, Spinner } from "react-bootstrap";

/** Modal de confirmación reutilizado del patrón de eliminación del backoffice. */
export function ConfirmarModal({
  show,
  titulo,
  mensaje,
  confirmando,
  error,
  onConfirmar,
  onCancelar,
}: {
  show: boolean;
  titulo: string;
  mensaje: string;
  confirmando: boolean;
  error: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal animation={false} show={show} onHide={onCancelar} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5 fw-bold text-danger">
          <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
          {titulo}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <p className="mb-0">{mensaje}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancelar} disabled={confirmando}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirmar} disabled={confirmando}>
          {confirmando ? <Spinner animation="border" size="sm" className="me-2" /> : null}
          Eliminar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
