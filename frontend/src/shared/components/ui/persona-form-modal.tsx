/* Modal de alta/edición de personas. Conserva el patrón del backoffice de origen y mantiene aquí los diez campos del enunciado para que Zod valide antes de enviar el FormData al gateway. */
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { useForm } from "react-hook-form";
import type { Persona } from "../../lib/api";
import {
  GENEROS,
  MESES_ES,
  TIPOS_DOCUMENTO,
  personaSchema,
  valoresVacios,
  type PersonaFormValues,
} from "../../lib/validation";
import styles from "./persona-form-modal.module.css";

/** Convierte `dd-mmm-yyyy` a ISO para el input type="date" del calendario. */
function aISO(valor: string): string {
  const partes = valor.trim().split("-");
  if (partes.length === 3) {
    const mes = MESES_ES[partes[1]!.trim().toLowerCase()];
    if (mes) {
      return `${partes[2]!.padStart(4, "0")}-${String(mes).padStart(2, "0")}-${partes[0]!.padStart(2, "0")}`;
    }
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(valor.trim()) ? valor.trim() : "";
}

type Props = {
  show: boolean;
  persona: Persona | null;
  esEdicion: boolean;
  guardando: boolean;
  error: string;
  onClose: () => void;
  onGuardar: (valores: PersonaFormValues) => void;
};

/**
 * Modal de alta/edición portado del patrón de `producto-form-modal` de
 * Confitería la 7. Los campos son exactamente los del enunciado y las reglas
 * viven en Zod, replicando `backend/shared/schemas.py`.
 */
export function PersonaFormModal({
  show,
  persona,
  esEdicion,
  guardando,
  error,
  onClose,
  onGuardar,
}: Props) {
  const [usarCalendario, setUsarCalendario] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PersonaFormValues>({
    resolver: zodResolver(personaSchema),
    mode: "onChange",
    defaultValues: valoresVacios,
  });
  const foto = watch("foto") as File | undefined;

  useEffect(() => {
    if (!show) return;
    const valores: PersonaFormValues = persona
      ? {
          tipo_documento: persona.tipo_documento,
          numero_documento: persona.numero_documento,
          primer_nombre: persona.primer_nombre,
          segundo_nombre: persona.segundo_nombre ?? "",
          apellidos: persona.apellidos,
          fecha_nacimiento: persona.fecha_nacimiento ?? "",
          genero: persona.genero,
          correo: persona.correo,
          celular: persona.celular,
          foto: undefined,
        }
      : valoresVacios;
    setUsarCalendario(false);
    reset(valores);
  }, [show, persona, reset]);

  return (
    <Modal animation={false} show={show} onHide={onClose} size="lg" scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5 fw-bold">
          {esEdicion ? `Editar: ${persona?.primer_nombre ?? ""}` : "Nueva persona"}
        </Modal.Title>
      </Modal.Header>

      <Form noValidate onSubmit={handleSubmit(onGuardar)} className={styles.form}>
        <Modal.Body>
          {error ? (
            <Alert variant="danger">
              <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
              {error}
            </Alert>
          ) : null}

          <Row className="g-3">
            <Col xs={12} md={6}>
              <Form.Group controlId="pf-tipo-documento">
                <Form.Label className="fw-semibold">Tipo de documento *</Form.Label>
                <Form.Select {...register("tipo_documento")} isInvalid={!!errors.tipo_documento}>
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.tipo_documento?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="pf-numero-documento">
                <Form.Label className="fw-semibold">Nro. Documento *</Form.Label>
                <Form.Control
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Ej: 100200300"
                  isInvalid={!!errors.numero_documento}
                  readOnly={esEdicion}
                  aria-readonly={esEdicion}
                  {...register("numero_documento")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.numero_documento?.message}
                </Form.Control.Feedback>
                {esEdicion ? (
                  <Form.Text className="text-muted">La llave de búsqueda no se puede cambiar.</Form.Text>
                ) : null}
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="pf-primer-nombre">
                <Form.Label className="fw-semibold">Primer nombre *</Form.Label>
                <Form.Control
                  type="text"
                  maxLength={30}
                  isInvalid={!!errors.primer_nombre}
                  {...register("primer_nombre")}
                />
                <Form.Control.Feedback type="invalid">{errors.primer_nombre?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="pf-segundo-nombre">
                <Form.Label className="fw-semibold">Segundo nombre</Form.Label>
                <Form.Control
                  type="text"
                  maxLength={30}
                  isInvalid={!!errors.segundo_nombre}
                  {...register("segundo_nombre")}
                />
                <Form.Control.Feedback type="invalid">{errors.segundo_nombre?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="pf-apellidos">
                <Form.Label className="fw-semibold">Apellidos *</Form.Label>
                <Form.Control
                  type="text"
                  maxLength={60}
                  isInvalid={!!errors.apellidos}
                  {...register("apellidos")}
                />
                <Form.Control.Feedback type="invalid">{errors.apellidos?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12} md={7}>
              <Form.Group controlId="pf-fecha-nacimiento">
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label className="fw-semibold mb-1">Fecha de nacimiento *</Form.Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className={styles.cambiarFecha}
                    onClick={() => {
                      const actual = watch("fecha_nacimiento") ?? "";
                      setValue("fecha_nacimiento", usarCalendario ? actual : aISO(actual), {
                        shouldValidate: true,
                      });
                      setUsarCalendario(!usarCalendario);
                    }}
                  >
                    {usarCalendario ? "Escribir fecha" : "Usar calendario"}
                  </Button>
                </div>
                {usarCalendario ? (
                  <Form.Control
                    type="date"
                    isInvalid={!!errors.fecha_nacimiento}
                    {...register("fecha_nacimiento")}
                  />
                ) : (
                  <Form.Control
                    type="text"
                    placeholder="dd-mmm-yyyy (ej: 20-mar-2005)"
                    isInvalid={!!errors.fecha_nacimiento}
                    {...register("fecha_nacimiento")}
                  />
                )}
                <Form.Control.Feedback type="invalid">
                  {errors.fecha_nacimiento?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12} md={5}>
              <Form.Group controlId="pf-genero">
                <Form.Label className="fw-semibold">Género *</Form.Label>
                <Form.Select {...register("genero")} isInvalid={!!errors.genero}>
                  {GENEROS.map((genero) => (
                    <option key={genero} value={genero}>{genero}</option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.genero?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="pf-correo">
                <Form.Label className="fw-semibold">Correo electrónico *</Form.Label>
                <Form.Control
                  type="email"
                  isInvalid={!!errors.correo}
                  {...register("correo")}
                />
                <Form.Control.Feedback type="invalid">{errors.correo?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12} md={6}>
              <Form.Group controlId="pf-celular">
                <Form.Label className="fw-semibold">Celular *</Form.Label>
                <Form.Control
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10 dígitos"
                  isInvalid={!!errors.celular}
                  {...register("celular")}
                />
                <Form.Control.Feedback type="invalid">{errors.celular?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="pf-foto">
                <Form.Label className="fw-semibold">Foto (opcional, máx. 2 MB)</Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  isInvalid={!!errors.foto}
                  onChange={(evento) => {
                    const archivo = (evento.target as HTMLInputElement).files?.[0];
                    setValue("foto", archivo, { shouldValidate: true });
                  }}
                />
                <Form.Control.Feedback type="invalid">{errors.foto?.message as string}</Form.Control.Feedback>
                {foto ? <Form.Text className="text-muted">{foto.name}</Form.Text> : null}
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={guardando}>
            {guardando ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Guardando…
              </>
            ) : esEdicion ? (
              "Guardar cambios"
            ) : (
              "Crear persona"
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
