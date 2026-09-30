# Despliegue en Hetzner — sisreg.sublitex.pe

Un solo dominio con HTTPS automático:

| URL | Va a |
| --- | --- |
| `https://sisreg.sublitex.pe/` | Panel (frontend) |
| `https://sisreg.sublitex.pe/api/…` | Backend: API, tiempo real (`/api/socket.io`) y webhook de Telegram |

Tres contenedores: `backend` (NestJS), `frontend` (panel servido con Caddy) y `caddy` (entrada pública, certificado Let's Encrypt).

## 1. DNS (una sola vez)

En el panel DNS de `sublitex.pe`, crea un registro:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| A | `sisreg` | IPv4 del servidor Hetzner |

(Opcional `AAAA` con la IPv6.) Comprueba con `ping sisreg.sublitex.pe` que responde la IP del servidor antes del paso 4: Caddy necesita que el dominio ya apunte al servidor para sacar el certificado.

## 2. Servidor (una sola vez)

Ubuntu/Debian en Hetzner:

```bash
# Docker + compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # luego cierra sesión y vuelve a entrar

# Firewall: SSH, HTTP y HTTPS
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

Si usas el **Firewall de Hetzner Cloud** (consola web), abre también 80 y 443 (TCP; 443 UDP opcional).

## 3. Código

Los dos repos, uno al lado del otro, en la rama con los cambios:

```bash
mkdir -p ~/siregg && cd ~/siregg
git clone -b claude/vibrant-cray-sl4nla https://github.com/goldz9999/SIREGG.git
git clone -b claude/vibrant-cray-sl4nla https://github.com/goldz9999/facturas-app.git
```

(Cuando los PR se mezclen a `main`, usa `-b main`.)

## 4. Variables y arranque

```bash
cd ~/siregg/SIREGG/deploy
cp .env.example .env
nano .env        # completa SUPABASE_KEY, JWT_SECRET, TELEGRAM_*, GEMINI_*
docker compose up -d --build
docker compose logs -f caddy     # espera "certificate obtained successfully"
```

Abre `https://sisreg.sublitex.pe` e inicia sesión.

Comprobación rápida: `curl https://sisreg.sublitex.pe/api/health` → `{"ok":true}`.

## 5. Conectar el bot de Telegram

En el panel, como propietario: **Configuración → Bot de Telegram → Dirección del backend** → `https://sisreg.sublitex.pe/api` → **Conectar bot**.
Telegram enviará los mensajes a `https://sisreg.sublitex.pe/api/facturas/telegram/webhook`.

## Actualizar a una versión nueva

```bash
cd ~/siregg/SIREGG && git pull
cd ~/siregg/facturas-app && git pull
cd ~/siregg/SIREGG/deploy && docker compose up -d --build
docker image prune -f
```

## Si el servidor ya tiene otro proxy en 80/443

Si otra app del servidor ya usa los puertos 80/443 (nginx, Traefik, otro Caddy), no levantes el servicio `caddy`:
en `docker-compose.yml` publica `backend` y `frontend` solo en local
(`ports: ["127.0.0.1:3100:3000"]` y `["127.0.0.1:8081:8080"]`), quita el servicio `caddy`,
y en tu proxy existente apunta `sisreg.sublitex.pe/api/*` → `127.0.0.1:3100` (quitando el prefijo `/api`, con WebSocket) y el resto → `127.0.0.1:8081`.

## Problemas comunes

- **No sale el certificado**: el DNS aún no apunta al servidor o los puertos 80/443 están cerrados (ufw o firewall de Hetzner). `docker compose logs caddy`.
- **El panel no inicia sesión**: revisa `SUPABASE_KEY` (debe ser la service_role) y `docker compose logs backend`.
- **El bot no responde**: vuelve a pulsar "Conectar bot" y mira "Último error" en esa pantalla.
