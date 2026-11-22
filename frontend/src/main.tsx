/* Punto de entrada de la SPA. Monta router, TanStack Query, sesión y estilos globales antes de renderizar App. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/global.css";
import { App } from "./app/App";
import { AuthProvider } from "./shared/lib/auth-context";

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const raiz = document.getElementById("root");
if (!raiz) throw new Error("No se encontró el elemento #root en index.html");

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={clienteConsultas}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
