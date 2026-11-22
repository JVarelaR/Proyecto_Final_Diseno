/* Formulario de búsqueda por numero_documento compartido por consultar/actualizar/borrar. Evita tres copias de la misma validación Zod. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Spinner } from "react-bootstrap";
import { useForm } from "react-hook-form";
import {
  consultaDocumentoSchema,
  type ConsultaDocumentoValues,
} from "../../shared/lib/validation";
import estilos from "./personas-page.module.css";

/** Formulario de búsqueda por documento, usado por consultar/modificar/borrar. */
export function BuscarDocumentoForm({
  onBuscar,
  buscando,
}: {
  onBuscar: (documento: string) => void;
  buscando: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsultaDocumentoValues>({
    resolver: zodResolver(consultaDocumentoSchema),
    mode: "onChange",
  });

  return (
    <Form
      noValidate
      onSubmit={handleSubmit((valores) => onBuscar(valores.numero_documento))}
      className={estilos.busqueda}
    >
      <div className={estilos.busquedaCampo}>
        <Form.Label htmlFor="buscar-documento" className="visually-hidden">
          Número de documento
        </Form.Label>
        <Form.Control
          id="buscar-documento"
          type="text"
          inputMode="numeric"
          maxLength={10}
          placeholder="Número de documento"
          isInvalid={!!errors.numero_documento}
          {...register("numero_documento")}
        />
        <Form.Control.Feedback type="invalid">
          {errors.numero_documento?.message}
        </Form.Control.Feedback>
      </div>
      <Button type="submit" variant="primary" disabled={buscando}>
        {buscando ? (
          <Spinner animation="border" size="sm" />
        ) : (
          <i className="bi bi-search me-1" aria-hidden="true" />
        )}
        Buscar
      </Button>
    </Form>
  );
}
