/* Resumen con un enlace por microservicio. Es la puerta de entrada tras el login y explica la resiliencia por panel. */
import { Link } from "react-router-dom";
import { ListaTarjetas, Tarjeta } from "../../shared/components/ui/lista-tarjetas";

const SERVICIOS = [
  { to: "/crear", icono: "bi-person-plus", titulo: "Crear personas", texto: "Registra una persona y su auditoría." },
  { to: "/actualizar", icono: "bi-pencil-square", titulo: "Modificar datos", texto: "Actualiza los datos de un registro." },
  { to: "/consultar", icono: "bi-search", titulo: "Consultar datos", texto: "Busca por número de documento." },
  { to: "/rag", icono: "bi-chat-dots", titulo: "Lenguaje natural", texto: "Pregunta usando el chat de n8n." },
  { to: "/borrar", icono: "bi-trash3", titulo: "Borrar personas", texto: "Elimina un registro con su log." },
  { to: "/logs", icono: "bi-list-check", titulo: "Consultar log", texto: "Filtra transacciones por tipo, documento y fecha." },
];

/** Página de inicio: un acceso por servicio, igual que el menú de la rúbrica. */
export function DashboardPage() {
  return (
    <>
      <div className="mb-4">
        <h1 className="fw-bold mb-1">Panel de servicios</h1>
        <p className="text-muted mb-0">
          Cada opción corresponde a un microservicio independiente. Si uno no está disponible,
          los demás siguen funcionando.
        </p>
      </div>

      <ListaTarjetas>
        {SERVICIOS.map((servicio) => (
          <Tarjeta key={servicio.to}>
            <Link to={servicio.to} className="text-decoration-none text-reset d-block">
              <i className={`bi ${servicio.icono} fa-2x text-primary`} aria-hidden="true" />
              <h2 className="h6 fw-bold mt-2 mb-1">{servicio.titulo}</h2>
              <p className="text-muted small mb-0">{servicio.texto}</p>
            </Link>
          </Tarjeta>
        ))}
      </ListaTarjetas>
    </>
  );
}
