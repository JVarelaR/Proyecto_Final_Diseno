# Imagen base para la SPA (React + Vite). El código de la interfaz se agregará
# en una fase posterior; este Dockerfile deja el perfil `ui` listo para usarse.
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
