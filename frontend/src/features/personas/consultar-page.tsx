/* Muestra el resultado exacto de una persona en cards. Usa el hook compartido para que los tres paneles de documento se comporten igual. */
import { Alert } from "react-bootstrap";
import { ServicioPanel } from "../../shared/components/ui/estado-servicio";
import { Tarjeta } from "../../shared/components/ui/lista-tarjetas";
import { formatearFecha } from "../../shared/lib/format";
import { BuscarDocumentoForm } from "./buscar-documento-form";
import { useConsultaPersona } from "./use-consulta-persona";
import estilos from "./personas-page.module.css";

export function ConsultarPage() {
  const { persona, error, buscando, buscar } = useConsultaPersona();

  return (
    <ServicioPanel servicio="query" nombre="Consultar datos">
      <div className={estilos.encabezado}>
        <div>
          <h1 className={estilos.titulo}>Consultar datos personales</h1>
          <p className={estilos.descripcion}>La llave de búsqueda es el número de documento.</p>
        </div>
      </div>

      <BuscarDocumentoForm onBuscar={(documento) => void buscar(documento)} buscando={buscando} />

      {error ? (
        <Alert variant="danger" className="mt-3">
          <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
          {error}
        </Alert>
      ) : null}

      {persona ? (
        <Tarjeta className="mt-3">
          <div className="d-flex gap-3 align-items-start">
            {persona.foto_url ? (
              <img
                className={estilos.foto}
                src={`/uploads/${persona.foto_url.split("/").pop()}`}
                alt={`Foto de ${persona.primer_nombre} ${persona.apellidos}`}
              />
            ) : null}
            <div>
              <h2 className="h5 fw-bold mb-1">
                {persona.primer_nombre} {persona.segundo_nombre ?? ""} {persona.apellidos}
              </h2>
              <div className={estilos.detalle}>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Documento</span>
                  <span className={estilos.valor}>{persona.numero_documento}</span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Nacimiento</span>
                  <span className={estilos.valor}>{formatearFecha(persona.fecha_nacimiento)}</span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Correo</span>
                  <span className={estilos.valor}>{persona.correo}</span>
                </div>
                <div className={estilos.campo}>
                  <span className={estilos.etiqueta}>Celular</span>
                  <span className={estilos.valor}>{persona.celular}</span>
                </div>
              </div>
            </div>
          </div>
        </Tarjeta>
      ) : null}
    </ServicioPanel>
  );
}
