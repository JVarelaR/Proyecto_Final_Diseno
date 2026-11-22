# contexto.md — Gestión de Datos Personales (Diseño de Software)

> **Fuente de verdad del proyecto.** Este archivo resume el enunciado oficial, la rúbrica, las decisiones de diseño del equipo y la guía de integración con ROBLE.
> **Regla de mantenimiento:** si cambia cualquier cosa del proyecto (arquitectura, contenedores, rutas, tablas, validaciones, stack, estado de avance, decisiones), el agente DEBE actualizar este archivo en la misma tarea. Ver sección 9 (Registro de cambios).

Última actualización: 2026-11-21

---

## 1. Resumen

Trabajo final **en grupo** de la materia **Diseño de Software** (Universidad del Norte). Se debe construir la aplicación **"Gestión de Datos Personales"**: un CRUD de personas con registro de todas las transacciones en un log, autenticación SSO, consulta en lenguaje natural con RAG sobre n8n, microservicios y despliegue en contenedores Docker.

Equipo (según el Documento de Diseño): Andrés Forero, Alfonso Cohen, Daniel Pedroza y Jhosep Varela.

---

## 2. Enunciado oficial (de `Enunciado_y_requisitos.pptx`)

### 2.1 Menú principal (cada opción = un microservicio)

1. Crear Personas
2. Modificar Datos Personales
3. Consultar Datos Personales
4. Consultar Datos Personales – Lenguaje Natural (**en la interfaz de n8n**)
5. Borrar Personas
6. Consultar log

### 2.2 Pantalla principal: campos a capturar

| Campo | Notas |
|---|---|
| Tipo de documento | lista |
| Nro. Documento | llave de búsqueda de los registros |
| Primer Nombre | |
| Segundo Nombre | opcional |
| Apellidos | |
| Fecha de Nacimiento | |
| Género | lista |
| Correo electrónico | |
| Celular | |
| Foto | archivo de imagen |

### 2.3 Validaciones requeridas

| Campo | Regla |
|---|---|
| Tipo de documento | Lista con dos valores: **Tarjeta de identidad**, **Cédula** |
| Nro. Documento | Debe ser número y no mayor de 10 caracteres |
| Primer Nombre | No puede ser número; máx. 30 caracteres |
| Segundo Nombre | No puede ser número; máx. 30 caracteres |
| Apellidos | No puede ser número; máx. 60 caracteres |
| Fecha de Nacimiento | Escogida desde un calendario **o** escrita en formato `dd-mmm-yyyy` |
| Género | Lista con 4 valores: **Masculino, Femenino, No binario, Prefiero no reportar** |
| Correo electrónico | Validar formato de correo |
| Celular | Debe ser número y de **exactamente 10** caracteres |
| Foto | El archivo no puede superar **2 MB** |

Además: **toda transacción debe registrarse en el log**, incluyendo las preguntas y respuestas en lenguaje natural.

### 2.4 Consulta en lenguaje natural (RAG)

- Se debe usar el patrón **RAG** para responder preguntas en lenguaje natural.
- Ejemplo del enunciado: Pregunta: *"¿Cuál es el empleado más joven que se ha registrado?"* → Respuesta: *"Pedro Pérez"*.
- Debe implementarse con **n8n**: el chat donde se hace la pregunta y se ve la respuesta debe estar **en la interfaz de n8n**.

### 2.5 Rúbrica (50 puntos)

| # | Actividad | Puntos |
|---|---|---|
| R1 | Usar un sistema de autenticación como Microsoft Entra, el Proyecto Roble u otro SSO reconocido | 4 |
| R2 | Despliegue en contenedores. Funcionalidad CRUD + registrar todas las transacciones en un log (crear, eliminar, actualizar, consultar). Llave de búsqueda = documento | 15 |
| R3 | Consulta en lenguaje natural con n8n aplicando RAG | 12 |
| R4 | Los campos a capturar son los mostrados en la pantalla principal | 2 |
| R5 | Realizar las validaciones requeridas | 4 |
| R6 | Cada opción del menú se desarrolla en un microservicio | 5 |
| R7 | La opción "Consultar" en un contenedor independiente del resto, con posibilidad de habilitarla/deshabilitarla según demanda | 3 |
| R8 | La base de datos en un contenedor independiente del resto de la aplicación | 2 |
| R9 | La consulta de log permite búsqueda por tipo y documento, y por fecha de transacción | 3 |
| | **Total** | **50** |

Prioridad por peso: R2 (15) > R3 (12) > R6 (5) > R1, R5 (4) > R7, R9 (3) > R4, R8 (2).

---

## 3. Mapeo rúbrica → requisitos del equipo

| Rúbrica | Requisitos del Documento de Diseño |
|---|---|
| R1 | RF-01 (SSO ROBLE únicamente) |
| R2 | RF-02, RF-04, RF-06, RNF-04 (Docker + Compose) |
| R3 | RF-05, RNF-06 |
| R4 | RF-03 |
| R5 | RF-03, RNF-05 (validación en Zod **y** Pydantic) |
| R6 | RNF-01 |
| R7 | RNF-02 |
| R8 | RNF-03, RNF-07 |
| R9 | RF-07 |

### Requisitos del equipo (resumen)

- **RF-01** Autenticación solo vía SSO ROBLE (o proveedor compatible).
- **RF-02** CRUD de personas con `numero_documento` como llave principal de búsqueda.
- **RF-03** Formulario con validación en tiempo real de todos los campos (datepicker / `dd-mmm-yyyy`, foto ≤ 2 MB).
- **RF-04** Consulta exacta por número de documento.
- **RF-05** Consulta en lenguaje natural (RAG) en la interfaz de n8n.
- **RF-06** Log automático de CREATE, UPDATE, DELETE, READ y consultas RAG (pregunta/respuesta).
- **RF-07** Consulta de logs filtrable por tipo de operación, documento y rango de fechas.
- **RNF-01** Un microservicio/contenedor por opción del menú.
- **RNF-02** `ms-person-query` habilitable/deshabilitable sin afectar al resto.
- **RNF-03** PostgreSQL + pgvector en contenedor independiente.
- **RNF-04** Todo (frontend, backend, BD, gateway, n8n) en Docker + Docker Compose.
- **RNF-05** Validaciones en frontend (Zod) y backend (Pydantic), obligatoriamente en ambos.
- **RNF-06** Embeddings y búsqueda semántica con baja latencia.
- **RNF-07** Esquema compatible con PostgreSQL local (pgvector) y Supabase, vía migraciones Alembic.

---

## 4. Arquitectura (decisión del equipo)

Microservicios en contenedores Docker independientes, orquestados con Docker Compose.

| Contenedor | Tecnología | Responsabilidad | Ruta en gateway |
|---|---|---|---|
| `frontend` | React + Vite (SPA) | Menú, formularios con validación en tiempo real, visualización de logs | `/` |
| `gateway` | Nginx / Traefik | Único punto de entrada; proxy inverso a microservicios y n8n | — |
| `ms-auth` | FastAPI | Login ROBLE / mock, emisión de JWT y validación del Bearer (usado por `get_current_user`) | `/api/v1/auth` |
| `ms-person-create` | FastAPI | Inserción de personas | `/api/v1/create` |
| `ms-person-update` | FastAPI | Actualización de personas | `/api/v1/update` |
| `ms-person-delete` | FastAPI | Borrado de personas | `/api/v1/delete` |
| `ms-person-query` | FastAPI (**contenedor aislado**, bajo demanda) | Consulta por documento | `/api/v1/query` |
| `ms-logs` | FastAPI | Registro de auditoría y consulta filtrada de logs | `/api/v1/logs` |
| `n8n` | n8n self-hosted | Orquestación RAG + chat nativo (basic-auth) | `/n8n/` |
| `postgres-db` | PostgreSQL + pgvector | Personas, logs y embeddings | (interno) |

> El prefijo de cada router en FastAPI **debe coincidir exactamente** con `gateway/nginx.conf`: `/api/v1/create`, `/api/v1/update`, `/api/v1/delete`, `/api/v1/query`, `/api/v1/logs`, `/api/v1/auth`, `/uploads/` y `/n8n/`.
> Los microservicios de create/update/delete/query envían su registro de log a `ms-logs` reenviando el Bearer. n8n obtiene un JWT de servicio vía `POST /api/v1/auth/service-token` (cabecera `X-Service-Key`) y también llama a `ms-logs` (`RAG_QUERY`).
> `ms-person-query` se resuelve con `resolver` + `proxy_pass` variable en Nginx: al detenerlo, solo su ruta devuelve `503` controlado.

### Stack

- **Frontend:** React + Vite, React Hook Form + Zod, TanStack Query.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async) + Alembic.
- **BD:** PostgreSQL + pgvector. Local en Docker y Supabase (gratis) para nube, con las mismas migraciones.
- **Auth:** SDK oficial `roble` (Universidad del Norte) con `AUTH_MODE=roble`; `AUTH_MODE=mock` para desarrollo sin contrato. JWT HS256 + `get_current_user`.
- **IA / RAG:** n8n + **Ollama local** (sin API key): embeddings `nomic-embed-text` a 768 dims y LLM `qwen2.5:0.5b` (opción más ligera, sin GPU). Los modelos se descargan en el primer arranque al volumen `ollama_data`. Ya no se usa OpenRouter ni Gemini/Groq.
- **Fotos:** volumen `uploads_data`, `foto_url` relativa servida por `/uploads/`.
- **Frontend:** diferido a una fase posterior; se activa con el perfil `ui` de Compose.
- **CI/CD:** GitHub + GitHub Actions (pruebas).

---

## 5. Modelo de datos

### 5.1 `personas`

| Columna | Tipo | Restricciones |
|---|---|---|
| `numero_documento` | VARCHAR(10) | PRIMARY KEY |
| `tipo_documento` | VARCHAR(30) | NOT NULL (Tarjeta de identidad / Cédula) |
| `primer_nombre` | VARCHAR(30) | NOT NULL |
| `segundo_nombre` | VARCHAR(30) | NULLABLE |
| `apellidos` | VARCHAR(60) | NOT NULL |
| `fecha_nacimiento` | DATE | NOT NULL |
| `genero` | VARCHAR(30) | NOT NULL |
| `correo` | VARCHAR(100) | NOT NULL |
| `celular` | VARCHAR(10) | NOT NULL |
| `foto_url` | TEXT | Ruta de almacenamiento de la imagen |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### 5.2 `transaccion_logs`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | UUID | PK, DEFAULT `gen_random_uuid()` |
| `tipo_transaccion` | VARCHAR(20) | NOT NULL: `CREATE`, `READ`, `UPDATE`, `DELETE`, `RAG_QUERY` |
| `numero_documento` | VARCHAR(10) | NULLABLE (documento consultado/afectado) |
| `detalle` | JSONB | Payload de la petición o par `{pregunta, respuesta}` del RAG |
| `fecha_transaccion` | TIMESTAMP | NOT NULL, indexado |

### 5.3 `persona_embeddings`

Tabla con vectores (pgvector) usada por el RAG, definida en la migración inicial. Columnas: `id` UUID PK, `numero_documento` VARCHAR(10) FK→`personas` ON DELETE CASCADE (UNIQUE), `contenido_texto` TEXT y `embedding` VECTOR(768). Índice HNSW `ix_persona_embeddings_vector` con distancia coseno. La dimensión 768 es nativa de `nomic-embed-text` (Ollama), por lo que no cambió la migración; se configura en `OLLAMA_EMBED_DIMENSIONS` y se valida en `shared/embedding_client.py`. El texto indexado lleva el prefijo `search_document:`. Tras migrar de OpenRouter se reindexaron los embeddings existentes (sin borrar personas ni logs) porque los espacios semánticos no son comparables. Modelo SQLAlchemy: `PersonaEmbedding` en `shared.models`. La indexan `ms-person-create` y `ms-person-update` (mejor esfuerzo); `ms-person-delete` borra por cascade.

### 5.4 `roble_token_storage`

| Columna | Tipo | Restricciones |
|---|---|---|
| `storage_key` | VARCHAR(255) | PRIMARY KEY (namespace del usuario + clave) |
| `storage_value` | TEXT | NOT NULL |

La crea Alembic. Solo la usa `shared/roble_storage.py` cuando `AUTH_MODE=roble` (excepción síncrona documentada en `AGENTS.md` §4).

---

## 6. Flujo RAG en n8n

**Indexación (write path):** `ms-person-create` y `ms-person-update` generan el embedding con `POST {OLLAMA_BASE_URL}/v1/embeddings` (modelo `OLLAMA_EMBED_MODEL` = `nomic-embed-text`, 768 dims, texto con prefijo `search_document:`) sobre un texto que incluye nombres, documento, fecha de nacimiento y género, y hacen UPSERT en `persona_embeddings`. `ms-person-delete` borra por `ON DELETE CASCADE`. Si Ollama falla, el CRUD no se bloquea (mejor esfuerzo). Los modelos se descargan al volumen `ollama_data` mediante el servicio `ollama-pull` en el primer arranque.

**Consulta (read path, workflow `n8n/workflows/rag_consulta_personas.json`):**

1. El usuario escribe la pregunta en el chat nativo de n8n (protegido con basic-auth y servido en `/n8n/`).
2. `Embed pregunta` → Ollama `/v1/embeddings` con `OLLAMA_EMBED_MODEL` y prefijo `search_query:`.
3. `Buscar similares` → SQL con distancia coseno: `ORDER BY pe.embedding <=> '<vector>'::vector LIMIT 5`.
4. `Agregados` → SQL adicional con `ORDER BY fecha_nacimiento DESC/ASC LIMIT 1` para responder preguntas de mínimo/máximo (riesgo #1).
5. `Preparar contexto` → quita el campo `similitud` y compone `nombre_mas_joven` con `primer_nombre` + `segundo_nombre` + `apellidos`, para que el LLM no filtre valores de distancia ni tenga que pegar columnas separadas.
6. `LLM Ollama` → `POST {OLLAMA_BASE_URL}/v1/chat/completions` con `OLLAMA_LLM_MODEL` = `qwen2.5:0.5b`, `temperature: 0` y el contexto recuperado; se le obliga a responder en español, solo con ese contexto y con el nombre completo cuando identifique a una persona.
7. `Token de servicio` → `POST /api/v1/auth/service-token` con `X-Service-Key`; el JWT devuelto se usa como Bearer.
8. `Registrar RAG_QUERY` → `POST /api/v1/logs` con `detalle: {pregunta, respuesta}`; `ms-logs` inserta en `transaccion_logs` y responde `201 Created`.
9. `Respuesta al chat` devuelve el texto; se ve en el widget de n8n.

Pregunta de prueba oficial: *"¿Cuál es el empleado más joven que se ha registrado?"* => debe responder el nombre y dejar un `RAG_QUERY` en el log. **Verificado el 2026-11-21 con Ollama local:** respuesta `Pedro Pérez Gómez` y un `RAG_QUERY` con `detalle: {pregunta, respuesta}` en `transaccion_logs`.

**Configuración de la instancia n8n (2026-11-21):**
- El owner se aprovisiona al arrancar con `N8N_INSTANCE_OWNER_MANAGED_BY_ENV=true` y `N8N_INSTANCE_OWNER_EMAIL=admin@proyecto.local` (el hash bcrypt se genera desde `N8N_PASSWORD` y se guarda escapando `$` como `$$` en `.env`). Así se evita el asistente inicial y se puede usar la API REST.
- La credencial Postgres `gestion_personas` apunta a `postgres-db:5432/gestion_personas`, usuario `admin` y password el default de Compose (`POSTGRES_PASSWORD`, por defecto `admin123`). El campo `ssl` debe ser el string **`disable`** (no el booleano `false`), o n8n 2.x falla con `The server does not support SSL connections`.
- El workflow se versiona en `n8n/workflows/rag_consulta_personas.json` con el id fijo `KTgajEBwgIVpKDRy` (para que el reimport actualice el mismo flujo y no cree duplicados) y el placeholder `__POSTGRES_CREDENTIAL_ID__`; al importar se sustituye por el id real de la credencial (n8n CLI `import:workflow` + `publish:workflow`). Workflow publicado/activo.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` es necesario porque los nodos Code leen `$env.OLLAMA_*` (n8n 2.x lo bloquea por defecto).
- El webhook real del chat es `/n8n/webhook/chat-rag-consulta-personas/chat` (el sufijo `/chat` lo añade el nodo Chat Trigger; la API de n8n lo registra en `webhook_entity`).
- El gateway reescribe `/n8n/` con `proxy_pass http://n8n_service/;` (barra final) para que `/n8n/rest/...` llegue como `/rest/...`; sin ella la API REST caía en el HTML del editor.

---

## 7. Integración con ROBLE y base de datos (guía provista)

Sí se usa el SDK oficial `roble` en `ms-auth` (decisión del equipo 2026-11-21). No se crean motores de SQLAlchemy por servicio; los endpoints solo **inyectan**:

- `get_db` (desde `shared.database`) → sesión asíncrona a PostgreSQL.
- `get_current_user` (desde `shared.security`) → valida el Bearer token en `ms-auth` y devuelve `{"user_id": "...", "email": "...", "name": "..."}`. Si el token es inválido o expiró en ROBLE, FastAPI ya responde `401` automáticamente.

Los modelos viven en `shared.models` (`Persona`, `PersonaEmbedding`, `TransaccionLog`, `RobleTokenStorage`).

`ms-auth` expone `/api/v1/auth/login`, `/api/v1/auth/signup`, `/api/v1/auth/verify-token`, `/api/v1/auth/logout` y `/api/v1/auth/service-token` (mismo prefijo que `gateway/nginx.conf`; las llamadas internas usan directamente el contenedor). Con `AUTH_MODE=mock` devuelve un usuario fijo sin contactar a ROBLE; con `AUTH_MODE=roble` usa el SDK y `ROBLE_CONTRACT_ID`. En ambos casos el JWT se firma con `JWT_SECRET_KEY` y `get_current_user` lo valida llamando a `/api/v1/auth/verify-token`. El storage de sesiones ROBLE es síncrono y centralizado en `shared/roble_storage.py` porque el SDK lo exige; la tabla la crea Alembic.

Patrón de referencia:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.models import Persona, PersonaEmbedding, TransaccionLog
from shared.security import get_current_user

# El prefijo debe coincidir exactamente con gateway/nginx.conf
router = APIRouter(prefix="/api/v1/query", tags=["Consulta Personas"])


@router.get("/{numero_documento}")
async def consultar_persona(
    numero_documento: str,
    db: AsyncSession = Depends(get_db),                 # sesión asíncrona a PostgreSQL
    current_user: dict = Depends(get_current_user),     # valida Bearer token en ms-auth
):
    resultado = await db.execute(
        select(Persona).where(Persona.numero_documento == numero_documento)
    )
    persona = resultado.scalar_one_or_none()

    if not persona:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona no encontrada",
        )

    return persona
```

---

## 8. Riesgos y decisiones abiertas

Resolver y registrar la decisión tomada en el registro de cambios.

1. **RAG vs. preguntas agregadas — RESUELTO (2026-11-21).** El texto embebido incluye fecha de nacimiento y el workflow ejecuta además una consulta SQL `ORDER BY fecha_nacimiento DESC/ASC LIMIT 1`, cuyo resultado se entrega al LLM junto al top-5 vectorial. Se prueba siempre con la pregunta oficial.
2. **Esquema de `persona_embeddings` — RESUELTO (2026-11-21).** Ver §5.3: `VECTOR(768)` (compatible con `nomic-embed-text`), texto con nombres/documento/fecha/género e índice HNSW coseno; reindexado tras la migración a Ollama.
3. **Quién genera los embeddings — RESUELTO (2026-11-21).** Los generan `ms-person-create` y `ms-person-update` de forma asíncrona y mejor esfuerzo; `ms-person-delete` depende del `ON DELETE CASCADE`. n8n solo embebe la pregunta.
4. **Formato `dd-mmm-yyyy` — RESUELTO (2026-11-21).** Meses en español: `ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic`. Implementado en `shared/schemas.py`; Zod deberá replicarlo.
5. **Foto (≤ 2 MB) — RESUELTO (2026-11-21).** Se guarda en el volumen `uploads_data` dentro de los contenedores de create/update; `foto_url` guarda `/uploads/<archivo>` y Nginx lo sirve en solo lectura.
6. **Acceso a n8n/chat — RESUELTO (2026-11-21).** Basic-auth (`N8N_USER`/`N8N_PASSWORD`) más proxy en `/n8n/`; las llamadas internas a `ms-logs` usan un JWT de servicio. Owner aprovisionado por variables de entorno, credencial Postgres con `ssl: disable` y workflow publicado; ver §6 para los detalles.
7. **Registro de logs en `ms-person-query` — RESUELTO (2026-11-21).** Nginx usa `resolver 127.0.0.11` y `proxy_pass` variable: si el contenedor está parado, solo `/api/v1/query` responde `503` controlado; los demás servicios siguen activos.
8. **Nombre del servicio de logs — RESUELTO.** Se usa `ms-logs` en Compose, rutas y documentación.
9. **Data Warehouse (Fase 6, pendiente).** Se descartó incluirlo en el bloque backend. Si se hace, será un schema `dw` adicional en el mismo `postgres-db`, con vistas materializadas (`dim_persona`, `dim_tiempo`, `fact_transaccion`) refrescadas por un Schedule de n8n, sin reemplazar el modelo OLTP ni mover `persona_embeddings`.
10. **Proveedor de IA migrado a Ollama local — RESUELTO (2026-11-21).** Se eliminó OpenRouter por completo (sin API key, coste cero, funcionamiento offline y privacidad). Modelos `nomic-embed-text` (embeddings, 768 dims) y `qwen2.5:0.5b` (LLM), descargados en `ollama_data` por `ollama-pull`; `.env.example` ya no contiene `OPENROUTER_*`. Se reindexaron los embeddings existentes sin borrar personas ni logs y se verificó la pregunta oficial con `RAG_QUERY`.

---

## 9. Estado del proyecto

> Completar y mantener. Marcar `[x]` solo cuando esté verificado en el repositorio.

- [ ] R1 Autenticación ROBLE integrada (backend listo en `AUTH_MODE=mock`; pendiente ROBLE real con `ROBLE_CONTRACT_ID` y el frontend)
- [x] R2 CRUD completo + log de todas las transacciones (verificado por HTTP: `CREATE`/`READ`/`UPDATE`/`DELETE`)
- [x] R3 RAG funcionando en el chat de n8n + log `RAG_QUERY` (verificado con la pregunta oficial el 2026-11-21 con Ollama local: `Pedro Pérez Gómez`)
- [ ] R4 Formulario con todos los campos (frontend pendiente del modelo de UI)
- [ ] R5 Validaciones en Zod y Pydantic (Pydantic listo; Zod pendiente del frontend)
- [x] R6 Un microservicio por opción del menú
- [x] R7 `ms-person-query` aislado y habilitable/deshabilitable (verificado: `503` al pararlo, otros servicios `200`)
- [x] R8 `postgres-db` en contenedor independiente (+ migraciones Alembic, `Embedding` de 768 dims)
- [x] R9 Consulta de logs por tipo, documento y fecha
- [x] `docker compose up -d --build` levanta todo y `docker compose config --quiet` pasa
- [x] RAG con Ollama local (`nomic-embed-text` + `qwen2.5:0.5b`), sin OpenRouter; embeddings reindexados y pregunta oficial verificada
- [ ] CI en GitHub Actions

---

## 10. Registro de cambios

Formato: `AAAA-MM-DD — qué cambió — archivos/servicios afectados`

- 2026-11-20 — Creación del archivo a partir del enunciado, el Documento de Diseño y la guía de ROBLE.
- 2026-11-21 — Backend/infraestructura verificado: CRUD + logs, R7, migraciones y alineación de rutas del gateway — `backend/`, `gateway/nginx.conf`, `docker-compose.yml`.
- 2026-11-21 — Modelo de embeddings fijado a `openai/text-embedding-3-small` (768 dims) y LLM `openrouter/free` — `backend/shared/embedding_client.py`, `n8n/workflows/rag_consulta_personas.json`, `.env.example`.
- 2026-11-21 — Basic-auth de n8n en el gateway, owner aprovisionado por env, credencial Postgres con `ssl: disable` y workflow publicado; fin del RAG verificado — `gateway/nginx.conf`, `gateway/entrypoint.sh`, `.env.example`, `contexto.md` §6/§8/§9.
- 2026-11-21 — Comentarios explicativos y docstrings en backend/gateway/migraciones/pruebas (sin cambios de lógica) y guía de lectura para quien solo conoce POO — `backend/`, `gateway/`, `docker-compose.yml`, `GUIA_LECTURA_CODIGO.txt`.
- 2026-11-21 — RAG migrado de OpenRouter a Ollama local (`nomic-embed-text` + `qwen2.5:0.5b`): servicios `ollama`/`ollama-pull`, variables `OLLAMA_*`, reindexado auditado, prompt ajustado y pregunta oficial verificada — `docker-compose.yml`, `.env.example`, `backend/shared/embedding_client.py`, `n8n/workflows/rag_consulta_personas.json`, `contexto.md` §4/§5.3/§6/§8/§9, `GUIA_LECTURA_CODIGO.txt`.
