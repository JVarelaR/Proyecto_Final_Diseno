#!/bin/sh
# Importa y publica el workflow RAG (ejecutar desde la raíz del repo).
set -eu

workflow_id="qNOg7qbLykYHNxen"
workflow_path="/home/node/.n8n/workflows/rag_consulta_personas.json"
postgres_user=$(docker compose exec -T postgres-db printenv POSTGRES_USER | tr -d '\r')
credential_id=$(docker compose exec -T postgres-db psql \
  -U "$postgres_user" -d n8n_db -Atc \
  "SELECT id FROM credentials_entity WHERE name = 'gestion_personas' AND type = 'postgres' LIMIT 1;" |
  tr -d '\r')

if [ -z "$credential_id" ]; then
  echo "No se encontró la credencial PostgreSQL 'gestion_personas' en n8n." >&2
  exit 1
fi

case "$credential_id" in
  *[!A-Za-z0-9_-]*)
    echo "El ID de la credencial PostgreSQL contiene caracteres inesperados." >&2
    exit 1
    ;;
esac

docker compose exec -T n8n sh -c \
  "sed 's/__POSTGRES_CREDENTIAL_ID__/$credential_id/g' '$workflow_path' > /tmp/rag_consulta_personas.json"
docker compose exec -T n8n n8n import:workflow \
  --input=/tmp/rag_consulta_personas.json
docker compose exec -T n8n rm -f /tmp/rag_consulta_personas.json
docker compose exec -T n8n n8n publish:workflow --id="$workflow_id"
