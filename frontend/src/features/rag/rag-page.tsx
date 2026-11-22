/* Panel de RAG: no implementa el chat, abre el webhook real de n8n, donde se ven pregunta/respuesta y se registra RAG_QUERY. */
import { useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { N8N_CHAT_URL } from "../../shared/lib/api";
import { ServicioPanel } from "../../shared/components/ui/estado-servicio";
import { Tarjeta } from "../../shared/components/ui/lista-tarjetas";
import estilos from "./rag-page.module.css";

const PREGUNTA_OFICIAL = "¿Cuál es el empleado más joven que se ha registrado?";

/** El chat se abre en n8n: la rúbrica exige que pregunta y respuesta se vean allí. */
export function RagPage() {
  const [copiado, setCopiado] = useState("");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(PREGUNTA_OFICIAL);
      setCopiado("Pregunta copiada al portapapeles.");
    } catch {
      setCopiado("Selecciona y copia la pregunta manualmente.");
    }
  };

  return (
    <ServicioPanel servicio="rag" nombre="Consulta en lenguaje natural">
      <h1 className="fw-bold mb-1">Consulta en lenguaje natural</h1>
      <p className="text-muted mb-4">
        El chat de preguntas y respuestas vive en n8n, donde también se registra cada
        <code className="mx-1">RAG_QUERY</code> en el log de auditoría.
      </p>

      <Tarjeta>
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
          <div>
            <h2 className="h5 fw-bold mb-1">Abrir chat RAG</h2>
            <p className="text-muted small mb-0">
              Se abre en una pestaña nueva. Si el gateway pide credenciales, usa las de n8n.
            </p>
          </div>
          <a
            className="btn btn-primary"
            href={N8N_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="bi bi-box-arrow-up-right me-2" aria-hidden="true" />
            Abrir chat en n8n
          </a>
        </div>

        <div className={estilos.pregunta}>
          <p className={estilos.preguntaTexto}>{PREGUNTA_OFICIAL}</p>
          <Button variant="outline-primary" size="sm" onClick={() => void copiar()}>
            <i className="bi bi-clipboard me-1" aria-hidden="true" />
            Copiar pregunta
          </Button>
        </div>
        <div aria-live="polite" className="small text-muted mt-2">
          {copiado}
        </div>

        <hr className="my-3" />
        <h3 className="h6 fw-bold">Qué ocurre detrás</h3>
        <ol className={estilos.pasos}>
          <li>La pregunta se convierte en un embedding con Ollama.</li>
          <li>Se buscan los registros similares en pgvector.</li>
          <li>El modelo responde en español usando solo ese contexto.</li>
          <li>La pregunta y la respuesta se guardan como <code>RAG_QUERY</code>.</li>
        </ol>
      </Tarjeta>

      <Alert variant="light" className="border mt-3 mb-0">
        <i className="bi bi-info-circle me-2" aria-hidden="true" />
        Si el contenedor de n8n está detenido, este panel muestra «servicio inactivo»; los
        demás servicios del menú siguen disponibles.
      </Alert>
    </ServicioPanel>
  );
}
