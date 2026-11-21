# AGENTS.md — Gestión de Datos Personales

Proyecto final en grupo de **Diseño de Software**: CRUD de personas con log de auditoría, SSO ROBLE, consulta en lenguaje natural (RAG en n8n), microservicios FastAPI y todo en Docker.

## 0. Antes de hacer cualquier cosa

1. **Lee `contexto.md` completo** (enunciado, rúbrica de 50 puntos, arquitectura, modelo de datos, guía ROBLE, decisiones abiertas y estado). Es la fuente de verdad.
2. Explora el repositorio real (estructura, `docker-compose.yml`, `gateway/nginx.conf`, `shared/`, migraciones). Si algo difiere de `contexto.md`, **dímelo** y propón actualizar el archivo; no asumas.
3. Si la tarea toca varios servicios o puede romper la rúbrica, **muestra un plan breve antes de editar**.

## 1. Regla de sincronización (obligatoria)

Si tu cambio modifica cualquiera de estos puntos, **actualiza `contexto.md` en la misma tarea**:

- servicios/contenedores, rutas del gateway o prefijos de routers;
- tablas, columnas, migraciones, esquema de `persona_embeddings`;
- validaciones, stack o dependencias relevantes;
- flujo de RAG o de autenticación;
- decisiones tomadas de la sección "Riesgos y decisiones abiertas";
- estado de avance (checklist de la sección 9).

Además agrega una línea al **Registro de cambios** (`AAAA-MM-DD — qué cambió — dónde`) y actualiza la fecha de "Última actualización". Al terminar, indica qué secciones de `contexto.md` modificaste. No cierres una tarea con `contexto.md` desactualizado.

## 2. Requisitos innegociables (rúbrica)

Nunca los rompas; cada uno vale puntos:

- **Auth SSO ROBLE** (4 pts): todos los endpoints protegidos con `get_current_user`.
- **CRUD + log de TODA transacción** (15 pts): crear, actualizar, borrar, consultar. La llave de búsqueda es `numero_documento`.
- **RAG en n8n** (12 pts): el chat de pregunta/respuesta debe verse en la interfaz de n8n; la pregunta y la respuesta se registran en el log (`RAG_QUERY`).
- **Un microservicio por opción del menú** (5 pts).
- **`ms-person-query` en contenedor independiente**, habilitable/deshabilitable sin afectar al resto (3 pts).
- **PostgreSQL + pgvector en su propio contenedor** (2 pts).
- **Validaciones en frontend (Zod) Y backend (Pydantic)** (4 pts). Cualquier regla nueva o cambiada va en ambos lados, idéntica.
- **Campos del formulario exactamente los del enunciado** (2 pts).
- **Consulta de log** filtrable por tipo, documento y rango de fechas (3 pts).

## 3. Stack

- Frontend: React + Vite, React Hook Form + Zod, TanStack Query.
- Backend: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 **async**, Alembic.
- BD: PostgreSQL + pgvector (Docker local y Supabase con las mismas migraciones).
- Gateway: Nginx o Traefik. Automatización/RAG: n8n self-hosted. IA: Ollama o Gemini/Groq.
- Orquestación: Docker + Docker Compose. CI: GitHub Actions.

## 4. Convenciones de backend

- Usa **siempre** `get_db` (`shared.database`) y `get_current_user` (`shared.security`) con `Depends`. **No** crees engines/sesiones de SQLAlchemy propios por servicio. Sí se usa el SDK oficial `roble` (decisión del equipo 2026-11-21): se instala en `ms-auth` y se activa con `AUTH_MODE=roble`; en `AUTH_MODE=mock` no se llama. Única excepción: `shared/roble_storage.py` usa una sesión síncrona centralizada porque el SDK exige `TokenStorage` síncrono; la tabla la crea Alembic, nunca `create_all`.
- Modelos solo desde `shared.models` (`Persona`, `PersonaEmbedding`, `TransaccionLog`). No dupliques modelos por servicio.
- Código async (`AsyncSession`, `await db.execute(...)`). Consultas con `select(...)` de SQLAlchemy 2.0.
- El `prefix` del `APIRouter` debe coincidir **exactamente** con `gateway/nginx.conf`. Si cambias uno, cambia el otro.
- Esquemas Pydantic v2 para entrada/salida; las reglas de validación están en `contexto.md` §2.3.
- Cada operación (CREATE/UPDATE/DELETE/READ) registra un evento en `ms-logs` (`transaccion_logs`). Una operación nueva sin log está incompleta.
- Cambios de esquema **solo con Alembic** (migración nueva; nunca edites migraciones ya aplicadas). Deben funcionar en Postgres local y Supabase.
- Errores HTTP claros (`404` persona no encontrada, `422` validación, `401` token inválido).

## 5. Convenciones de frontend

- Formularios con React Hook Form + Zod, validación en tiempo real; peticiones con TanStack Query.
- Enviar el token ROBLE como `Authorization: Bearer <token>` en cada llamada al gateway.
- Datepicker o entrada manual `dd-mmm-yyyy` (usar el mismo formato de mes que defina `contexto.md` §8).
- La UI llama solo al gateway, nunca directamente a un microservicio.

## 6. RAG / n8n

- Flujo: pregunta → embedding → búsqueda coseno en pgvector → LLM → `POST /api/v1/logs` (`RAG_QUERY`, `detalle: {pregunta, respuesta}`) → respuesta en el chat de n8n.
- La pregunta de prueba oficial es *"¿Cuál es el empleado más joven que se ha registrado?"*. Si tocas el RAG, verifica que sigue respondiéndola bien (ver riesgo #1 en `contexto.md`).
- Exporta/versiona los workflows de n8n en el repositorio si el equipo lo decide, y documéntalo en `contexto.md`.

## 7. Comandos útiles

Verifica en el repo cómo se llaman los servicios y archivos antes de usarlos.

```bash
docker compose up -d --build            # levantar todo
docker compose logs -f <servicio>       # logs de un servicio
docker compose stop ms-person-query     # deshabilitar la consulta (prueba de R7)
docker compose start ms-person-query    # habilitarla de nuevo
docker compose exec <servicio> alembic upgrade head   # aplicar migraciones
```

Corre las pruebas del servicio que modificaste antes de dar la tarea por terminada, y `docker compose config` si tocaste Compose.

## 8. Seguridad y límites

- Nunca subas secretos: `.env`, claves de Supabase/Gemini/Groq, credenciales de ROBLE. Usa variables de entorno y mantén `.env.example` al día.
- **Pregunta antes de**: borrar volúmenes o datos (`docker compose down -v`), tocar migraciones existentes, cambiar rutas públicas del gateway, añadir dependencias pesadas o hacer cambios que afecten a varios servicios.
- No hagas `git push`, no reescribas historial ni hagas commits salvo que te lo pida. Si te pido un commit, mensajes en español y concisos.
- No inventes endpoints, tablas ni variables de entorno: verifica en el código y en `contexto.md`.

## 9. Definición de terminado

Una tarea está terminada cuando:

- [ ] cumple lo pedido y no rompe ningún requisito de la sección 2;
- [ ] las validaciones están en Zod y Pydantic (si aplica);
- [ ] la operación queda registrada en el log (si aplica);
- [ ] las rutas coinciden con `gateway/nginx.conf`;
- [ ] pasan las pruebas y los contenedores levantan;
- [ ] `contexto.md` está actualizado (sección 1 de este archivo).

## 10. Estilo de trabajo

- Responde en **español**. Comentarios y documentación en español; los identificadores siguen los nombres existentes (`numero_documento`, `transaccion_logs`, etc.).
- Cambios pequeños y enfocados; no refactorices lo que no se pidió. Explica brevemente qué cambiaste y por qué.
- Si el enunciado y el Documento de Diseño del equipo chocan, **gana el enunciado**; avísame del conflicto.
- Si falta información, di qué falta y propón una opción razonable en vez de adivinar en silencio.
