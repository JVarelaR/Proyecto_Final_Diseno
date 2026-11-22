/* Define el árbol de rutas de la SPA. Las rutas del panel quedan detrás de RequireAuth para que ningún servicio se abra sin el JWT de ROBLE. */
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { DashboardShell } from "../shared/components/layout/dashboard-shell";
import { useAuth } from "../shared/lib/auth-context";
import { LoginPage } from "../features/auth/login-page";
import { DashboardPage } from "../features/dashboard/dashboard-page";
import { CrearPage } from "../features/personas/crear-page";
import { ActualizarPage } from "../features/personas/actualizar-page";
import { ConsultarPage } from "../features/personas/consultar-page";
import { BorrarPage } from "../features/personas/borrar-page";
import { LogsPage } from "../features/logs/logs-page";
import { RagPage } from "../features/rag/rag-page";

/** Las rutas del panel exigen el JWT de ROBLE; sin él vuelven al login. */
function RequireAuth() {
  const { token } = useAuth();
  const ubicacion = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: ubicacion.pathname }} />;
  return <Outlet />;
}

function Panel() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Panel />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/crear" element={<CrearPage />} />
          <Route path="/actualizar" element={<ActualizarPage />} />
          <Route path="/consultar" element={<ConsultarPage />} />
          <Route path="/rag" element={<RagPage />} />
          <Route path="/borrar" element={<BorrarPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
