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

## Conectar el backend

- Los gastos salen de `generateExpenses()` en `src/data/expenses.ts` y se leen en `AppState` (`expenses`). Sustituye esa fuente por tu API; las pantallas solo consumen `useApp().expenses`.
- Las acciones (confirmar, descartar, asignar proyecto, invitar, etc.) llaman a `patchExpense` / `setEdits`, que hoy solo guardan en memoria. Ahí van las mutaciones reales.
- Los permisos por rol (`PERMS` en `src/data/org.ts`) solo ocultan navegación. El aislamiento entre empresas y los permisos deben validarse en el backend.
- Tema, empresa y pantalla se recuerdan en `localStorage` (`siregg-ui`).
