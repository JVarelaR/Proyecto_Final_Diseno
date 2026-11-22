# Arquitectura — Gestión de Datos Personales

> Este documento responde a **por qué está organizado así** el código, no solo a qué
> archivos existen. Para el recorrido instructivo de lectura usa
> [`GUIA_LECTURA_CODIGO.txt`](../GUIA_LECTURA_CODIGO.txt); para el estado oficial usa
> [`contexto.md`](../contexto.md).

---

## 1. Principios rectores

| Principio | Cómo se aplica | Por qué existe |
|---|---|---|
| Fachada única | Todo tráfico entra por el gateway Nginx en `:80` | La SPA y n8n no conocen IPs de contenedores; cambiar un servicio no obliga a cambiar la UI |
| Un microservicio por opción del menú | Seis microservicios FastAPI (auth/create/update/query/delete/logs) y n8n como servicio de la opción RAG | Rúbrica R6 (5 pts) y desacople: parar uno no tumba los demás |
| Código compartido, no duplicado | `backend/shared/` concentra BD, modelos, esquemas, seguridad, logs, embeddings y fotos | Si la validación o el Bearer se copiara en cinco servicios, una corrección se olvidaría en alguno |
| Auditoría transaccional | El evento se escribe en `ms-logs` **antes** del `commit` de la operación | Garantiza que no exista un CREATE/UPDATE/DELETE sin rastro (rúbrica R2, 15 pts) |
| Validación espejo | Pydantic en backend, Zod en frontend, mismas reglas | Rúbrica R5 (4 pts): el navegador da feedback inmediato y el backend sigue siendo la autoridad |
| Persistencia versionada | Solo Alembic crea/cambia tablas; nunca `create_all()` ni editar migraciones aplicadas | El mismo esquema debe funcionar en Docker y en Supabase |
| Asincronía | FastAPI `async def`, SQLAlchemy `AsyncSession`, `select()` de SQLAlchemy 2.0 | Mientras se espera BD/Ollama, el servidor atiende otras peticiones |
| Resiliencia por panel | Cada panel de la SPA consulta su health y muestra «servicio inactivo» si falla | Un contenedor caído no debe dejar la interfaz entera muerta; no relaja auth ni logs |

---

## 2. Inventario de contenedores

| Servicio | Imagen / build | Responsabilidad | Expuesto | Volumen |
|---|---|---|---|---|
| `postgres-db` | `pgvector/pgvector:pg16` | Datos operativos, logs, embeddings y metadatos de n8n | `5432` | `postgres_data` |
| `ollama` | `ollama/ollama` | Embeddings y LLM locales, sin API key | solo red interna | `ollama_data` |
| `ollama-pull` | `ollama/ollama` | Descarga única de los dos modelos al arrancar | — | comparte `ollama_data` |
| `db-migrate` | build `backend/ms-person-create/Dockerfile` | Ejecuta `alembic upgrade head` y termina | — | — |
| `ms-auth` | build `backend/ms-auth/Dockerfile` | Login ROBLE/mock, JWT, `/verify-token`, token de servicio | solo red interna | — |
| `ms-person-create` | build `backend/ms-person-create/Dockerfile` | Alta, foto, log `CREATE`, indexación vectorial | solo red interna | `uploads_data` |
| `ms-person-update` | build `backend/ms-person-update/Dockerfile` | Edición, log `UPDATE`, reindexado | solo red interna | `uploads_data` |
| `ms-person-delete` | build `backend/ms-person-delete/Dockerfile` | Borrado, log `DELETE`, cascade de embedding | solo red interna | — |
| `ms-person-query` | build `backend/ms-person-query/Dockerfile` | Consulta exacta + log `READ`; **sin `restart`** | solo red interna | — |
| `ms-logs` | build `backend/ms-logs/Dockerfile` | Escritura y consulta filtrada de auditoría | solo red interna | — |
| `n8n` | `docker.n8n.io/n8nio/n8n` | Workflow RAG y chat nativo; basic-auth en gateway | solo `/n8n/` | `n8n_data`, workflows |
| `frontend` | build `frontend/Dockerfile` + Nginx | SPA React | solo `/` (perfil `ui`) | — |
| `gateway` | build `gateway/Dockerfile` | Proxy inverso, basic-auth de n8n, `/uploads/`, `@no_ui` | `80` | `uploads_data` (ro) |

Notas de arranque:

- `depends_on` con `condition: service_healthy` / `service_completed_successfully`
  garantiza que Postgres esté listo y que Alembic haya terminado antes de que los
  microservicios consulten tablas.
- `frontend` tiene `profiles: ["ui"]`: no arranca en el `up` normal. Se activa con
  `docker compose --profile ui up -d frontend`.
- `ms-person-query` no tiene `restart: unless-stopped` a propósito: la prueba R7
  necesita que al detenerlo permanezca detenido hasta que se reinicie manualmente.

---

## 3. Mapa de rutas del gateway

El prefijo de cada `APIRouter` en FastAPI debe coincidir **exactamente** con el
`location` de `gateway/nginx.conf`. Si difieren, aparece un 404 o un bucle de
redirecciones 301/307.

| Ruta pública | Destino | Observaciones de diseño |
|---|---|---|
| `/api/v1/auth` | `ms-auth:8000` | Pública solo para login/signup; `/verify-token` exige Bearer |
| `/api/v1/create` | `ms-person-create:8000` | `multipart/form-data`; límite global de 3 MB (foto ≤ 2 MB) |
| `/api/v1/update` | `ms-person-update:8000` | `PUT /{documento}`; la ruta y el formulario deben coincidir |
| `/api/v1/delete` | `ms-person-delete:8000` | `DELETE /{documento}` → 204 |
| `/api/v1/query` | `ms-person-query:8000` | `proxy_pass` con variable + `resolver`; 503 controlado si está parado |
| `/api/v1/logs` | `ms-logs:8000` | Filtros `tipo_transaccion`, `numero_documento`, `fecha_desde`, `fecha_hasta`, `limite` |
| `/uploads/` | `uploads_data` (solo lectura) | Fotos servidas por Nginx, nunca por Python |
| `/n8n/` | `n8n:5678/` | Barra final en `proxy_pass`; basic-auth; timeout de 300 s para el LLM |
| `/` | `frontend:5173` | Si no está levantado, `@no_ui` devuelve 200 con instrucciones |

Detalles que suelen romperse si se "arreglan" mal:

- **Sin barra final** en los `location` de API: evita que Nginx redirija a
  `/api/v1/create/` y FastAPI vuelva a redirigir al sin barra.
- **Con barra final** solo en `/n8n/`: así `/n8n/rest/...` llega como `/rest/...`.
  Sin ella, la API REST caía en el HTML del editor de n8n.
- `resolver 127.0.0.11` es el DNS interno de Docker. Permite que Nginx arranque
  aunque `frontend` o `ms-person-query` no existan todavía.

---

## 4. Flujos extremo a extremo

### 4.1 Autenticación y propagación del Bearer

```text
SPA /login ──POST /api/v1/auth/login──▶ ms-auth
                                      │ AUTH_MODE=mock → usuario fijo + JWT HS256
                                      │ AUTH_MODE=roble → SDK ROBLE + storage en Postgres
                        ◀── {access_token, user}
SPA guarda gd_sesion (sessionStorage)
SPA ──Authorization: Bearer <token>──▶ gateway ──▶ cualquier microservicio
                                                   Depends(get_current_user)
                                                        │
                                                        └──GET ms-auth/api/v1/auth/verify-token
                                                            200 → continúa / 401 → Token inválido
                                                            RequestError → 503 (auth caído)
```

`ms-auth` es la **única** autoridad: los demás servicios no decodifican el JWT por
su cuenta. Así un logout en ROBLE invalida la sesión aunque la firma del token siga
siendo válida. `get_access_token` entrega el token crudo para que `log_client` lo
reenvíe a `ms-logs`, que también exige `get_current_user`.

El token de servicio (`POST /api/v1/auth/service-token` con `X-Service-Key`) es la
excepción controlada: lo usa n8n para registrar `RAG_QUERY` sin credenciales de
usuario. `SERVICE_API_KEY` vive solo en el entorno.

### 4.2 Alta de persona (patrón de auditoría)

```text
1. SPA valida con Zod y envía FormData + Bearer a /api/v1/create.
2. Gateway → ms-person-create.
3. FastAPI valida con Pydantic (422 si falla) e inyecta get_db / current_user / token.
4. PersonaCreate(...) reaplica las reglas compartidas.
5. db.get(Persona, documento) → 409 si ya existe.
6. guardar_foto() escribe en uploads_data y devuelve /uploads/<uuid>.<ext>.
7. db.add() + db.flush() → INSERT dentro de la transacción, aún sin confirmar.
8. registrar_transaccion(token, "CREATE", documento, payload) → POST ms-logs.
   └─ Si falla → rollback → 503. Nunca queda creación sin log.
9. db.commit() confirma la persona.
10. generar_embedding() + UPSERT en persona_embeddings (mejor esfuerzo).
    └─ Si Ollama falla → solo logger.warning; la persona ya quedó guardada.
11. Respuesta 201 con PersonaOut.
```

UPDATE repite el patrón con `db.get` + `setattr` y además borra el vector anterior
antes de insertar el nuevo. DELETE registra el evento **antes** de `db.delete`, y
Postgres elimina el embedding por `ON DELETE CASCADE`. READ es el más simple: `select`,
404 si no existe y log `READ` antes de responder.

### 4.3 Consulta de logs

`GET /api/v1/logs` construye un `select(TransaccionLog)` y añade cláusulas solo para
los filtros que llegaron. `fecha_desde` y `fecha_hasta` se convierten en rangos
completos con `datetime.combine(fecha, time.min/time.max)`, ordena por fecha
descendente y limita a 1000 filas (por defecto 100). La SPA usa los mismos nombres
de parámetros y valida en Zod que `desde <= hasta`.

### 4.4 RAG (indexación y consulta)

**Indexación (write path):** create/update generan el embedding con
`POST {OLLAMA_BASE_URL}/v1/embeddings`, modelo `nomic-embed-text`, 768 dimensiones y
prefijo `search_document:`. El texto incluye nombres, documento, fecha de nacimiento
y género. La fecha es la que permite responder la pregunta oficial sin inventar.
Delete depende del cascade.

**Consulta (read path):**

```text
Chat nativo de n8n (/n8n/webhook/chat-rag-consulta-personas/chat)
  → Embed pregunta (prefijo search_query:)
  → Buscar similares (SQL + distancia coseno <=> LIMIT 5)
  → Agregados (ORDER BY fecha_nacimiento ASC/DESC LIMIT 1)
  → Armar contexto (quita similitud, compone nombre_mas_joven)
  → LLM Ollama qwen2.5:0.5b, temperature 0, español, solo contexto
  → Preparar respuesta (extrae choices[0].message.content)
  → Token de servicio (X-Service-Key)
  → Registrar RAG_QUERY en /api/v1/logs con {pregunta, respuesta}
  → Respuesta al chat
```

La SPA **no reimplementa el chat**: el panel `/rag` solo comprueba `/n8n/healthz` y
abre la URL real en otra pestaña. El `401` del basic-auth se interpreta como «gateway
vivo, faltan credenciales», no como caída; un `502/503` sí marca el panel inactivo.

### 4.5 Resiliencia visual

Cada feature se envuelve en `ServicioPanel` (`frontend/src/shared/components/ui/estado-servicio.tsx`).
El hook `useServicio` llama a `verificarServicio` con un timeout de 4 s, cachea 10 s
y reintenta cada 30 s. Si el health falla, se sustituye **solo** el contenido de ese
panel por el aviso «servicio inactivo», con botón de reintento. El sidebar y los
demás paneles siguen disponibles porque el enrutador y el shell no dependen de la
salud de un microservicio.

---

## 5. Modelo de datos

| Tabla | Llave | Contenido | Relación |
|---|---|---|---|
| `personas` | `numero_documento` VARCHAR(10) | Los 10 campos del formulario + `foto_url`, `created_at`, `updated_at` | — |
| `transaccion_logs` | `id` UUID | `tipo_transaccion`, `numero_documento` nullable, `detalle` JSONB, `fecha_transaccion` | ninguna (auditoría histórica, sobrevive al borrado) |
| `persona_embeddings` | `id` UUID | `contenido_texto`, `embedding VECTOR(768)` | `numero_documento` FK → `personas`, UNIQUE, `ON DELETE CASCADE` |
| `roble_token_storage` | `storage_key` | `storage_value` | la usa solo el SDK ROBLE |

Índice HNSW `ix_persona_embeddings_vector` con `vector_cosine_ops`. La dimensión 768
es nativa de `nomic-embed-text`; si se cambiara el modelo habría que reindexar y
crear una migración nueva. La foto no es un BLOB: se guarda en `uploads_data` y solo
su URL relativa vive en la BD.

---

## 6. Frontend

```text
main.tsx        proveedores globales (BrowserRouter, QueryClient, AuthProvider, CSS)
  └─ App.tsx    rutas; RequireAuth protege el Panel
       └─ dashboard-shell.tsx   sidebar/topbar, título por ruta, logout
            ├─ features/auth/login-page.tsx
            ├─ features/dashboard/dashboard-page.tsx
            ├─ features/personas/{crear,consultar,actualizar,borrar}-page.tsx
            ├─ features/logs/logs-page.tsx
            └─ features/rag/rag-page.tsx

shared/lib/
  validation.ts       Zod: espejo de Pydantic + filtros de log
  api.ts              único cliente HTTP; Bearer, FormData, health, error 401
  auth-context.tsx    sesión en sessionStorage y evento gd:unauthorized
  use-servicio.ts     health por panel
  format.ts           fechas y mensajes de error

shared/components/ui/
  estado-servicio.tsx      aviso por panel caído
  persona-form-modal.tsx   10 campos, calendario o dd-mmm-yyyy
  confirmar-modal.tsx      paso explícito antes de borrar
  lista-tarjetas.tsx       presentación común de personas y logs
```

`VITE_API_URL` y `VITE_N8N_CHAT_URL` se sustituyen durante `npm run build`, por eso
el `Dockerfile` los declara como `ARG` y Compose los pasa como `build.args`; ponerlos
solo en `environment` no funcionaría.

---

## 7. Decisiones registradas (detalle en `contexto.md` §8)

1. Preguntas agregadas: el workflow además consulta `fecha_nacimiento` con SQL para
   responder «quién es el más joven».
2. Embeddings de 768 dims con texto enriquecido; reindexados al migrar a Ollama.
3. Embeddings generados por create/update, no por n8n.
4. Meses en español en `dd-mmm-yyyy`; ISO aceptado también por el datepicker.
5. Fotos ≤ 2 MB en volumen compartido, servidas por `/uploads/`.
6. Basic-auth de n8n en el gateway; owner aprovisionado por entorno.
7. Log de `ms-person-query` reenviando el Bearer; 503 controlado si está parado.
8. Proveedor de IA migrado a Ollama local, sin claves externas.
9. Resiliencia visual por panel sin relajar seguridad ni auditoría.

Pendiente fuera de la rúbrica: CI en GitHub Actions. Pendiente dentro de R1: probar
el flujo con un `ROBLE_CONTRACT_ID` real (hoy se valida en `AUTH_MODE=mock`).

---

## 8. Cómo extender sin romper nada

1. Cambias una validación → edita `backend/shared/schemas.py` **y**
   `frontend/src/shared/lib/validation.ts`, y añade pruebas en ambos lados.
2. Cambias una ruta → edita el `APIRouter` y el `location` de `gateway/nginx.conf`
   en la misma tarea.
3. Cambias el esquema → nueva migración Alembic; nunca edites una aplicada.
4. Añades una operación → llama a `registrar_transaccion` antes del commit.
5. Añades un panel → envuélvelo en `ServicioPanel` y usa `api.ts` (nunca fetch
   directo a un microservicio).
6. Tocas Compose o variables `VITE_*` → actualiza `.env.example`, `Dockerfile`,
   `docker-compose.yml` y `contexto.md` en la misma tarea.
7. Terminas → ejecuta `GUIA_PRUEBAS.txt` y actualiza el registro de cambios.

---

## 9. Pruebas automatizadas

| Suite | Comando | Resultado verificado |
|---|---|---|
| Validaciones Pydantic | `cd backend && ../.venv/bin/python -m pytest -q` | 12 passed |
| Validaciones Zod | `npm --prefix frontend test` | 8 passed |
| Tipado TypeScript | `npm --prefix frontend run typecheck` | sin errores |
| Build SPA | `npm --prefix frontend run build` | `dist/` generado |
| Compose | `docker compose config --quiet` | sin salida = OK |

Las pruebas de integración (UI, curl, RAG, R7) son manuales y están descritas en
[`GUIA_PRUEBAS.txt`](../GUIA_PRUEBAS.txt).
