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

- **Todo viene del backend**, sin datos de demostración: login, empresas, Dashboard, Gastos y detalle, Revisión, Comprobantes (con las imágenes reales), Proveedores, Categorías (crear, renombrar, eliminar), Proyectos y pedidos, Reportes (exporta CSV), Usuarios (crear, cambiar rol, desactivar) y Configuración (renombrar la organización). Ver `src/api/`, `src/state/`.
- Los avisos de la campana se calculan con los conteos reales (`/gastos/conteos`).
- Proveedor, RUC y medio de pago de un gasto no se editan desde el panel (el backend no lo permite); RUC, dirección, logotipo y moneda de la organización no existen en el backend y no se muestran.
- El espacio "Gastos personales" no existe como organización: lo personal es un flag por gasto.
- Los permisos por rol viven en el backend (`usuario_empresas.rol`): categorías y proveedores → propietario, administrador y contador; proyectos/pedidos → propietario, administrador y supervisor; miembros y nombre de la organización → propietario y administrador.
- La sesión (token) vive en `localStorage` (`siregg-token`, `siregg-session`); tema, empresa y pantalla en `siregg-ui`.
- `npm test` corre los tests de `src/api` y `src/data`.
