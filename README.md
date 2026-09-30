# SIREGG — panel web

Panel de gestión de gastos de SIREGG (React + Vite + TypeScript). Consume la API de
[`facturas-app`](https://github.com/goldz9999/facturas-app) (NestJS + Supabase).

| Carpeta / archivo | Contenido |
| --- | --- |
| `app/` | Código del panel. Ver [`app/README.md`](app/README.md). |
| `docker-compose.yml` | Levanta panel y backend en el VPS detrás de Traefik (red `proxy-net`; requiere `../facturas-app` al lado). |
| `.env.example` | Variables del despliegue (copiar como `.env`, nunca se sube a Git). |

## Desarrollo

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm test
```

## Despliegue (VPS)

```bash
git pull                       # también en ../facturas-app
docker compose up -d --build
docker compose ps
```
