/* Shell visual con sidebar y topbar móvil. Define los seis servicios y el título de página; se aparta del router para reutilizarlo en cada panel. */
import { useEffect, useState, type ReactNode } from "react";
import { Button, Offcanvas } from "react-bootstrap";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import styles from "./dashboard-shell.module.css";

type NavItem = { to: string; label: string; icon: string };

/** Las seis opciones del menú del enunciado + el inicio. */
const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Inicio", icon: "bi-grid-1x2" },
  { to: "/crear", label: "Crear personas", icon: "bi-person-plus" },
  { to: "/actualizar", label: "Modificar datos", icon: "bi-pencil-square" },
  { to: "/consultar", label: "Consultar datos", icon: "bi-search" },
  { to: "/rag", label: "Lenguaje natural", icon: "bi-chat-dots" },
  { to: "/borrar", label: "Borrar personas", icon: "bi-trash3" },
  { to: "/logs", label: "Consultar log", icon: "bi-list-check" },
];

function NavLinks({ alNavegar }: { alNavegar?: () => void }) {
  return (
    <nav className={styles.nav} aria-label="Menú de servicios">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={alNavegar}
          className={({ isActive }) =>
            `${styles.adminNavLink}${isActive ? ` ${styles.adminNavActive}` : ""}`
          }
        >
          <i className={`bi ${item.icon}`} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Shell del panel: sidebar fija en escritorio, offcanvas en móvil. */
export function DashboardShell({ children }: { children: ReactNode }) {
  const ubicacion = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { usuario, cerrarSesion } = useAuth();
  const titulo = NAV_ITEMS.find((item) => ubicacion.pathname.startsWith(item.to))?.label ?? "Panel";

  useEffect(() => {
    document.title = `${titulo} — Gestión de Datos Personales`;
  }, [titulo]);

  return (
    <div className={`${styles.shell} admin-shell`}>
      <a className={styles.skipLink} href="#contenido-principal">
        Saltar al contenido principal
      </a>

      <aside className={`${styles.sidebar} admin-sidebar`}>
        <NavLink to="/dashboard" className={styles.brand}>
          <i className={`bi bi-person-badge ${styles.brandIcon}`} aria-hidden="true" />
          <span className={styles.brandName}>Datos Personales</span>
        </NavLink>

        <NavLinks />

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.avatar} aria-hidden="true">
              {(usuario?.name ?? "U").charAt(0).toUpperCase()}
            </span>
            <div className={styles.userText}>
              <span className={styles.userName}>{usuario?.name ?? "Usuario"}</span>
              <span className={styles.userRole}>{usuario?.email ?? ""}</span>
            </div>
          </div>
          <Button
            variant="outline-light"
            size="sm"
            className={styles.logout}
            onClick={() => void cerrarSesion()}
          >
            <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <header className={styles.topbar}>
        <Button
          variant="outline-secondary"
          className={styles.hamburger}
          aria-label="Abrir menú"
          onClick={() => setMenuAbierto(true)}
        >
          <i className="bi bi-list" aria-hidden="true" />
        </Button>
        <span className={styles.topbarTitle}>{titulo}</span>
      </header>

      <Offcanvas
        show={menuAbierto}
        onHide={() => setMenuAbierto(false)}
        className={styles.mobileSidebar}
      >
        <Offcanvas.Header closeButton closeLabel="Cerrar menú">
          <Offcanvas.Title className={styles.brandName}>Datos Personales</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className={styles.mobileBody}>
          <NavLinks alNavegar={() => setMenuAbierto(false)} />
          <Button
            variant="outline-light"
            className={`w-100 ${styles.mobileLogout}`}
            onClick={() => void cerrarSesion()}
          >
            <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
            Cerrar sesión
          </Button>
        </Offcanvas.Body>
      </Offcanvas>

      <main id="contenido-principal" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
