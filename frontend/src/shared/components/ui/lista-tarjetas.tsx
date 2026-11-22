/* Presentación de resultados en cards. Extrae el patrón visual repetido en personas y logs sin acoplarlo a un feature concreto. */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./lista-tarjetas.module.css";

/**
 * Patrón de listado en tarjetas portado del backoffice de Confitería la 7.
 * Grid responsivo: 1 columna en móvil, 2 en tablet, 3 en escritorio.
 */
export function ListaTarjetas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.listaTarjetas}${className ? ` ${className}` : ""}`}>{children}</div>
  );
}

export function Tarjeta({ className, ...rest }: ComponentPropsWithoutRef<"article">) {
  return <article className={`${styles.tarjeta}${className ? ` ${className}` : ""}`} {...rest} />;
}
