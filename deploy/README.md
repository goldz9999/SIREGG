# Despliegue en el VPS — sisreg.sublitex.pe

Sigue el esquema del servidor de producción (`178.156.246.18`):

- **Nginx en el host** recibe `sisreg.sublitex.pe` (80/443 + SSL) y reenvía a puertos locales.
- **Docker**: SIREGG corre en dos contenedores publicados solo en `127.0.0.1`.
- **Usuario Linux** del proyecto: `siregg`, con carpeta `~/app_despliegue/`.

| URL pública | Nginx reenvía a | Contenedor |
| --- | --- | --- |
| `https://sisreg.sublitex.pe/` | `127.0.0.1:3101` | `frontend` (panel) |
| `https://sisreg.sublitex.pe/api/…` | `127.0.0.1:3100` (sin `/api`) | `backend` (API, tiempo real en `/api/socket.io`, webhook de Telegram) |

---

## Primera vez (instalación)

### 1. DNS

En el DNS de `sublitex.pe`, un registro **A**: nombre `sisreg` → `178.156.246.18`.
Comprueba: `ping sisreg.sublitex.pe` debe responder esa IP.

### 2. Código (usuario `siregg`)

```bash
ssh siregg@178.156.246.18
mkdir -p ~/app_despliegue && cd ~/app_despliegue
git clone -b claude/vibrant-cray-sl4nla git@github.com:goldz9999/SIREGG.git
git clone -b claude/vibrant-cray-sl4nla git@github.com:goldz9999/facturas-app.git
```

Los dos repos deben quedar uno al lado del otro (`~/app_despliegue/SIREGG` y `~/app_despliegue/facturas-app`).
Cuando los PR se mezclen, cambia a `main` (`git checkout main` en ambos).

> Si `git clone` pide contraseña o da *Permission denied*, la clave de despliegue global del VPS aún no tiene acceso a los repos de `goldz9999`: agrégala como *Deploy key* en cada repo de GitHub (Settings → Deploy keys).

### 3. Puertos libres

```bash
ss -ltnp | grep -E ':3100|:3101' || echo "libres"
```

Si alguno está ocupado, elige otros y ponlos en `BACKEND_PORT` / `FRONTEND_PORT` del `.env` **y** en `deploy/nginx/sisreg.sublitex.pe.conf`.

### 4. Variables

```bash
cd ~/app_despliegue/SIREGG
cp .env.example .env
nano .env    # SUPABASE_KEY (service_role), JWT_SECRET, TELEGRAM_*, GEMINI_*
```

### 5. Levantar los contenedores

```bash
docker compose up -d --build
docker compose ps                         # backend y frontend en "Up"
curl -s http://127.0.0.1:3100/health      # {"ok":true}
```

### 6. Nginx + SSL (una sola vez, requiere `sudo` — lo hace el administrador del VPS)

```bash
sudo cp ~siregg/app_despliegue/SIREGG/deploy/nginx/sisreg.sublitex.pe.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/sisreg.sublitex.pe.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d sisreg.sublitex.pe
```

`certbot` agrega el bloque HTTPS y la redirección de HTTP a HTTPS.
Comprueba: `curl https://sisreg.sublitex.pe/api/health` → `{"ok":true}`.

### 7. Conectar el bot de Telegram

En el panel, como propietario: **Configuración → Bot de Telegram → Dirección del backend** →
`https://sisreg.sublitex.pe/api` → **Conectar bot**.

---

## Despliegue normal (cada versión nueva)

```bash
ssh siregg@178.156.246.18
cd ~/app_despliegue/facturas-app && git status && git pull
cd ~/app_despliegue/SIREGG && git status && git pull
nano .env                                 # solo si la versión trae variables nuevas
docker compose up -d --build
docker compose logs -f --tail=50 backend  # Ctrl + C para salir
docker compose ps                         # ambos "Up", no "Restarting"
```

Nginx no se toca: los contenedores se reemplazan en los mismos puertos.

- Solo cambió el panel: `docker compose up -d --build frontend`.
- Solo cambió el backend: `docker compose up -d --build backend`.
- **Nunca** `docker compose down -v`.
- No uses el `docker-compose.yml` de `facturas-app/backend`: este de la raíz de SIREGG ya levanta el backend (mismo nombre de proyecto y puerto).

## Problemas frecuentes

| Problema | Revisar |
| --- | --- |
| `backend` en *Restarting* | `docker compose logs --tail=100 backend`: casi siempre falta una variable en `.env` (`JWT_SECRET`, `SUPABASE_KEY`). |
| El panel carga pero no inicia sesión | `SUPABASE_KEY` debe ser la **service_role**; `curl https://sisreg.sublitex.pe/api/health`. |
| 502 Bad Gateway | Los contenedores no están arriba o los puertos del `.env` no coinciden con los de Nginx. |
| Error al subir fotos grandes (413) | `client_max_body_size` en la config de Nginx (viene en 20m). |
| El panel no se actualiza solo | El WebSocket: la config de Nginx debe tener el bloque `Upgrade`/`Connection` (ya incluido). |
| El bot no responde | Configuración → Bot de Telegram → "Último error"; vuelve a pulsar "Conectar bot". |
| Cambié `DOMINIO` y el panel sigue llamando al anterior | El dominio se incrusta al compilar: `docker compose up -d --build frontend`. |
