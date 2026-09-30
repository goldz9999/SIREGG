# SIREGG — frontend (v3)

Implementación en React + Vite + TypeScript del diseño `project/SIREGG v3.dc.html`
(dirección "fintech moderno": Geist, vidrio, degradados cian/violeta, temas claro y oscuro).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de producción en dist/
```

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `src/data/` | **Datos de demostración.** Empresas, roles/permisos, gastos generados, datos del dashboard. Es la capa a reemplazar por llamadas al backend. |
| `src/state/AppState.tsx` | Tema, empresa activa (con estado de carga al cambiar), avisos y los cambios de demostración en memoria, separados por empresa. |
| `src/components/` | Layout (barra lateral, selector de empresa, barra superior), detalle de gasto con el flujo de revisión IA, vista previa de comprobantes, modal de proyectos y controles base. |
| `src/pages/` | Una pantalla por ruta: `/dashboard`, `/revision`, `/gastos`, `/gastos/:id`, `/comprobantes`, `/proveedores`, `/proyectos`, `/categorias`, `/reportes`, `/usuarios`, `/empresa`, `/personal`. |
| `src/styles/` | `base.css` (componentes base heredados de Broadsheet), `theme.css` (tokens claro/oscuro de v3), `app.css` (layout y patrones). |

## Despliegue en un servidor propio (Hetzner)

Ver [`deploy/README.md`](../deploy/README.md): Nginx del host con `sisreg.sublitex.pe` (panel en `/`, backend en `/api`)
y los contenedores en `127.0.0.1:3100/3101`. Desde la raíz del repo: `docker compose up -d --build`.

## Despliegue en Railway (Docker)

Dos servicios en el mismo proyecto de Railway, cada uno con su Dockerfile y su `railway.json`
(el `railway.json` obliga a usar el Dockerfile en vez de Railpack):

| Servicio | Repo | Root Directory | Config file path | Variables |
| --- | --- | --- | --- | --- |
| backend | `facturas-app` | `/backend` | `/backend/railway.json` | `SUPABASE_URL`, `SUPABASE_KEY` (service_role), `JWT_SECRET`, `FRONTEND_URL` (URL pública del frontend), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL` |
| frontend | `SIREGG` | `/app` | `/app/railway.json` | `VITE_API_URL` (URL pública del backend, `https://…`) |

1. En cada servicio: *Settings → Source*: Root Directory; *Settings → Config-as-code*: la ruta del `railway.json`.
   Si el servicio ya tenía **Builder: Railpack**, el `railway.json` lo cambia a Dockerfile.
2. *Settings → Networking → Generate Domain* en los dos. Railway asigna `PORT`; no hace falta definirlo.
3. `VITE_API_URL` se incrusta al compilar: si cambia la URL del backend, hay que volver a desplegar el frontend.
   Sin esa variable el build falla a propósito.
4. `FRONTEND_URL` del backend debe ser exactamente el dominio del frontend (sin `/` final), o el navegador bloqueará las llamadas (CORS).
5. Con el backend ya publicado, en el panel: Configuración → Bot de Telegram → pega la URL del backend → Conectar bot.

Chequeo de salud: el backend responde `GET /health`; el frontend, `GET /`.
En local: `docker build --build-arg VITE_API_URL=http://localhost:3000 -t siregg-frontend . && docker run -p 8080:8080 siregg-frontend`.

## Backend

### Puesta en marcha con Supabase `SIREGG`

La base del proyecto Supabase **SIREGG** (`bqcfsgdlhzjstzbfbner`) ya tiene aplicadas
`0001_esquema_base.sql` a `0006_permiso_telegram.sql` de
`facturas-app/backend/supabase/migrations/`, el bucket privado `Facturas` y los públicos `logos-empresas` y `avatares`.

1. En `facturas-app/backend/.env` (copia de `.env.example`):
   ```
   SUPABASE_URL=https://bqcfsgdlhzjstzbfbner.supabase.co
   SUPABASE_KEY=<service_role key de SIREGG: Project Settings → API Keys>
   JWT_SECRET=<openssl rand -hex 48>
   ```
   Debe ser la **service_role** key: las tablas tienen RLS sin políticas y la anon key no ve nada.
2. `cd facturas-app/backend && npm install && npm run start:dev` (puerto 3000).
3. `cd SIREGG/app && echo VITE_API_URL=http://localhost:3000 > .env && npm install && npm run dev`.
4. Entra con un usuario de `public.usuarios` que tenga `password_hash` y filas en
   `usuario_empresas` (para una base vacía, `supabase/seed-inicial.sql` crea el primero).


El frontend consume la API de `facturas-app/backend` (NestJS + Supabase). Crea `app/.env` con la URL del backend (por defecto `http://localhost:3000`):

```
VITE_API_URL=http://localhost:3000
```

- **Todo viene del backend**, sin datos de demostración: login, empresas, Dashboard, Gastos y detalle, Revisión, Comprobantes (con las imágenes reales), Proveedores, Categorías (crear, renombrar, eliminar), Proyectos y pedidos, Reportes (exporta CSV), Usuarios (crear, cambiar rol, desactivar) y Configuración (nombre, RUC, dirección, moneda y logotipo de la organización). Ver `src/api/`, `src/state/`.
- Los avisos de la campana se calculan con los conteos reales (`/gastos/conteos`).
- Desde el detalle de un gasto se corrigen proveedor, RUC y medio de pago. El proveedor se busca por nombre en la empresa del gasto (o se crea); el RUC es del proveedor, así que corregirlo vale para todos sus gastos, y no se acepta un RUC que ya tiene otro proveedor. El medio de pago corrige el primer pago del gasto o crea uno.
- La moneda de la organización (soles o dólares) cambia el símbolo con que se muestran los montos.
- **Configuración** está al pie de la barra lateral y abre una segunda barra con: Configuración personal, Configuración de empresa, Usuarios y miembros y Bot de Telegram. "Volver" regresa a la última pantalla principal.
- **Organizaciones:** solo el propietario crea una nueva (selector de organización → "Nueva organización"); queda como su propietario.
- **A qué organizaciones entra cada usuario** (Usuarios y miembros → botón con el número de organizaciones): el propietario elige entre todas; un administrador solo entre las que administra y no puede quitar las demás. Al crear un miembro queda en la organización actual y, si quien lo crea administra varias, puede marcar otras. En las nuevas el miembro tiene el mismo rol que en la actual.
- **Cuentas autorizadas del bot** (Configuración → Bot de Telegram): el bot solo atiende a usuarios activos con ID de Telegram. Ahí se autoriza, cambia o quita el ID de cada miembro, o se da de alta a alguien que solo usa el bot (queda como Empleado). Lo hace el propietario o quien él autorice (casilla "Gestiona Telegram" en Usuarios). Nadie más que un propietario toca la cuenta de un propietario.
- **Conexión del bot** (solo propietario, misma pantalla): muestra el bot, a qué URL envía los mensajes, cuántos hay en cola y el último error. Si el backend cambia de dominio, se escribe la nueva URL (https) y se reconecta; también se puede desconectar. El token y el secret siguen en las variables de entorno del backend (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`).
- **Configuración personal:** cada usuario cambia su nombre, correo, contraseña y foto (`/auth/perfil`). Cambiar el correo o la contraseña pide la contraseña actual.
- **Quién registra gastos personales lo decide el propietario** (casilla "Gastos personales" en Usuarios, también al crear un miembro). El propietario siempre puede; el resto de roles no, salvo que el propietario lo active. Sin permiso no aparece el espacio Gastos personales ni la opción "Personal" en sus gastos, y el backend lo hace cumplir (Telegram, alta y edición de gastos).
- **Gastos personales** aparece en el selector, debajo de las organizaciones. No es una empresa: muestra tus gastos marcados como personales en todas tus organizaciones (`?ambito=personal`). Cada acción se guarda en la empresa del gasto. Proveedores, categorías y proyectos no aparecen en este espacio porque cada empresa tiene los suyos.
- Un **propietario** (en al menos una organización) ve todas las organizaciones activas y puede cambiar a cualquiera; en las que no es miembro entra como propietario.
- Los permisos por rol viven en el backend (`usuario_empresas.rol`): categorías y proveedores → propietario, administrador y contador; proyectos/pedidos → propietario, administrador y supervisor; miembros y nombre de la organización → propietario y administrador.
- La sesión (token) vive en `localStorage` (`siregg-token`, `siregg-session`); tema, empresa y pantalla en `siregg-ui`.
- `npm test` corre los tests de `src/api` y `src/data`.
