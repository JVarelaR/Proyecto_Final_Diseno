/* Pantalla pública de acceso. Vive fuera del shell para que el usuario pueda autenticarse antes de cargar el menú de servicios. */
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/lib/auth-context";
import { ApiError } from "../../shared/lib/api";
import styles from "./login-page.module.css";

const esquemaLogin = z.object({
  email: z.string().min(1, "El correo es obligatorio").email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

type ValoresLogin = z.infer<typeof esquemaLogin>;

/** Login con la estética del backoffice de origen, conectado a SSO ROBLE. */
export function LoginPage() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const destino = (ubicacion.state as { from?: string } | null)?.from ?? "/dashboard";
  const { token, iniciarSesion } = useAuth();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ValoresLogin>({ resolver: zodResolver(esquemaLogin), mode: "onChange" });

  useEffect(() => {
    document.title = "Ingresar — Gestión de Datos Personales";
    if (token) navegar(destino, { replace: true });
  }, [token, navegar, destino]);

  const enviar = handleSubmit(async (valores) => {
    setError("");
    try {
      await iniciarSesion(valores.email, valores.password);
      navegar(destino, { replace: true });
    } catch (fallo) {
      setError(
        fallo instanceof ApiError && fallo.status === 503
          ? "El servicio de autenticación no está disponible. Inténtalo más tarde."
          : "No se pudo iniciar sesión. Revisa tu correo y contraseña.",
      );
    }
  });

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <i className={`bi bi-person-badge ${styles.brandIcon}`} aria-hidden="true" />
        <span className={styles.brandName}>Gestión de Datos Personales</span>
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>Bienvenido</h1>
        <p className={styles.subtitle}>Ingresa con tu cuenta ROBLE para abrir el panel</p>

        <Form noValidate onSubmit={enviar}>
          {error ? (
            <Alert variant="danger" className={styles.alert}>
              <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
              {error}
            </Alert>
          ) : null}

          <Form.Group controlId="login-email" className="mb-3">
            <Form.Label>Correo electrónico *</Form.Label>
            <Form.Control
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              isInvalid={!!errors.email}
              {...register("email")}
            />
            <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group controlId="login-password" className="mb-4">
            <Form.Label>Contraseña *</Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              isInvalid={!!errors.password}
              {...register("password")}
            />
            <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Ingresando…
              </>
            ) : (
              "Ingresar"
            )}
          </Button>
        </Form>
      </div>

      <p className={styles.footer}>Panel interno · autenticación SSO ROBLE</p>
    </main>
  );
}
