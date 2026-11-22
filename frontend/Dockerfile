# Imagen de la SPA React + Vite. Las variables VITE_* se sustituyen durante
# `npm run build`, por eso se pasan como ARG (no solo como environment).
FROM node:22-alpine AS build

ARG VITE_API_URL=/api/v1
ARG VITE_N8N_CHAT_URL=/n8n/webhook/chat-rag-consulta-personas/chat

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_N8N_CHAT_URL=$VITE_N8N_CHAT_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
