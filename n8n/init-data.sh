#!/bin/sh
# Importa el workflow RAG al contenedor de n8n (ejecutar desde la raíz del repo).
# Requiere credencial PostgreSQL ya creada en la UI de n8n con nombre
# "gestion_personas" y apuntando a postgres-db:5432/gestion_personas.
set -e

docker compose exec -T n8n n8n import:workflow \
  --input=/home/node/.n8n/workflows/rag_consulta_personas.json

echo "Workflow importado. Actívalo desde la UI de n8n y selecciona la credencial PostgreSQL."
