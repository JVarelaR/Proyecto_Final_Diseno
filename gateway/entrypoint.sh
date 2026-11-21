#!/bin/sh
# Genera el archivo htpasswd para /n8n/ a partir de las variables de entorno.
# n8n ya no soporta N8N_BASIC_AUTH_* en las versiones recientes, así que el
# basic auth se aplica en el gateway (único punto de entrada expuesto).
set -e

: "${N8N_USER:?Falta N8N_USER en el entorno}"
: "${N8N_PASSWORD:?Falta N8N_PASSWORD en el entorno}"

htpasswd -bc /etc/nginx/.htpasswd "$N8N_USER" "$N8N_PASSWORD"
# Los workers de Nginx corren como usuario `nginx`, no como root.
chown nginx:nginx /etc/nginx/.htpasswd
chmod 640 /etc/nginx/.htpasswd

# `exec` sustituye este script por Nginx: así Nginx recibe Ctrl+C y las señales
# de parada de Docker directamente (si no, el contenedor tardaría en apagarse).
exec /docker-entrypoint.sh nginx -g 'daemon off;'
