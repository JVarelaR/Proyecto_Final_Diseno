
import { useState, type FormEvent } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";

import { api, ApiError } from "../../shared/lib/api";
import { useAuth } from "../../shared/lib/auth-context";
import { ServicioPanel } from "../../shared/components/ui/estado-servicio";
import { Tarjeta } from "../../shared/components/ui/lista-tarjetas";

import estilos from "./rag-page.module.css";

const PREGUNTA_OFICIAL =
  "¿Cuál es el empleado más joven que se ha registrado?";

type Mensaje = {
  id: string;
  rol: "usuario" | "asistente";
  contenido: string;
};

export function RagPage() {
  const { token } = useAuth();

  const [pregunta, setPregunta] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviarPregunta = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const texto = pregunta.trim();

    if (!texto || cargando) return;

    if (!token) {
      setError("Debes iniciar sesión para utilizar el chatbot.");
      return;
    }

    if (texto.length > 1000) {
      setError("La pregunta no puede superar los 1000 caracteres.");
      return;
    }

    setError(null);
    setCargando(true);
    setPregunta("");

    const mensajeUsuario: Mensaje = {
      id: crypto.randomUUID(),
      rol: "usuario",
      contenido: texto,
    };

    setMensajes((anteriores) => [
      ...anteriores,
      mensajeUsuario,
    ]);

    try {
      const resultado = await api.consultarRag(
        texto,
        token,
        sessionId
      );

      setSessionId(resultado.session_id);

      const mensajeAsistente: Mensaje = {
        id: crypto.randomUUID(),
        rol: "asistente",
        contenido: resultado.respuesta,
      };

      setMensajes((anteriores) => [
        ...anteriores,
        mensajeAsistente,
      ]);
    } catch (err) {
      const mensaje =
        err instanceof ApiError
          ? err.message
          : "No fue posible procesar la consulta.";

      setError(mensaje);
    } finally {
      setCargando(false);
    }
  };

  const nuevaConversacion = () => {
    if (cargando) return;

    setMensajes([]);
    setSessionId(undefined);
    setPregunta("");
    setError(null);
  };

  return (
    <ServicioPanel
      servicio="rag"
      nombre="Consulta en lenguaje natural"
    >
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div>
          <h1 className="fw-bold mb-1">
            Consulta en lenguaje natural
          </h1>

          <p className="text-muted mb-0">
            Consulta los registros mediante inteligencia artificial,
            búsqueda vectorial y Ollama.
          </p>
        </div>

        <Button
          variant="outline-secondary"
          onClick={nuevaConversacion}
          disabled={cargando}
        >
          <i
            className="bi bi-arrow-clockwise me-2"
            aria-hidden="true"
          />
          Nueva conversación
        </Button>
      </div>

      <Tarjeta>
        <div className="d-flex align-items-center gap-2 mb-3">
          <i
            className="bi bi-chat-dots-fill text-primary fs-4"
            aria-hidden="true"
          />

          <div>
            <h2 className="h5 fw-bold mb-0">
              Asistente RAG
            </h2>

            <small className="text-muted">
              Conectado mediante ms-rag y n8n
            </small>
          </div>
        </div>

        {/* Historial de conversación */}
        <div
          className="border rounded-3 bg-body-tertiary p-3 mb-3 overflow-auto"
          style={{ minHeight: 340, maxHeight: 480 }}
          role="log"
          aria-label="Mensajes de la conversación"
          aria-live="polite"
        >
          {mensajes.length === 0 && (
            <div className="text-center py-5">
              <i
                className="bi bi-robot display-4 text-primary"
                aria-hidden="true"
              />

              <h3 className="h5 mt-3">
                ¡Bienvenido al asistente!
              </h3>

              <p className="text-muted mb-3">
                Puedes consultar información sobre los registros
                disponibles en el sistema.
              </p>

              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => setPregunta(PREGUNTA_OFICIAL)}
              >
                Usar pregunta de ejemplo
              </Button>
            </div>
          )}

          {mensajes.map((mensaje) => (
            <div
              key={mensaje.id}
              className={`d-flex mb-3 ${
                mensaje.rol === "usuario"
                  ? "justify-content-end"
                  : "justify-content-start"
              }`}
            >
              <div
                className={`rounded-3 px-3 py-2 ${
                  mensaje.rol === "usuario"
                    ? "bg-primary text-white"
                    : "bg-body border"
                }`}
                style={{
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                <div className="small fw-bold mb-1">
                  {mensaje.rol === "usuario"
                    ? "Tú"
                    : "Asistente RAG"}
                </div>

                <div>{mensaje.contenido}</div>
              </div>
            </div>
          ))}

          {cargando && (
            <div
              className="d-flex align-items-center gap-2 text-muted"
              role="status"
            >
              <Spinner animation="border" size="sm" />
              Ollama está preparando una respuesta...
            </div>
          )}
        </div>

        {/* Mensajes de error */}
        {error && (
          <Alert
            variant="danger"
            dismissible
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Formulario del chatbot */}
        <Form onSubmit={(event) => void enviarPregunta(event)}>
          <Form.Group className="mb-3">
            <Form.Label htmlFor="pregunta-rag">
              Escribe tu pregunta
            </Form.Label>

            <Form.Control
              id="pregunta-rag"
              as="textarea"
              rows={2}
              maxLength={1000}
              placeholder="Ejemplo: ¿Cuántas personas hay registradas?"
              value={pregunta}
              onChange={(event) => setPregunta(event.target.value)}
              disabled={cargando || !token}
            />
          </Form.Group>

          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              {pregunta.length}/1000 caracteres
            </small>

            <Button
              type="submit"
              variant="primary"
              disabled={!pregunta.trim() || cargando || !token}
            >
              {cargando ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Consultando...
                </>
              ) : (
                <>
                  <i
                    className="bi bi-send me-2"
                    aria-hidden="true"
                  />
                  Enviar pregunta
                </>
              )}
            </Button>
          </div>
        </Form>
      </Tarjeta>

      {/* Información del funcionamiento */}
      <Tarjeta>
        <h3 className="h6 fw-bold mb-3">
          ¿Cómo funciona el asistente?
        </h3>

        <ol className={estilos.pasos}>
          <li>
            El usuario envía una pregunta autenticada a ms-rag.
          </li>
          <li>
            n8n convierte la pregunta en un embedding con Ollama.
          </li>
          <li>
            PostgreSQL y pgvector recuperan registros similares.
          </li>
          <li>
            Ollama genera una respuesta utilizando el contexto.
          </li>
          <li>
            Se registra la consulta como RAG_QUERY.
          </li>
        </ol>
      </Tarjeta>

      <Alert variant="info" className="mt-3">
        <i
          className="bi bi-info-circle me-2"
          aria-hidden="true"
        />
        Las respuestas se generan con inteligencia artificial y
        deben verificarse cuando se utilicen para tomar decisiones.
        El historial mostrado se mantiene únicamente en esta vista.
      </Alert>
    </ServicioPanel>
  );
}
