# Guía de despliegue de SIREGG en el VPS

**Dominio:** `https://sisreg.sublitex.pe`  
**Servidor:** VPS de producción `178.156.246.18`  
**Usuario Linux del proyecto:** `siregg`  
**Tiempo estimado:** 30–45 minutos la primera vez; 5 minutos cada actualización.

Esta guía sigue el esquema estándar del servidor: **Nginx en el host** recibe el dominio y el SSL, y **Docker** corre la aplicación en puertos locales (`127.0.0.1`). Nginx no se toca en los despliegues normales.

---

## 0. Qué es SIREGG y cómo queda montado

SIREGG son dos piezas, cada una en su repositorio:

| Pieza | Repositorio | Contenedor | Puerto local |
| --- | --- | --- | --- |
| Backend (API NestJS + bot de Telegram) | `goldz9999/facturas-app` (carpeta `backend/`) | `backend` | `127.0.0.1:3100` |
| Panel web (React) | `goldz9999/SIREGG` (carpeta `app/`) | `frontend` | `127.0.0.1:3101` |

Nginx las publica en un solo dominio:

```
https://sisreg.sublitex.pe/        →  127.0.0.1:3101  (panel)
https://sisreg.sublitex.pe/api/…   →  127.0.0.1:3100  (backend; Nginx quita el prefijo /api)
```

El `docker-compose.yml` que levanta las dos piezas está en la **raíz del repo SIREGG** y construye el backend desde la carpeta vecina `../facturas-app/backend`. Por eso **los dos repos tienen que estar clonados uno al lado del otro.**

La base de datos está en **Supabase** (proyecto `SIREGG`), fuera del VPS. No hay base de datos en el servidor.

---

## 1. Antes de empezar: qué pedir

Pídele a Adrian (propietario del sistema) estos datos. **No los pegues en chats públicos ni los subas a Git.**

| Variable | Qué es | Dónde se obtiene |
| --- | --- | --- |
| `SUPABASE_KEY` | Clave **service_role** del proyecto Supabase `SIREGG` | Supabase → proyecto SIREGG → Project Settings → API Keys → `service_role`. **No** la `anon`. |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | El que ya usaba el backend (o BotFather). |
| `GEMINI_API_KEY` | Clave de Google Gemini (lectura de facturas) | La que ya usaba el backend. |
| `GEMINI_MODEL` | Modelo de Gemini | El que ya usaba el backend. |

Estas dos las generas tú en el servidor (paso 5):

| Variable | Cómo |
| --- | --- |
| `JWT_SECRET` | `openssl rand -hex 48` |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -hex 24` |

También necesitas:
- Acceso SSH como `siregg` al VPS.
- Que alguien con **`sudo`** haga el paso 7 (Nginx + SSL), si tú no tienes `sudo`.
- Acceso al panel DNS del dominio `sublitex.pe` (o que alguien cree el registro del paso 2).

---

## 2. DNS (una sola vez)

En el panel DNS de `sublitex.pe`, crea:

| Tipo | Nombre | Valor | TTL |
| --- | --- | --- | --- |
| A | `sisreg` | `178.156.246.18` | el que venga por defecto |

**Comprobar** (desde tu computadora; puede tardar unos minutos en propagarse):

```bash
ping sisreg.sublitex.pe
```

Debe responder `178.156.246.18`. **No sigas con el paso 7 hasta que esto funcione**, porque certbot lo necesita para emitir el certificado.

---

## 3. Conectarse al servidor

```bash
ssh siregg@178.156.246.18
```

**Comprobar** que Docker funciona sin `sudo`:

```bash
docker ps
```

Debe mostrar una tabla (aunque sea con contenedores de otros proyectos), sin error de permisos.

---

## 4. Descargar el código (una sola vez)

```bash
mkdir -p ~/app_despliegue && cd ~/app_despliegue
git clone -b claude/vibrant-cray-sl4nla git@github.com:goldz9999/SIREGG.git
git clone -b claude/vibrant-cray-sl4nla git@github.com:goldz9999/facturas-app.git
ls
```

**Comprobar:** `ls` debe mostrar `SIREGG` y `facturas-app` **en la misma carpeta**.

> **Rama:** por ahora los cambios están en la rama `claude/vibrant-cray-sl4nla`. Cuando se mezclen los PR a `main`, cambia ambos repos con `git checkout main && git pull`.

> **Si `git clone` da `Permission denied (publickey)`:** la clave de despliegue global del VPS no tiene acceso a estos repos (son de la cuenta `goldz9999`, no de la organización). Pídele a Adrian que la agregue en GitHub, en **cada** repo: Settings → Deploy keys → Add deploy key (solo lectura), con la clave pública del VPS (`/etc/ssh/github_deploy_key.pub`, la puede leer un administrador).

---

## 5. Variables de entorno (una sola vez)

```bash
cd ~/app_despliegue/SIREGG
cp .env.example .env
openssl rand -hex 48     # copia el resultado para JWT_SECRET
openssl rand -hex 24     # copia el resultado para TELEGRAM_WEBHOOK_SECRET
nano .env
```

El `.env` debe quedar así (con los valores reales):

```ini
DOMINIO=sisreg.sublitex.pe

BACKEND_PORT=3100
FRONTEND_PORT=3101

SUPABASE_URL=https://bqcfsgdlhzjstzbfbner.supabase.co
SUPABASE_KEY=<service_role de Supabase>

JWT_SECRET=<resultado de openssl rand -hex 48>

TELEGRAM_BOT_TOKEN=<token del bot>
TELEGRAM_WEBHOOK_SECRET=<resultado de openssl rand -hex 24>

GEMINI_API_KEY=<clave de Gemini>
GEMINI_MODEL=<modelo de Gemini>
```

Guarda con `Ctrl + O`, `Enter`, y sal con `Ctrl + X`.

**Comprobar que los puertos están libres:**

```bash
ss -ltnp | grep -E ':3100|:3101' || echo "libres"
```

Debe decir `libres`. Si alguno está ocupado por otro proyecto, elige otros puertos libres (por ejemplo 3110 y 3111), cámbialos en `BACKEND_PORT` / `FRONTEND_PORT` del `.env` **y avísale a quien haga el paso 7**, porque también van en la configuración de Nginx.

> El `.env` **nunca** se sube a Git (ya está en `.gitignore`).

---

## 6. Construir y levantar los contenedores

```bash
cd ~/app_despliegue/SIREGG
docker compose up -d --build
```

La primera vez tarda unos minutos (descarga imágenes y compila).

**Comprobar:**

```bash
docker compose ps
```

`siregg-backend-1` y `siregg-frontend-1` deben estar en **Up** (no en *Restarting*).

```bash
curl -s http://127.0.0.1:3100/health
```

Debe responder `{"ok":true}`.

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3101/
```

Debe responder `200`.

**Revisar los logs del backend:**

```bash
docker compose logs --tail=50 backend
```

Debe verse `Backend corriendo en http://localhost:3000` y ningún error en rojo. `Ctrl + C` si usaste `-f`.

Si el backend está en *Restarting*, ve a la sección **Problemas** (casi siempre es una variable del `.env`).

---

## 7. Nginx + SSL (una sola vez, requiere `sudo`)

Esto lo hace el administrador del VPS. **Antes**, el DNS del paso 2 debe responder.

```bash
sudo cp /home/siregg/app_despliegue/SIREGG/deploy/nginx/sisreg.sublitex.pe.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/sisreg.sublitex.pe.conf /etc/nginx/sites-enabled/
sudo nginx -t
```

`nginx -t` debe decir `syntax is ok` y `test is successful`. Si no, **no recargues**: revisa el mensaje.

> Si en el paso 5 cambiaste los puertos, edita `/etc/nginx/sites-available/sisreg.sublitex.pe.conf` y reemplaza `3100` y `3101` por los tuyos antes de seguir.

```bash
sudo systemctl reload nginx
sudo certbot --nginx -d sisreg.sublitex.pe
```

Certbot pide un correo (la primera vez en el servidor) y agrega el HTTPS y la redirección de HTTP a HTTPS.

**Comprobar desde tu computadora:**

```bash
curl -s https://sisreg.sublitex.pe/api/health
```

Debe responder `{"ok":true}`. Abre `https://sisreg.sublitex.pe` en el navegador: debe aparecer el login de SIREGG con el candado de HTTPS.

---

## 8. Conectar el bot de Telegram

1. Entra a `https://sisreg.sublitex.pe` con la cuenta del **propietario** (pídele el acceso a Adrian).
2. Ve a **Configuración** (abajo en la barra lateral) → **Bot de Telegram**.
3. En **Dirección del backend** escribe:
   ```
   https://sisreg.sublitex.pe/api
   ```
4. Pulsa **Conectar bot**.

**Comprobar:** en "Estado del bot" debe decir **Conectado** y "Recibe mensajes en" `https://sisreg.sublitex.pe/api/facturas/telegram/webhook`. Manda una foto de prueba al bot desde una cuenta autorizada: debe responder y el gasto debe aparecer en el panel sin recargar.

> Esto deja de enviar los mensajes del bot al servidor anterior (Railway). Si Railway sigue encendido, ya no recibirá mensajes.

---

## 9. Lista final de verificación

- [ ] `ping sisreg.sublitex.pe` → `178.156.246.18`
- [ ] `docker compose ps` → backend y frontend en **Up**
- [ ] `https://sisreg.sublitex.pe/api/health` → `{"ok":true}`
- [ ] `https://sisreg.sublitex.pe` carga con candado y permite iniciar sesión
- [ ] Bot de Telegram en **Conectado**, sin "Último error"
- [ ] Una foto enviada al bot aparece en **Gastos** sola (sin recargar la página)

---

## 10. Actualizar a una versión nueva (despliegue normal)

```bash
ssh siregg@178.156.246.18

cd ~/app_despliegue/facturas-app
git status
git pull

cd ~/app_despliegue/SIREGG
git status
git pull

nano .env                                  # solo si la versión trae variables nuevas
docker compose up -d --build
docker compose logs -f --tail=50 backend   # Ctrl + C para salir
docker compose ps                          # ambos en "Up"
```

- Nginx **no se toca**.
- Si solo cambió el panel: `docker compose up -d --build frontend`.
- Si solo cambió el backend: `docker compose up -d --build backend`.
- Limpieza de imágenes viejas (opcional): `docker image prune -f`.

---

## 11. Volver a la versión anterior (rollback)

Si una actualización falla y hay que volver rápido:

```bash
cd ~/app_despliegue/SIREGG && git log --oneline -5        # anota el commit bueno anterior
git checkout <commit-bueno>
cd ~/app_despliegue/facturas-app && git log --oneline -5
git checkout <commit-bueno>
cd ~/app_despliegue/SIREGG && docker compose up -d --build
```

Cuando se corrija, vuelve a la rama con `git checkout claude/vibrant-cray-sl4nla && git pull` (o `main`) en ambos repos y despliega de nuevo.

> Las migraciones de la base de datos (carpeta `facturas-app/backend/supabase/migrations/`) ya están aplicadas en Supabase y no se revierten con el rollback de código.

---

## 12. Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| `backend` en *Restarting* | Falta una variable en `.env` (`JWT_SECRET`, `SUPABASE_KEY`…) | `docker compose logs --tail=100 backend`, corrige `.env`, `docker compose up -d backend` |
| Error en `docker compose up --build` | Falló `npm`/`pnpm install` o la compilación | Lee la salida del build; si es de código, avisar al equipo y no desplegar |
| `502 Bad Gateway` en el navegador | Contenedores caídos, o puertos del `.env` distintos a los de Nginx | `docker compose ps`; comparar puertos con `/etc/nginx/sites-available/sisreg.sublitex.pe.conf` |
| El panel carga pero no deja iniciar sesión | `SUPABASE_KEY` no es la service_role, o el backend no responde | `curl https://sisreg.sublitex.pe/api/health` y logs del backend |
| Error al subir fotos grandes (413) | Límite de Nginx | La configuración trae `client_max_body_size 20m`; revisar que sea la que está activa |
| El panel no se actualiza solo con gastos nuevos | El WebSocket no pasa por Nginx | Revisar que la config activa tenga las líneas `Upgrade` / `Connection` |
| El bot no responde | Webhook no conectado o secret cambiado | Configuración → Bot de Telegram → ver "Último error" → **Conectar bot** otra vez |
| Cambié `DOMINIO` y el panel sigue llamando al anterior | El dominio se fija al compilar el panel | `docker compose up -d --build frontend` |
| `git pull` pide usuario/contraseña | Se clonó por HTTPS en vez de SSH | `git remote set-url origin git@github.com:goldz9999/<repo>.git` |
| Certbot falla | El DNS aún no apunta al VPS o el puerto 80 está cerrado | `ping sisreg.sublitex.pe`; esperar propagación y reintentar |

---

## 13. Reglas

- **Nunca** `docker compose down -v` (borra volúmenes).
- **No** uses el `docker-compose.yml` que está dentro de `facturas-app/backend/`: el de la raíz de SIREGG ya levanta el backend, y usar los dos choca (mismo nombre de proyecto y puerto).
- **Nunca** subas el `.env` a Git ni compartas su contenido.
- Todo despliegue termina revisando `docker compose ps` y los logs.

## Comandos rápidos

```bash
cd ~/app_despliegue/SIREGG
docker compose ps                          # estado
docker compose logs -f --tail=50 backend   # logs del backend
docker compose logs -f --tail=50 frontend  # logs del panel
docker compose restart backend             # reiniciar sin reconstruir
docker compose up -d --build               # reconstruir y levantar
```
