# ---------- Etapa 1: compilar ----------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite incrusta la URL del backend al compilar: en Railway se define
# VITE_API_URL como variable del servicio (se recibe como build arg).
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "Falta VITE_API_URL (URL pública del backend, p. ej. https://api.tudominio.com)" && exit 1)
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- Etapa 2: servir los archivos ----------
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
# Railway define PORT; en local se usa 8080.
ENV PORT=8080
EXPOSE 8080
