# Gestión de Datos Personales

Panel interno de la materia **Diseño de Software** (Universidad del Norte): CRUD de
personas con auditoría de **todas** las transacciones, autenticación SSO ROBLE,
consulta en lenguaje natural con RAG sobre n8n, microservicios FastAPI y despliegue
completo en Docker Compose.

> Fuente de verdad: [`contexto.md`](contexto.md). Si este README y el contexto difieren,
> manda el contexto y se corrige el README en la misma tarea.

---

## 1. Qué resuelve

La aplicación ofrece exactamente las seis opciones del enunciado. Cada opción se
atiende en un servicio/contenedor distinto y, en la interfaz, un panel independiente:

| # | Opción del menú | Microservicio | Ruta del gateway | Interfaz |
|---|---|---|---|---|
| 1 | Crear personas | `ms-person-create` | `/api/v1/create` | `/crear` |
| 2 | Modificar datos personales | `ms-person-update` | `/api/v1/update` | `/actualizar` |
| 3 | Consultar datos personales | `ms-person-query` | `/api/v1/query` | `/consultar` |
| 4 | Consulta en lenguaje natural | `n8n` (workflow RAG) | `/n8n/` | `/rag` (abre el chat de n8n) |
| 5 | Borrar personas | `ms-person-delete` | `/api/v1/delete` | `/borrar` |
| 6 | Consultar log | `ms-logs` | `/api/v1/logs` | `/logs` |

La llave de búsqueda es siempre `numero_documento`. Toda operación —incluidas las
lecturas y las preguntas del chat— deja una fila en `transaccion_logs`.

---

## 2. Arranco rápido

### Requisitos

- Docker + Docker Compose.
- Puertos `80` y `5432` libres.
- ~4 GB de RAM libres para Ollama (los modelos se descargan en el primer arranque).
- No hace falta API key: la IA es local (Ollama).

### Pasos

```bash
# 1. Copiar la plantilla y rellenar los secretos (NO subir .env al repo).
cp .env.example .env
openssl rand -hex 32                       # → JWT_SECRET_KEY
openssl rand -hex 32                       # → SERVICE_API_KEY

# 2. Verificar sintaxis y levantar backend + gateway + BD + n8n + Ollama.
docker compose config --quiet
docker compose up -d --build

# 3. Levantar la interfaz (perfil opcional `ui`).
docker compose --profile ui up -d --build frontend

# 4. Comprobar que todo respondió.
docker compose ps
curl -sS http://localhost/api/v1/query/health
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/
```

La SPA queda en <http://localhost/>. El gateway publica el resto de rutas; los
microservicios y n8n **no** exponen sus puertos propios.

> Si no levantas el frontend, el gateway responde
> `{"mensaje":"Backend listo. La interfaz se activa con: docker compose --profile ui up frontend"}`
> en `/` (bloque `@no_ui`). No es un error.

---

## 3. Cómo entrar

Con `AUTH_MODE=mock` (valor por defecto) cualquier correo válido y cualquier
contraseña funcionan. Para las pruebas se usa:

- Correo: `usuario.mock@uninorte.edu.co`
- Contraseña: `mock123`

El login devuelve un JWT que la SPA guarda en `sessionStorage` (`gd_sesion`) y envía
como `Authorization: Bearer <token>` en **todas** las llamadas al gateway. Un `401`
cierra la sesión local y devuelve al usuario al login.

n8n tiene basic-auth adicional en el gateway: usa `N8N_USER` / `N8N_PASSWORD` de tu
`.env` al abrir <http://localhost/n8n/> o el chat del panel «Lenguaje natural».

---

## 4. Arquitectura en un minuto

```text
 Navegador ──▶ :80 (gateway Nginx)
                    ├─ /              ─▶ frontend:5173   (SPA React, perfil ui)
                    ├─ /api/v1/auth   ─▶ ms-auth:8000    (JWT / ROBLE)
                    ├─ /api/v1/create ─▶ ms-person-create:8000
                    ├─ /api/v1/update ─▶ ms-person-update:8000
                    ├─ /api/v1/delete ─▶ ms-person-delete:8000
                    ├─ /api/v1/query  ─▶ ms-person-query:8000  (contenedor aislado)
                    ├─ /api/v1/logs   ─▶ ms-logs:8000
                    ├─ /uploads/      ─▶ volumen uploads_data (solo lectura)
                    └─ /n8n/          ─▶ n8n:5678 (basic-auth) ─▶ Ollama local
                                              │
        todos los microservicios ────────────┼──▶ postgres-db:5432 (pgvector)
                                              └──▶ ms-auth (/verify-token) y ms-logs
```

Ideas clave:

- **Un solo engine de BD** (`backend/shared/database.py`) y un solo `get_current_user`
  (`backend/shared/security.py`) para los seis microservicios FastAPI.
- **Auditoría antes del commit**: si `ms-logs` falla, la operación se hace rollback.
  Nunca queda un CREATE/UPDATE/DELETE sin su evento en el log.
- **R7**: `ms-person-query` se resuelve por DNS dinámico en Nginx. Al pararlo, solo
  `/api/v1/query` devuelve `503` controlado; los demás siguen vivos.
- **Resiliencia visual**: cada panel de la SPA consulta su propio `/health`. Si falla,
  ese panel muestra «servicio inactivo» y los demás siguen navegables.
- **IA local**: `nomic-embed-text` (768 dims) para embeddings y `qwen2.5:0.5b` para
  responder. Sin OpenRouter, Gemini ni Groq.

El detalle está en [`docs/arquitectura.md`](docs/arquitectura.md).

---

## 5. Configuración importante

Copia `.env.example` y revisa estas variables:

| Variable | Uso | Valor por defecto / nota |
|---|---|---|
| `AUTH_MODE` | `mock` o `roble` | `mock`; para producción real hace falta `ROBLE_CONTRACT_ID` |
| `JWT_SECRET_KEY` | Firma del JWT | obligatoria; generar con `openssl rand -hex 32` |
| `SERVICE_API_KEY` | Token interno para n8n → `ms-logs` | generar con `openssl rand -hex 32` |
| `POSTGRES_*` / `DATABASE_URL` | BD local y Supabase | mismas migraciones Alembic |
| `OLLAMA_*` | Modelos y dimensiones | `nomic-embed-text`, `768`, `qwen2.5:0.5b` |
| `N8N_USER` / `N8N_PASSWORD` | Basic-auth del gateway | también generan el htpasswd |
| `N8N_INSTANCE_OWNER_PASSWORD_HASH` | Owner pre-aprovisionado | evita el asistente inicial de n8n |
| `VITE_API_URL` / `VITE_N8N_CHAT_URL` | URLs de la SPA | relativas; se sustituyen en **build** |

Los secretos nunca se escriben en el código ni se suben al repositorio.

---

## 6. Pruebas

```bash
# Backend: 12 pruebas de validación Pydantic.
cd backend && ../.venv/bin/python -m pytest -q

# Frontend: 8 pruebas Zod + tipado + build de producción.
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build

# Infraestructura.
docker compose config --quiet
docker compose --profile ui config --quiet
```

La guía completa, incluyendo casos de UI, `curl`, RAG y la prueba R7, está en
[`GUIA_PRUEBAS.txt`](GUIA_PRUEBAS.txt).

---

## 7. Mapa de documentación

| Documento | Para qué sirve |
|---|---|
| [`contexto.md`](contexto.md) | Enunciado, rúbrica de 50 puntos, decisiones, estado y registro de cambios |
| [`AGENTS.md`](AGENTS.md) | Reglas de trabajo del repositorio (sincronización, límites, estilo) |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Cómo encajan contenedores, flujos, datos y decisiones |
| [`GUIA_LECTURA_CODIGO.txt`](GUIA_LECTURA_CODIGO.txt) | Recorrido paso a paso desde el primer archivo hasta entender el sistema |
| [`GUIA_PRUEBAS.txt`](GUIA_PRUEBAS.txt) | Paso a paso para probar todo lo ya implementado |

---

## 8. Estado frente a la rúbrica

| Requisito | Puntos | Estado |
|---|---:|---|
| R1 SSO ROBLE | 4 | Parcial: backend y UI listos en `AUTH_MODE=mock`; falta integrar el contrato ROBLE real |
| R2 CRUD + log de todas las transacciones | 15 | Cumplido |
| R3 RAG en n8n | 12 | Cumplido |
| R4 Campos del formulario | 2 | Cumplido |
| R5 Validaciones Zod + Pydantic | 4 | Cumplido |
| R6 Microservicio por opción | 5 | Cumplido |
| R7 Consulta aislada | 3 | Cumplido |
| R8 BD en contenedor propio | 2 | Cumplido |
| R9 Log filtrable | 3 | Cumplido |

Detalle y evidencia en `contexto.md` §9. Fuera de la rúbrica queda pendiente CI en
GitHub Actions.

---

## 9. Límites y seguridad

- No ejecutar `docker compose down -v` sin autorización: borra volúmenes con datos.
- No editar migraciones ya aplicadas: se crea una nueva con Alembic.
- No añadir endpoints, tablas ni variables de entorno sin verificarlos en código y
  en `contexto.md`.
- No hacer commit/push salvo petición explícita; mensajes en español y concisos.
- Comentarios y documentación en español; identificadores existentes sin renombrar.
