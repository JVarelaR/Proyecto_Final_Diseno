import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, ImagePlus, Save, UserRoundPlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { personaSchema, type PersonaFormValues } from "../lib/schemas";
import type { Persona } from "../types";

interface PersonEditorProps {
  mode: "create" | "update";
  person?: Persona;
  pending: boolean;
  onSave: (values: PersonaFormValues) => Promise<void>;
  onCancel?: () => void;
}

const EMPTY_PERSON: PersonaFormValues = {
  tipo_documento: "Cédula",
  numero_documento: "",
  primer_nombre: "",
  segundo_nombre: "",
  apellidos: "",
  fecha_nacimiento: "",
  genero: "Prefiero no reportar",
  correo: "",
  celular: "",
  foto: undefined,
};

function valorInicial(person?: Persona): PersonaFormValues {
  if (!person) return EMPTY_PERSON;
  return {
    tipo_documento: person.tipo_documento,
    numero_documento: person.numero_documento,
    primer_nombre: person.primer_nombre,
    segundo_nombre: person.segundo_nombre ?? "",
    apellidos: person.apellidos,
    fecha_nacimiento: person.fecha_nacimiento.slice(0, 10),
    genero: person.genero,
    correo: person.correo,
    celular: person.celular,
    foto: undefined,
  };
}

export default function PersonEditor({
  mode,
  person,
  pending,
  onSave,
  onCancel,
}: PersonEditorProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, isDirty },
  } = useForm<PersonaFormValues>({
    resolver: zodResolver(personaSchema),
    mode: "onChange",
    defaultValues: valorInicial(person),
  });

  useEffect(() => {
    reset(valorInicial(person));
  }, [person, reset]);

  const numeroDocumento = watch("numero_documento");
  const fotoSeleccionada = watch("foto");

  return (
    <form className="person-form" onSubmit={handleSubmit(onSave)} noValidate>
      <div className="form-section">
        <div className="form-section__title">
          <span className="form-section__number">01</span>
          <div><h3>Identificación</h3><p>El documento identifica de forma única a cada persona.</p></div>
        </div>
        <div className="form-grid form-grid--two">
          <label className="field">
            <span>Tipo de documento <b>*</b></span>
            <select {...register("tipo_documento")}>
              <option value="Cédula">Cédula</option>
              <option value="Tarjeta de identidad">Tarjeta de identidad</option>
            </select>
            {errors.tipo_documento && <small className="field-error">{errors.tipo_documento.message}</small>}
          </label>
          <label className="field">
            <span>Número de documento <b>*</b></span>
            <input
              inputMode="numeric"
              placeholder="Hasta 10 dígitos"
              readOnly={mode === "update"}
              className={mode === "update" ? "input-readonly" : ""}
              {...register("numero_documento")}
            />
            {mode === "update" && <small className="field-hint">La llave de búsqueda no se puede modificar.</small>}
            {errors.numero_documento && <small className="field-error">{errors.numero_documento.message}</small>}
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__title">
          <span className="form-section__number">02</span>
          <div><h3>Información personal</h3><p>Registra los datos tal como aparecen en el documento.</p></div>
        </div>
        <div className="form-grid form-grid--three">
          <label className="field">
            <span>Primer nombre <b>*</b></span>
            <input maxLength={30} placeholder="Ej. María" {...register("primer_nombre")} />
            {errors.primer_nombre && <small className="field-error">{errors.primer_nombre.message}</small>}
          </label>
          <label className="field">
            <span>Segundo nombre</span>
            <input maxLength={30} placeholder="Opcional" {...register("segundo_nombre")} />
            {errors.segundo_nombre && <small className="field-error">{errors.segundo_nombre.message}</small>}
          </label>
          <label className="field">
            <span>Apellidos <b>*</b></span>
            <input maxLength={60} placeholder="Ej. García López" {...register("apellidos")} />
            {errors.apellidos && <small className="field-error">{errors.apellidos.message}</small>}
          </label>
          <label className="field">
            <span>Fecha de nacimiento <b>*</b></span>
            <input type="date" {...register("fecha_nacimiento")} />
            <small className="field-hint">Selecciona la fecha en el calendario.</small>
            {errors.fecha_nacimiento && <small className="field-error">{errors.fecha_nacimiento.message}</small>}
          </label>
          <label className="field">
            <span>Género <b>*</b></span>
            <select {...register("genero")}>
              <option value="Prefiero no reportar">Prefiero no reportar</option>
              <option value="Femenino">Femenino</option>
              <option value="Masculino">Masculino</option>
              <option value="No binario">No binario</option>
            </select>
            {errors.genero && <small className="field-error">{errors.genero.message}</small>}
          </label>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__title">
          <span className="form-section__number">03</span>
          <div><h3>Contacto y fotografía</h3><p>Los datos de contacto ayudan a mantener el registro actualizado.</p></div>
        </div>
        <div className="form-grid form-grid--two">
          <label className="field">
            <span>Correo electrónico <b>*</b></span>
            <input type="email" placeholder="persona@correo.com" {...register("correo")} />
            {errors.correo && <small className="field-error">{errors.correo.message}</small>}
          </label>
          <label className="field">
            <span>Celular <b>*</b></span>
            <input inputMode="numeric" maxLength={10} placeholder="10 dígitos" {...register("celular")} />
            {errors.celular && <small className="field-error">{errors.celular.message}</small>}
          </label>
        </div>
        <label className="upload-field">
          <span className="upload-field__icon"><ImagePlus size={19} /></span>
          <span className="upload-field__copy">
            <strong>{fotoSeleccionada instanceof File ? fotoSeleccionada.name : "Añadir fotografía"}</strong>
            <small>{person?.foto_url && !fotoSeleccionada ? "Ya existe una foto. Selecciona otra para reemplazarla." : "JPG, PNG o formato de imagen · máximo 2 MB · opcional"}</small>
          </span>
          <span className="upload-field__action">Seleccionar</span>
          <Controller
            control={control}
            name="foto"
            render={({ field: { onChange, ref, name } }) => (
              <input
                ref={ref}
                name={name}
                type="file"
                accept="image/*"
                onChange={(event) => onChange(event.target.files?.item(0) ?? undefined)}
              />
            )}
          />
        </label>
        {errors.foto && <small className="field-error upload-error">{errors.foto.message}</small>}
        {person?.foto_url && (
          <a className="photo-link" href={person.foto_url} target="_blank" rel="noreferrer">
            Ver fotografía actual <ArrowUpRight size={14} />
          </a>
        )}
      </div>

      <div className="form-footer">
        <span className="required-note"><b>*</b> Campos obligatorios</span>
        <div className="form-footer__actions">
          {onCancel && <button className="button button--quiet" type="button" onClick={onCancel}>Cancelar</button>}
          <button
            className="button button--primary"
            type="submit"
            disabled={pending || !isValid || (mode === "update" && !isDirty)}
          >
            {pending ? "Guardando…" : mode === "create" ? <><UserRoundPlus size={17} /> Crear registro</> : <><Save size={17} /> Guardar cambios</>}
          </button>
        </div>
      </div>
      {mode === "update" && numeroDocumento && (
        <span className="sr-only" aria-live="polite">Editando documento {numeroDocumento}</span>
      )}
    </form>
  );
}
