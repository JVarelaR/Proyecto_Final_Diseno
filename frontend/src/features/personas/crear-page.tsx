/* Alta de personas: orquesta el modal y la mutación. Las reglas de campo viven en Zod y se repiten en el backend. */
import { useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { api, type Persona } from "../../shared/lib/api";
import { useAuth } from "../../shared/lib/auth-context";
import { mensajeError } from "../../shared/lib/format";
import type { PersonaFormValues } from "../../shared/lib/validation";
import { ServicioPanel } from "../../shared/components/ui/estado-servicio";
import { PersonaFormModal } from "../../shared/components/ui/persona-form-modal";
import { Tarjeta } from "../../shared/components/ui/lista-tarjetas";
import estilos from "./personas-page.module.css";

export function CrearPage() {
  const { token } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [creada, setCreada] = useState<Persona | null>(null);

  const guardar = async (valores: PersonaFormValues) => {
    if (!token) return;
    setGuardando(true);
    setError("");
    try {
      setCreada(await api.crearPersona(valores, token));
      setModalAbierto(false);
    } catch (fallo) {
      setError(mensajeError(fallo));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ServicioPanel servicio="create" nombre="Crear personas">
      <div className={estilos.encabezado}>
        <div>
          <h1 className={estilos.titulo}>Crear personas</h1>
          <p className={estilos.descripcion}>
            Los diez campos se validan en el navegador y en el backend antes de guardar.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setError("");
            setModalAbierto(true);
          }}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Nueva persona
        </Button>
      </div>

      {error && !modalAbierto ? (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      ) : null}

      {creada ? (
        <Alert variant="success">
          <i className="bi bi-check-circle me-2" aria-hidden="true" />
          Persona <strong>{creada.numero_documento}</strong> creada y registrada en el log.
        </Alert>
      ) : null}

      {creada ? (
        <Tarjeta>
          <h2 className="h6 fw-bold mb-3">{creada.primer_nombre} {creada.apellidos}</h2>
          <div className={estilos.detalle}>
            <div className={estilos.campo}>
              <span className={estilos.etiqueta}>Documento</span>
              <span className={estilos.valor}>{creada.numero_documento}</span>
            </div>
            <div className={estilos.campo}>
              <span className={estilos.etiqueta}>Correo</span>
              <span className={estilos.valor}>{creada.correo}</span>
            </div>
          </div>
        </Tarjeta>
      ) : null}

      <PersonaFormModal
        show={modalAbierto}
        persona={null}
        esEdicion={false}
        guardando={guardando}
        error={error}
        onClose={() => setModalAbierto(false)}
        onGuardar={(valores) => void guardar(valores)}
      />
    </ServicioPanel>
  );
}
