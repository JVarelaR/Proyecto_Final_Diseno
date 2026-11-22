import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  Database,
  ExternalLink,
  FileClock,
  Fingerprint,
  HeartPulse,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundSearch,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PersonEditor from "./components/PersonEditor";
import SignIn from "./components/SignIn";
import { apiRequest, limpiarToken, obtenerToken, guardarToken } from "./lib/api";
import type { PersonaFormValues } from "./lib/schemas";
import type { EstadoServicio, Persona, RegistroLog, TipoTransaccion, Usuario } from "./types";

type Section = "home" | "create" | "update" | "query" | "delete" | "logs" | "assistant";
type Toast = { text: string; tone: "success" | "error" | "info" } | null;
type LogFilters = {
  tipo_transaccion: string;
  numero_documento: string;
  fecha_desde: string;
  fecha_hasta: string;
};

interface NavigationItem {
  id: Section;
  label: string;
  description: string;
  icon: LucideIcon;
}

const navigation: NavigationItem[] = [
  { id: "home", label: "Resumen", description: "Actividad y estado", icon: LayoutDashboard },
  { id: "create", label: "Crear persona", description: "Nuevo registro", icon: Plus },
  { id: "update", label: "Modificar datos", description: "Editar registro", icon: Pencil },
  { id: "query", label: "Consultar persona", description: "Búsqueda por documento", icon: UserRoundSearch },
  { id: "delete", label: "Eliminar persona", description: "Baja de registro", icon: Trash2 },
  { id: "logs", label: "Registro de auditoría", description: "Historial de operaciones", icon: FileClock },
  { id: "assistant", label: "Consulta inteligente", description: "Asistente RAG en n8n", icon: MessageSquareText },
];

const pageDetails: Record<Section, { title: string; eyebrow: string; description: string }> = {
  home: { title: "Resumen general", eyebrow: "CENTRO DE CONTROL", description: "Una visión clara de la actividad y las herramientas disponibles." },
  create: { title: "Crear persona", eyebrow: "NUEVO REGISTRO", description: "Completa la información para incorporar una persona al sistema." },
  update: { title: "Modificar datos", eyebrow: "ACTUALIZACIÓN", description: "Busca un registro y actualiza sus datos personales." },
  query: { title: "Consultar persona", eyebrow: "BÚSQUEDA INDIVIDUAL", description: "Consulta el registro por su número de documento." },
  delete: { title: "Eliminar persona", eyebrow: "GESTIÓN DE REGISTROS", description: "Elimina un registro con confirmación y trazabilidad." },
  logs: { title: "Registro de auditoría", eyebrow: "TRAZABILIDAD", description: "Explora las operaciones registradas y aplica filtros." },
  assistant: { title: "Consulta inteligente", eyebrow: "BÚSQUEDA EN LENGUAJE NATURAL", description: "Pregunta sobre los registros usando el chat RAG de n8n." },
};

const serviceEndpoints = [
  { nombre: "Autenticación", endpoint: "auth/health" },
  { nombre: "Crear personas", endpoint: "create/health" },
  { nombre: "Modificar datos", endpoint: "update/health" },
  { nombre: "Consultar personas", endpoint: "query/health" },
  { nombre: "Eliminar personas", endpoint: "delete/health" },
  { nombre: "Auditoría", endpoint: "logs/health" },
];

const LOG_TYPES: TipoTransaccion[] = ["CREATE", "READ", "UPDATE", "DELETE", "RAG_QUERY"];
const SUGGESTED_QUESTION = "¿Cuál es el empleado más joven que se ha registrado?";

function nombreVisible(user: Usuario): string {
  return user.name?.trim().split(/\s+/)[0] || user.email;
}

function initials(user: Usuario): string {
  const parts = (user.name || user.email).trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function fechaLegible(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-CO", options ?? { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

function resumenLog(log: RegistroLog): string {
  const detalle = log.detalle;
  if (typeof detalle.pregunta === "string") return detalle.pregunta;
  const payload = detalle.payload;
  if (typeof payload === "object" && payload !== null && "primer_nombre" in payload) {
    const data = payload as { primer_nombre?: unknown; apellidos?: unknown };
    return [data.primer_nombre, data.apellidos].filter((part) => typeof part === "string").join(" ");
  }
  if (typeof detalle.eliminado === "boolean" && detalle.eliminado) return "Registro eliminado";
  return log.numero_documento ? `Documento ${log.numero_documento}` : "Operación del sistema";
}

function nombreOperacion(type: string): string {
  const labels: Record<string, string> = {
    CREATE: "Creación",
    READ: "Consulta",
    UPDATE: "Actualización",
    DELETE: "Eliminación",
    RAG_QUERY: "Consulta inteligente",
  };
  return labels[type] ?? type;
}

function formData(values: PersonaFormValues): FormData {
  const data = new FormData();
  data.append("tipo_documento", values.tipo_documento);
  data.append("numero_documento", values.numero_documento);
  data.append("primer_nombre", values.primer_nombre);
  data.append("segundo_nombre", values.segundo_nombre ?? "");
  data.append("apellidos", values.apellidos);
  data.append("fecha_nacimiento", values.fecha_nacimiento);
  data.append("genero", values.genero);
  data.append("correo", values.correo);
  data.append("celular", values.celular);
  if (values.foto instanceof File) data.append("foto", values.foto);
  return data;
}

function personName(person: Persona): string {
  return [person.primer_nombre, person.segundo_nombre, person.apellidos]
    .filter(Boolean)
    .join(" ");
}

export default function App() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Usuario | null>(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(obtenerToken()));
  const [authNotice, setAuthNotice] = useState("");
  const [section, setSection] = useState<Section>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [lookupDocument, setLookupDocument] = useState("");
  const [lookupResult, setLookupResult] = useState<Persona | null>(null);
  const [editDocumentInput, setEditDocumentInput] = useState("");
  const [editDocument, setEditDocument] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteDocument, setDeleteDocument] = useState("");
  const [logDraft, setLogDraft] = useState<LogFilters>({
    tipo_transaccion: "",
    numero_documento: "",
    fecha_desde: "",
    fecha_hasta: "",
  });
  const [logFilters, setLogFilters] = useState<LogFilters>({
    tipo_transaccion: "",
    numero_documento: "",
    fecha_desde: "",
    fecha_hasta: "",
  });

  useEffect(() => {
    const token = obtenerToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    let active = true;
    apiRequest<{ valid: boolean; data: Usuario }>("auth/verify-token")
      .then((response) => {
        if (active) setUser(response.data);
      })
      .catch(() => {
        limpiarToken();
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function expireSession() {
      setUser(null);
      setCheckingSession(false);
      setAuthNotice("Tu sesión venció. Inicia sesión para continuar.");
      queryClient.clear();
    }
    window.addEventListener("nexo:session-expired", expireSession);
    return () => window.removeEventListener("nexo:session-expired", expireSession);
  }, [queryClient]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const page = pageDetails[section];

  const serviceQuery = useQuery({
    queryKey: ["service-status"],
    queryFn: async () => {
      const results = await Promise.all(
        serviceEndpoints.map(async (service): Promise<EstadoServicio> => {
          try {
            await apiRequest(service.endpoint);
            return { nombre: service.nombre, endpoint: service.endpoint, disponible: true };
          } catch {
            return { nombre: service.nombre, endpoint: service.endpoint, disponible: false };
          }
        }),
      );
      return results;
    },
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const recentLogsQuery = useQuery({
    queryKey: ["recent-logs"],
    queryFn: () => apiRequest<RegistroLog[]>("logs?limite=6"),
    enabled: Boolean(user) && section === "home",
  });

  const filteredLogsQuery = useQuery({
    queryKey: ["filtered-logs", logFilters],
    queryFn: () => {
      const params = new URLSearchParams({ limite: "100" });
      if (logFilters.tipo_transaccion) params.set("tipo_transaccion", logFilters.tipo_transaccion);
      if (logFilters.numero_documento) params.set("numero_documento", logFilters.numero_documento);
      if (logFilters.fecha_desde) params.set("fecha_desde", logFilters.fecha_desde);
      if (logFilters.fecha_hasta) params.set("fecha_hasta", logFilters.fecha_hasta);
      return apiRequest<RegistroLog[]>(`logs?${params.toString()}`);
    },
    enabled: Boolean(user) && section === "logs",
  });

  const editPersonQuery = useQuery({
    queryKey: ["person-to-edit", editDocument],
    queryFn: () => apiRequest<Persona>(`query/${encodeURIComponent(editDocument)}`),
    enabled: Boolean(user) && section === "update" && Boolean(editDocument),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (values: PersonaFormValues) =>
      apiRequest<Persona>("create", { method: "POST", body: formData(values) }),
    onSuccess: (person) => {
      setToast({ text: `${personName(person)} se agregó correctamente.`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["recent-logs"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ values, document }: { values: PersonaFormValues; document: string }) =>
      apiRequest<Persona>(`update/${encodeURIComponent(document)}`, {
        method: "PUT",
        body: formData(values),
      }),
    onSuccess: (person) => {
      setToast({ text: `Los datos de ${personName(person)} se actualizaron.`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["recent-logs"] });
      queryClient.invalidateQueries({ queryKey: ["filtered-logs"] });
      queryClient.invalidateQueries({ queryKey: ["person-to-edit"] });
    },
  });

  const lookupMutation = useMutation({
    mutationFn: (document: string) =>
      apiRequest<Persona>(`query/${encodeURIComponent(document)}`),
    onSuccess: (person) => {
      setLookupResult(person);
      setToast({ text: "Registro consultado y operación agregada a auditoría.", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["recent-logs"] });
      queryClient.invalidateQueries({ queryKey: ["filtered-logs"] });
    },
    onError: () => setLookupResult(null),
  });

  const deleteMutation = useMutation({
    mutationFn: (document: string) =>
      apiRequest<void>(`delete/${encodeURIComponent(document)}`, { method: "DELETE" }),
    onSuccess: () => {
      setToast({ text: `El registro ${deleteDocument} fue eliminado y auditado.`, tone: "success" });
      setDeleteDocument("");
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ["recent-logs"] });
      queryClient.invalidateQueries({ queryKey: ["filtered-logs"] });
    },
  });

  const services = serviceQuery.data ?? [];
  const availableCount = services.filter((service) => service.disponible).length;
  const serviceHealthLabel = serviceQuery.isLoading
    ? "Verificando servicios"
    : services.length > 0 && availableCount === services.length
      ? "Todos los servicios disponibles"
      : `${availableCount} de ${services.length} servicios disponibles`;

  function navigate(next: Section) {
    setSection(next);
    setMobileMenuOpen(false);
    setToast(null);
  }

  function authenticated(token: string, authenticatedUser: Usuario) {
    guardarToken(token);
    setAuthNotice("");
    setUser(authenticatedUser);
    setCheckingSession(false);
    setSection("home");
    setToast({ text: `Bienvenido, ${nombreVisible(authenticatedUser)}.`, tone: "success" });
  }

  async function cerrarSesion() {
    try {
      await apiRequest("auth/logout", { method: "POST" });
    } catch (reason) {
      setAuthNotice(`Sesión local cerrada. ${errorText(reason)}`);
    } finally {
      limpiarToken();
      setUser(null);
      queryClient.clear();
    }
  }

  function guardarPersona(values: PersonaFormValues) {
    if (section === "create") return createMutation.mutateAsync(values).then(() => undefined);
    return updateMutation
      .mutateAsync({ values, document: editDocument })
      .then(() => undefined);
  }

  function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupResult(null);
    lookupMutation.mutate(lookupDocument.trim());
  }

  function applyLogFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLogFilters({ ...logDraft, numero_documento: logDraft.numero_documento.trim() });
  }

  const headingDate = useMemo(
    () => new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()),
    [],
  );

  if (checkingSession) {
    return <main className="session-loading"><LoaderCircle className="spin" size={28} /><span>Verificando acceso seguro…</span></main>;
  }
  if (!user) return <SignIn onAuthenticated={authenticated} initialNotice={authNotice} />;

  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <div className="brand brand--light">
            <span className="brand__mark"><Fingerprint size={21} strokeWidth={1.8} /></span>
            <span>NEXO<span className="brand__period">.</span></span>
          </div>
          <button className="icon-button sidebar__close" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)}><X size={19} /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-switcher__crest"><UsersRound size={17} /></span>
          <span><strong>Gestión de personas</strong><small>Espacio de trabajo</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="sidebar__label">ESPACIO DE TRABAJO</div>
        <nav className="main-nav" aria-label="Navegación principal">
          {navigation.map((item, index) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${active ? "nav-item--active" : ""} ${index === 6 ? "nav-item--separated" : ""}`}
                onClick={() => navigate(item.id)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.8} />
                <span>{item.label}</span>
                {item.id === "logs" && <span className="nav-item__dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar__spacer" />
        <div className="sidebar-status">
          <span className="sidebar-status__icon"><HeartPulse size={17} /></span>
          <div><strong>{serviceHealthLabel}</strong><small>Estado de la plataforma</small></div>
          <span className={`status-pip ${availableCount === services.length && services.length > 0 ? "status-pip--up" : "status-pip--warn"}`} />
        </div>
        <div className="sidebar__footer">
          <span className="sidebar__version">NEXO <span>·</span> v1.0</span>
          <button className="sidebar-user" onClick={cerrarSesion} title="Cerrar sesión">
            <span className="avatar">{initials(user)}</span>
            <span className="sidebar-user__text"><strong>{user.name || user.email}</strong><small>{user.email}</small></span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-toggle" aria-label="Abrir menú" onClick={() => setMobileMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Nexo</span><span className="breadcrumb-slash">/</span><strong>{page.title}</strong></div>
          <div className="topbar__right">
            <span className="topbar-date"><CalendarDays size={15} />{headingDate}</span>
            <span className="topbar-divider" />
            <button className="help-button" title="Ayuda y documentación" onClick={() => setToast({ text: "Usa el menú para acceder a las operaciones disponibles. Todas las acciones requieren sesión.", tone: "info" })}>
              <CircleHelp size={18} /><span>Ayuda</span>
            </button>
            <span className="avatar avatar--top">{initials(user)}</span>
          </div>
        </header>

        <main className="content">
          {section !== "home" && (
            <div className="page-heading">
              <div>
                <span className="eyebrow">{page.eyebrow}</span>
                <h1>{page.title}</h1>
                <p>{page.description}</p>
              </div>
              <div className="page-heading__mark"><Fingerprint size={24} /></div>
            </div>
          )}

          {section === "home" && (
            <section className="dashboard">
              <div className="welcome-banner">
                <div className="welcome-banner__copy">
                  <span className="eyebrow eyebrow--light">CENTRO DE CONTROL <span className="eyebrow-rule" /></span>
                  <h1>Buenos días,<br /><em>{nombreVisible(user)}.</em></h1>
                  <p>La información de tu organización, clara y bajo control.</p>
                  <button className="button button--light" onClick={() => navigate("create")}>Crear registro <ArrowRight size={16} /></button>
                </div>
                <div className="welcome-banner__art" aria-hidden="true">
                  <div className="orbit orbit--outer" /><div className="orbit orbit--inner" />
                  <div className="welcome-banner__tile"><Fingerprint size={58} strokeWidth={1.2} /></div>
                  <span className="orbit-label orbit-label--one">IDENTIDAD</span>
                  <span className="orbit-label orbit-label--two">CONFIANZA</span>
                  <span className="orbit-label orbit-label--three">GESTIÓN</span>
                </div>
                <span className="welcome-banner__index">N.º 01 / NEXO</span>
              </div>

              <div className="dashboard-section-title">
                <div><span className="eyebrow">VISTA GENERAL</span><h2>Tu espacio de trabajo</h2></div>
                <span className="live-status"><span className="status-pip status-pip--up" /> Actualización automática</span>
              </div>

              <div className="overview-grid">
                <article className="overview-card overview-card--activity">
                  <div className="overview-card__top"><span className="overview-icon overview-icon--green"><Activity size={18} /></span><span className="card-kicker">AUDITORÍA</span><ArrowUpRight size={16} className="overview-card__arrow" /></div>
                  <div className="overview-card__value">{recentLogsQuery.isLoading ? "—" : recentLogsQuery.data?.length ?? "—"}</div>
                  <div className="overview-card__label">Operaciones recientes</div>
                  <p>Últimos registros de actividad disponibles</p>
                  <button className="text-link" onClick={() => navigate("logs")}>Explorar auditoría <ArrowRight size={14} /></button>
                </article>
                <article className="overview-card overview-card--services">
                  <div className="overview-card__top"><span className="overview-icon overview-icon--blue"><Database size={18} /></span><span className="card-kicker">PLATAFORMA</span><ArrowUpRight size={16} className="overview-card__arrow" /></div>
                  <div className="overview-card__value">{serviceQuery.isLoading ? "…" : `${availableCount}/${services.length || "—"}`}</div>
                  <div className="overview-card__label">Servicios disponibles</div>
                  <p>{serviceQuery.isLoading ? "Comprobando estado del sistema" : serviceHealthLabel}</p>
                  <button className="text-link" onClick={() => void serviceQuery.refetch()}>Comprobar de nuevo <ArrowRight size={14} /></button>
                </article>
                <article className="overview-card overview-card--identity">
                  <div className="overview-card__top"><span className="overview-icon overview-icon--gold"><ShieldCheck size={18} /></span><span className="card-kicker">SESIÓN</span><BadgeCheck size={16} className="verified-mark" /></div>
                  <div className="overview-card__value overview-card__value--identity">Protegida</div>
                  <div className="overview-card__label">Acceso autenticado</div>
                  <p>{user.email}</p>
                  <span className="identity-caption"><Shield size={13} /> Token validado por el servicio de acceso</span>
                </article>
              </div>

              <div className="dashboard-lower">
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <div><span className="eyebrow">TRAZABILIDAD</span><h2>Actividad reciente</h2></div>
                    <button className="button button--outline button--small" onClick={() => navigate("logs")}>Ver auditoría <ArrowUpRight size={14} /></button>
                  </div>
                  {recentLogsQuery.isLoading ? <LoadingLine label="Cargando actividad" /> :
                    recentLogsQuery.isError ? <InlineError message={errorText(recentLogsQuery.error)} /> :
                      (recentLogsQuery.data?.length ?? 0) === 0 ? <EmptyState icon={ClipboardList} title="Sin actividad todavía" description="Las operaciones registradas aparecerán en este espacio." /> :
                        <div className="activity-list">{recentLogsQuery.data?.map((log) => <LogRow key={log.id} log={log} />)}</div>}
                </section>
                <section className="panel shortcuts-panel">
                  <div className="panel-heading"><div><span className="eyebrow">ACCESO RÁPIDO</span><h2>¿Qué necesitas hacer?</h2></div></div>
                  <div className="shortcut-list">
                    <Shortcut icon={UserRoundPlusIcon} title="Crear persona" detail="Agregar un nuevo registro" onClick={() => navigate("create")} />
                    <Shortcut icon={UserRoundSearch} title="Consultar persona" detail="Buscar por documento" onClick={() => navigate("query")} />
                    <Shortcut icon={MessageSquareText} title="Consulta inteligente" detail="Pregunta en lenguaje natural" onClick={() => navigate("assistant")} />
                  </div>
                </section>
              </div>

              <ServiceOverview services={services} loading={serviceQuery.isLoading} />
            </section>
          )}

          {section === "create" && (
            <div className="work-area work-area--narrow">
              <div className="panel form-panel">
                <div className="panel-heading panel-heading--form">
                  <div><span className="eyebrow">FORMULARIO DE INGRESO</span><h2>Datos de la persona</h2></div>
                  <span className="secure-tag"><ShieldCheck size={14} /> Validación activa</span>
                </div>
                {createMutation.isError && <InlineError message={errorText(createMutation.error)} />}
                <PersonEditor mode="create" pending={createMutation.isPending} onSave={guardarPersona} />
              </div>
              <aside className="side-note"><ShieldCheck size={18} /><div><strong>Registro con trazabilidad</strong><p>Al crear una persona, el sistema guarda la operación en el registro de auditoría automáticamente.</p></div></aside>
            </div>
          )}

          {section === "update" && (
            <div className="work-area work-area--narrow">
              <section className="panel search-panel">
                <div className="search-panel__icon"><Search size={20} /></div>
                <div className="search-panel__copy"><h2>Localiza el registro</h2><p>La búsqueda utiliza el número de documento como llave.</p></div>
                <form
                  className="inline-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setEditDocumentInput(editDocumentInput.trim());
                    setEditDocument(editDocumentInput.trim());
                  }}
                >
                  <input value={editDocumentInput} onChange={(event) => { setEditDocumentInput(event.target.value); setEditDocument(""); }} inputMode="numeric" placeholder="Número de documento" aria-label="Número de documento para modificar" />
                  <button className="button button--primary" disabled={!editDocumentInput.trim()} type="submit">Buscar <ArrowRight size={15} /></button>
                </form>
              </section>
              {editPersonQuery.isFetching && <div className="panel loading-panel"><LoadingLine label="Buscando registro" /></div>}
              {editPersonQuery.isError && <InlineError message={errorText(editPersonQuery.error)} />}
              {editPersonQuery.data && (
                <div className="panel form-panel">
                  <div className="panel-heading panel-heading--form">
                    <div><span className="eyebrow">REGISTRO ENCONTRADO</span><h2>{personName(editPersonQuery.data)}</h2></div>
                    <span className="document-chip">{editPersonQuery.data.numero_documento}</span>
                  </div>
                  {updateMutation.isError && <InlineError message={errorText(updateMutation.error)} />}
                  <PersonEditor
                    key={editPersonQuery.data.numero_documento}
                    mode="update"
                    person={editPersonQuery.data}
                    pending={updateMutation.isPending}
                    onSave={guardarPersona}
                    onCancel={() => { setEditDocument(""); setEditDocumentInput(""); }}
                  />
                </div>
              )}
            </div>
          )}

          {section === "query" && (
            <div className="work-area work-area--narrow">
              <section className="panel lookup-panel">
                <div className="lookup-panel__heading"><span className="lookup-panel__icon"><UserRoundSearch size={22} /></span><div><h2>Consulta por documento</h2><p>Obtén el registro vigente. Esta consulta también queda auditada.</p></div></div>
                <form className="lookup-form" onSubmit={submitLookup}>
                  <label className="field"><span>Número de documento</span><input value={lookupDocument} onChange={(event) => setLookupDocument(event.target.value)} inputMode="numeric" maxLength={10} placeholder="Escribe el número de documento" autoFocus /></label>
                  <button className="button button--primary" type="submit" disabled={!lookupDocument.trim() || lookupMutation.isPending}>
                    {lookupMutation.isPending ? <><LoaderCircle size={16} className="spin" /> Consultando</> : <><Search size={16} /> Consultar registro</>}
                  </button>
                </form>
                {lookupMutation.isError && <InlineError message={errorText(lookupMutation.error)} />}
              </section>
              {lookupResult && <PersonCard person={lookupResult} />}
              {!lookupResult && !lookupMutation.isPending && !lookupMutation.isError && (
                <div className="empty-panel"><UserRoundSearch size={25} /><strong>El resultado aparecerá aquí</strong><span>Las consultas se registran automáticamente en auditoría.</span></div>
              )}
            </div>
          )}

          {section === "delete" && (
            <div className="work-area work-area--narrow">
              <section className="panel delete-panel">
                <span className="delete-panel__icon"><Trash2 size={21} /></span>
                <span className="eyebrow">ELIMINACIÓN DE REGISTRO</span>
                <h2>Retira un registro</h2>
                <p>Esta acción elimina la persona y su embedding asociado. La operación queda conservada en el log de auditoría.</p>
                <label className="field"><span>Número de documento</span><input value={deleteDocument} onChange={(event) => setDeleteDocument(event.target.value)} inputMode="numeric" maxLength={10} placeholder="Ingresa el documento a eliminar" /></label>
                <button className="button button--danger" disabled={!deleteDocument.trim()} onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Eliminar registro</button>
                {deleteMutation.isError && <InlineError message={errorText(deleteMutation.error)} />}
              </section>
              <div className="side-note side-note--warning"><Shield size={18} /><div><strong>Acción irreversible</strong><p>Verifica el número antes de confirmar. Los eventos de auditoría no se eliminan.</p></div></div>
            </div>
          )}

          {section === "logs" && (
            <div className="work-area">
              <section className="panel logs-filter-panel">
                <div className="panel-heading"><div><span className="eyebrow">FILTROS DE BÚSQUEDA</span><h2>Refina el historial</h2></div><span className="filter-mark"><ClipboardList size={19} /></span></div>
                <form className="log-filters" onSubmit={applyLogFilters}>
                  <label className="field"><span>Tipo de operación</span><select value={logDraft.tipo_transaccion} onChange={(event) => setLogDraft({ ...logDraft, tipo_transaccion: event.target.value })}><option value="">Todas las operaciones</option>{LOG_TYPES.map((type) => <option key={type} value={type}>{nombreOperacion(type)}</option>)}</select></label>
                  <label className="field"><span>Número de documento</span><input value={logDraft.numero_documento} onChange={(event) => setLogDraft({ ...logDraft, numero_documento: event.target.value })} maxLength={10} placeholder="Opcional" /></label>
                  <label className="field"><span>Desde</span><input type="date" value={logDraft.fecha_desde} onChange={(event) => setLogDraft({ ...logDraft, fecha_desde: event.target.value })} /></label>
                  <label className="field"><span>Hasta</span><input type="date" value={logDraft.fecha_hasta} onChange={(event) => setLogDraft({ ...logDraft, fecha_hasta: event.target.value })} /></label>
                  <button className="button button--primary" type="submit"><Search size={15} /> Aplicar filtros</button>
                  <button className="button button--quiet" type="button" onClick={() => { const clean = { tipo_transaccion: "", numero_documento: "", fecha_desde: "", fecha_hasta: "" }; setLogDraft(clean); setLogFilters(clean); }}>Limpiar</button>
                </form>
              </section>
              <section className="panel logs-results-panel">
                <div className="panel-heading"><div><span className="eyebrow">HISTORIAL</span><h2>Operaciones registradas</h2></div><span className="results-count">{filteredLogsQuery.data?.length ?? 0} resultados</span></div>
                {filteredLogsQuery.isLoading ? <LoadingLine label="Cargando registros de auditoría" /> :
                  filteredLogsQuery.isError ? <InlineError message={errorText(filteredLogsQuery.error)} /> :
                    (filteredLogsQuery.data?.length ?? 0) === 0 ? <EmptyState icon={FileClock} title="No hay registros con estos filtros" description="Prueba con otros criterios o limpia los filtros." /> :
                      <div className="table-scroll"><table className="data-table"><thead><tr><th>OPERACIÓN</th><th>DOCUMENTO</th><th>DETALLE</th><th>FECHA Y HORA</th></tr></thead><tbody>{filteredLogsQuery.data?.map((log) => <LogTableRow key={log.id} log={log} />)}</tbody></table></div>}
                <div className="table-footnote"><ShieldCheck size={14} /> Los resultados reflejan el endpoint real de auditoría (máximo 100 por consulta).</div>
              </section>
            </div>
          )}

          {section === "assistant" && (
            <div className="work-area work-area--narrow">
              <section className="assistant-hero">
                <div className="assistant-hero__orb"><MessageSquareText size={31} strokeWidth={1.4} /></div>
                <span className="eyebrow eyebrow--light">ASISTENTE DE CONSULTA · RAG</span>
                <h2>Pregunta con tus propias palabras.</h2>
                <p>El chat nativo de n8n busca información en los registros, genera una respuesta contextual y guarda la pregunta y la respuesta en la auditoría.</p>
                <a className="button button--light" href="/n8n/" target="_blank" rel="noreferrer">Abrir chat de n8n <ExternalLink size={16} /></a>
                <span className="assistant-hero__note"><ShieldCheck size={14} /> Se abrirá el acceso protegido del gateway.</span>
              </section>
              <section className="panel suggested-question">
                <div className="suggested-question__icon"><BookOpenCheck size={19} /></div>
                <div><span className="eyebrow">PREGUNTA DE PRUEBA</span><p>{SUGGESTED_QUESTION}</p><small>Pregunta oficial para verificar la consulta agregada de edad.</small></div>
                <button
                  className="button button--outline button--small"
                  onClick={() => navigator.clipboard.writeText(SUGGESTED_QUESTION)
                    .then(() => setToast({ text: "Pregunta copiada. Pégala en el chat de n8n.", tone: "success" }))
                    .catch(() => setToast({ text: "No se pudo copiar. Selecciona la pregunta manualmente.", tone: "error" }))}
                ><ClipboardList size={14} /> Copiar</button>
              </section>
              <section className="rag-steps">
                <div className="rag-steps__title"><span className="eyebrow">CÓMO FUNCIONA</span><h3>De la pregunta a una respuesta verificable</h3></div>
                <div className="rag-step"><span>01</span><div><strong>Pregunta</strong><small>Escribe en el chat protegido de n8n.</small></div><ArrowDownRight size={16} /></div>
                <div className="rag-step"><span>02</span><div><strong>Búsqueda contextual</strong><small>El flujo consulta embeddings y datos agregados.</small></div><ArrowDownRight size={16} /></div>
                <div className="rag-step"><span>03</span><div><strong>Respuesta + auditoría</strong><small>La respuesta vuelve al chat y se registra como RAG_QUERY.</small></div><CheckCircle2 size={16} /></div>
              </section>
            </div>
          )}

          <footer className="content-footer"><span>© 2026 Nexo · Gestión de datos personales</span><span><LockKeyholeIcon /> Información protegida por sesión</span></footer>
        </main>
      </div>

      {toast && <div className={`toast toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}><span className="toast__icon">{toast.tone === "success" ? <Check size={16} /> : toast.tone === "error" ? <X size={16} /> : <CircleHelp size={16} />}</span><span>{toast.text}</span><button aria-label="Cerrar notificación" onClick={() => setToast(null)}><X size={15} /></button></div>}

      {confirmDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmDelete(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <button className="icon-button confirm-modal__close" aria-label="Cerrar" onClick={() => setConfirmDelete(false)}><X size={18} /></button>
            <span className="confirm-modal__icon"><Trash2 size={22} /></span>
            <span className="eyebrow">CONFIRMACIÓN REQUERIDA</span>
            <h2 id="confirm-title">¿Eliminar este registro?</h2>
            <p>Se eliminará el documento <strong>{deleteDocument}</strong>. Esta acción no se puede deshacer; el evento quedará en auditoría.</p>
            {deleteMutation.isError && <InlineError message={errorText(deleteMutation.error)} />}
            <div className="confirm-modal__actions">
              <button className="button button--quiet" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button className="button button--danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteDocument.trim())}>
                {deleteMutation.isPending ? <><LoaderCircle size={15} className="spin" /> Eliminando</> : <><Trash2 size={15} /> Confirmar eliminación</>}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const UserRoundPlusIcon = UserRound;
const LockKeyholeIcon = Shield;

function LoadingLine({ label }: { label: string }) {
  return <div className="loading-line"><LoaderCircle size={17} className="spin" /><span>{label}…</span></div>;
}

function InlineError({ message }: { message: string }) {
  return <div className="inline-message inline-message--error" role="alert"><X size={16} />{message}</div>;
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="empty-state"><span><Icon size={21} /></span><strong>{title}</strong><p>{description}</p></div>;
}

function Shortcut({ icon: Icon, title, detail, onClick }: { icon: LucideIcon; title: string; detail: string; onClick: () => void }) {
  return <button className="shortcut" onClick={onClick}><span className="shortcut__icon"><Icon size={17} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16} /></button>;
}

function LogRow({ log }: { log: RegistroLog }) {
  return (
    <div className="activity-row">
      <span className={`operation-dot operation-dot--${log.tipo_transaccion.toLowerCase()}`} />
      <div className="activity-row__main"><strong>{nombreOperacion(log.tipo_transaccion)}</strong><small>{resumenLog(log)}</small></div>
      <span className="activity-row__document">{log.numero_documento ?? "—"}</span>
      <span className="activity-row__time">{fechaLegible(log.fecha_transaccion, { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  );
}

function LogTableRow({ log }: { log: RegistroLog }) {
  return (
    <tr>
      <td><span className={`operation-badge operation-badge--${log.tipo_transaccion.toLowerCase()}`}><span />{nombreOperacion(log.tipo_transaccion)}</span></td>
      <td className="mono-cell">{log.numero_documento ?? "—"}</td>
      <td className="detail-cell">{resumenLog(log)}</td>
      <td>{fechaLegible(log.fecha_transaccion, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
    </tr>
  );
}

function ServiceOverview({ services, loading }: { services: EstadoServicio[]; loading: boolean }) {
  return (
    <section className="panel service-overview">
      <div className="panel-heading"><div><span className="eyebrow">OBSERVABILIDAD</span><h2>Estado de los microservicios</h2></div><span className="refresh-caption"><Clock3 size={14} /> Cada 30 segundos</span></div>
      {loading ? <LoadingLine label="Verificando microservicios" /> :
        <div className="service-grid">{services.map((service) => <div key={service.endpoint} className="service-item"><span className={`service-item__pip ${service.disponible ? "service-item__pip--up" : ""}`} /><span><strong>{service.nombre}</strong><small>{service.endpoint}</small></span><span className={`service-item__state ${service.disponible ? "" : "service-item__state--down"}`}>{service.disponible ? "Operativo" : "No disponible"}</span></div>)}</div>}
    </section>
  );
}

function PersonCard({ person }: { person: Persona }) {
  return (
    <section className="panel person-card">
      <div className="person-card__header">
        {person.foto_url ? <img src={person.foto_url} alt={`Fotografía de ${personName(person)}`} /> : <span className="person-card__avatar"><UserRound size={26} /></span>}
        <div><span className="eyebrow">REGISTRO ENCONTRADO</span><h2>{personName(person)}</h2><p>{person.tipo_documento} · {person.numero_documento}</p></div>
        <span className="record-status"><span className="status-pip status-pip--up" /> Vigente</span>
      </div>
      <div className="person-card__details">
        <PersonDetail label="Fecha de nacimiento" value={fechaLegible(person.fecha_nacimiento)} />
        <PersonDetail label="Género" value={person.genero} />
        <PersonDetail label="Correo electrónico" value={person.correo} />
        <PersonDetail label="Celular" value={person.celular} />
        <PersonDetail label="Fecha de registro" value={fechaLegible(person.created_at)} />
      </div>
      {person.foto_url && <a className="photo-link" href={person.foto_url} target="_blank" rel="noreferrer">Abrir fotografía <ArrowUpRight size={14} /></a>}
      <div className="person-card__audit"><CheckCircle2 size={15} /> Esta consulta quedó registrada en el historial de auditoría.</div>
    </section>
  );
}

function PersonDetail({ label, value }: { label: string; value: string }) {
  return <div className="person-detail"><span>{label}</span><strong>{value}</strong></div>;
}
