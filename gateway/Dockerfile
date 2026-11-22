FROM nginx:1.27-alpine

# apache2-utils aporta htpasswd: el basic auth de /n8n/ se genera al arrancar
# desde N8N_USER / N8N_PASSWORD, sin guardar secretos en la imagen.
RUN apk add --no-cache apache2-utils

RUN mkdir -p /etc/nginx/includes
COPY nginx.conf /etc/nginx/nginx.conf
COPY proxy.conf /etc/nginx/includes/proxy.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
