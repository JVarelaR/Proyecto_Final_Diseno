import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Fingerprint, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { apiRequest } from "../lib/api";
import {
  accesoSchema,
  registroSchema,
  type AccesoValues,
  type RegistroValues,
} from "../lib/schemas";
import type { Usuario } from "../types";

interface SignInProps {
  onAuthenticated: (token: string, user: Usuario) => void;
  initialNotice?: string;
}

interface AuthResponse {
  access_token: string;
  user: Usuario;
}

export default function SignIn({ onAuthenticated, initialNotice = "" }: SignInProps) {
  const [registrando, setRegistrando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(initialNotice);
  const acceso = useForm<AccesoValues>({
    resolver: zodResolver(accesoSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });
  const registro = useForm<RegistroValues>({
    resolver: zodResolver(registroSchema),
    mode: "onChange",
    defaultValues: { name: "", email: "", password: "" },
  });

  async function iniciarSesion(values: AccesoValues) {
    setError("");
    setMensaje("");
    try {
      const response = await apiRequest<AuthResponse>("auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      onAuthenticated(response.access_token, response.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión.");
    }
  }

  async function crearCuenta(values: RegistroValues) {
    setError("");
    setMensaje("");
    try {
      await apiRequest<{ message?: string }>("auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          name: values.name,
        }),
      });
      setMensaje("Cuenta registrada. Ya puedes iniciar sesión.");
      setRegistrando(false);
      acceso.setValue("email", values.email);
      acceso.setValue("password", "");
      registro.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la cuenta.");
    }
  }

  const isSubmitting = registrando
    ? registro.formState.isSubmitting
    : acceso.formState.isSubmitting;
  const emailField = registrando ? registro.register("email") : acceso.register("email");
  const passwordField = registrando ? registro.register("password") : acceso.register("password");
  const emailError = registrando
    ? registro.formState.errors.email
    : acceso.formState.errors.email;
  const passwordError = registrando
    ? registro.formState.errors.password
    : acceso.formState.errors.password;

  return (
    <main className="auth-page">
      <section className="auth-art" aria-label="Nexo, gestión segura de datos">
        <div className="auth-art__top">
          <div className="brand brand--light">
            <span className="brand__mark"><Fingerprint size={22} strokeWidth={1.8} /></span>
            <span>NEXO<span className="brand__period">.</span></span>
          </div>
          <span className="auth-art__eyebrow">GESTIÓN DE DATOS PERSONALES</span>
        </div>
        <div className="auth-art__content">
          <span className="eyebrow eyebrow--light">INFORMACIÓN CONFIABLE. GESTIÓN HUMANA.</span>
          <h1>Los datos cuentan.<br /><em>Tu confianza también.</em></h1>
          <p>Un espacio seguro para administrar, consultar y auditar la información de las personas.</p>
        </div>
        <div className="auth-art__seal">
          <div className="seal-icon"><ShieldCheck size={18} /></div>
          <div>
            <strong>Acceso protegido</strong>
            <span>Autenticación centralizada</span>
          </div>
          <span className="auth-art__index">01 — 06</span>
        </div>
        <div className="auth-art__shape auth-art__shape--one" />
        <div className="auth-art__shape auth-art__shape--two" />
      </section>

      <section className="auth-panel">
        <div className="auth-panel__mobile-brand">
          <div className="brand"><span className="brand__mark"><Fingerprint size={21} /></span><span>NEXO<span className="brand__period">.</span></span></div>
          <span className="eyebrow">GESTIÓN DE DATOS PERSONALES</span>
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">{registrando ? "COMIENZA AQUÍ" : "BIENVENIDO DE NUEVO"}</span>
          <h2>{registrando ? "Crea tu acceso" : "Ingresa a tu espacio"}</h2>
          <p className="auth-intro">
            {registrando
              ? "Registra una cuenta para acceder a las herramientas de gestión."
              : "Usa las credenciales del proveedor de autenticación configurado."}
          </p>

          {mensaje && <div className="inline-message inline-message--success" role="status">{mensaje}</div>}
          {error && <div className="inline-message inline-message--error" role="alert">{error}</div>}
          {notice && <div className="inline-message inline-message--success" role="status">{notice}</div>}

          <form
            className="auth-form"
            onSubmit={registrando
              ? registro.handleSubmit(crearCuenta)
              : acceso.handleSubmit(iniciarSesion)}
            noValidate
          >
            {registrando && (
              <label className="field">
                <span>Nombre completo</span>
                <span className="input-wrap">
                  <Fingerprint size={17} />
                  <input autoComplete="name" placeholder="Tu nombre" {...registro.register("name")} />
                </span>
                {registro.formState.errors.name && <small className="field-error">{registro.formState.errors.name.message}</small>}
              </label>
            )}
            <label className="field">
              <span>Correo electrónico</span>
              <span className="input-wrap">
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@organizacion.com"
                  {...emailField}
                />
              </span>
              {emailError && <small className="field-error">{emailError.message}</small>}
            </label>
            <label className="field">
              <span>Contraseña</span>
              <span className="input-wrap">
                <LockKeyhole size={17} />
                <input
                  type="password"
                  autoComplete={registrando ? "new-password" : "current-password"}
                  placeholder={registrando ? "Mínimo 8 caracteres" : "Ingresa tu contraseña"}
                  {...passwordField}
                />
              </span>
              {passwordError && <small className="field-error">{passwordError.message}</small>}
            </label>
            <button className="button button--primary auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Procesando…" : registrando ? "Crear cuenta" : "Iniciar sesión"}
              {!isSubmitting && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="auth-toggle">
            {registrando ? "¿Ya tienes una cuenta?" : "¿Primera vez en Nexo?"}
            <button
              type="button"
              onClick={() => {
                setError("");
                setMensaje("");
                setRegistrando((actual) => !actual);
              }}
            >
              {registrando ? "Inicia sesión" : "Regístrate"}
            </button>
          </div>
        </div>
        <div className="auth-panel__footer">
          <span>© 2026 Nexo · Gestión de datos personales</span>
          <span className="secure-note"><ShieldCheck size={14} /> Sesión segura</span>
        </div>
      </section>
    </main>
  );
}
