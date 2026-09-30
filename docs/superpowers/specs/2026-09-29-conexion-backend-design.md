# Conexión SIREGG (frontend) ↔ facturas-app (backend)

## Objetivo
Reemplazar los datos demo de `SIREGG/app` por la API real de `facturas-app/backend`
(NestJS + Supabase), en una primera entrega "núcleo": login, selector de empresa,
Dashboard, Gastos (lista y detalle) y Revisión. El resto de pantallas sigue como demo.

## Restricciones acordadas
- `main` del backend no se toca. Los cambios de backend van en la rama local
  `feature/roles-por-empresa` (sin push).
- Supabase es plan free: sin branches de base de datos. Las migraciones SQL quedan como
  archivos en `backend/supabase/migrations/` y las aplica el usuario en el proyecto
  vacío `SIREGG` (`bqcfsgdlhzjstzbfbner`). Nada se aplica sobre `Registrodefacturasn8n`.

## Decisiones
1. **Roles por empresa** (elegido por el usuario). El rol vive en `usuario_empresas.rol`
   con `propietario | administrador | supervisor | contador | empleado`. `super_admin`
   pasa a flag `usuarios.es_super_admin`. `usuarios.rol` se conserva hasta que el código
   lea el rol nuevo.
2. **Capa de API + mappers en el frontend** (enfoque 1): `src/api/client.ts` (fetch, JWT,
   401) y `src/api/mappers.ts` (respuesta del backend → tipo `Expense`). `AppState`
   deja de llamar a `generateExpenses`.

## Backend (rama feature/roles-por-empresa)
- Migraciones `0001_esquema_base.sql` y `0002_rol_por_empresa.sql` (ya escritas).
- `POST /auth/login` devuelve `empresas: [{ empresa_id, rol }]` además de `empresa_ids`.
- JWT lleva `empresas` (id+rol) y `es_super_admin`.
- `RolesGuard` y `@Roles(...)` leen el rol de la empresa activa (`?empresa_id=`).
- `RolUsuario` pasa a los cinco roles nuevos; `super_admin` se decide por el flag.
- Tests unitarios de guard y resolución de empresa.

## Frontend
- **Auth:** pantalla de login; token en `localStorage`; 401 → vuelve al login.
- **Empresas:** el selector se llena con las empresas del login; al cambiar se llama
  `PATCH /auth/empresa-activa` y se recarga con `?empresa_id=`. El rol por empresa
  alimenta `PERMS`. Los nombres (`Company.name`) se obtienen de `/empresas`.
- **Dashboard:** `GET /gastos/resumen` y `/gastos/conteos`. Tarjetas sin dato equivalente
  quedan como demo y se listan como pendientes.
- **Gastos:** `GET /gastos` (limite/offset) y `GET /gastos/:id`.
- **Revisión:** confirmar-confianza, confirmar-duplicado, descartar-duplicado, rechazar
  y `PATCH /gastos/:id`. Estado: `pendiente_revision` sin duplicado → `pend`;
  `posible_duplicado_de` → `dup`; resto → `ok`.
- **IDs:** la API usa numéricos; los mappers los convierten a string.
- **Config:** `VITE_API_URL` en `.env`; CORS del backend ya admite localhost.

## Fuera de alcance (esta entrega)
Proveedores, categorías, usuarios, empresa, proyectos/pedidos, reportes, notificaciones,
WebSocket en tiempo real, eliminar `usuarios.rol`.

## Pruebas
- Backend: tests unitarios de guard/JWT con datos simulados.
- Frontend: tests de mappers con respuestas reales; verificación manual contra un
  backend apuntando al proyecto Supabase `SIREGG` una vez aplicadas las migraciones.

## Riesgos
- Pantallas que muestran datos sin endpoint (p. ej. "Titular"/gastos personales, notificaciones).
- El diseño usa nombres de empresa y datos de proveedor que hay que resolver desde
  `/empresas` y `/proveedores` (lectura solamente).
