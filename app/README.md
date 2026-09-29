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

## Backend

El frontend consume la API de `facturas-app/backend` (NestJS + Supabase). Crea `app/.env` con la URL del backend (por defecto `http://localhost:3000`):

```
VITE_API_URL=http://localhost:3000
```

- **Conectado:** login, selector de empresa, Dashboard, Gastos (lista y detalle), Revisión y creación/lista de miembros en Usuarios. Ver `src/api/` (cliente, mappers, planificador de sincronización y endpoints), `src/state/Auth.tsx` y `src/state/AppState.tsx`.
- **Sigue como demostración:** proveedores, categorías, configuración de empresa, proyectos/pedidos, reportes y notificaciones (`src/data/`), y en Usuarios cambiar rol, suspender y reenviar.
- Proyecto, proveedor, RUC y medio de pago de un gasto se editan solo en pantalla: el backend aún no tiene endpoint para ellos.
- El espacio "Gastos personales" está oculto: el backend modela lo personal como un flag por gasto, no como una empresa.
- Los permisos por rol (`PERMS` en `src/data/org.ts`) solo ocultan navegación; el backend valida el acceso por empresa con el rol de `usuario_empresas.rol`.
- La sesión (token) vive en `localStorage` (`siregg-token`, `siregg-session`); tema, empresa y pantalla en `siregg-ui`.
- `npm test` corre los tests de `src/api` y `src/data`.
