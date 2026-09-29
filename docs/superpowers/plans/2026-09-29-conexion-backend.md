# Conexión SIREGG ↔ facturas-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los datos demo de `SIREGG/app` por la API real de `facturas-app/backend` para login, selector de empresa, Dashboard, Gastos y Revisión, con rol por empresa.

**Architecture:** El backend (rama `feature/roles-por-empresa`) pasa a leer el rol desde `usuario_empresas.rol` y expone el rol legacy (`super_admin|admin|empleado`) *derivado* de la empresa activa, de modo que guards, usuarios, gateway y Telegram siguen funcionando sin reescribirse. El frontend suma una capa `src/api/` (cliente fetch + mappers + planificador de sincronización) y un `AuthProvider`; `AppState` deja de generar datos y carga desde la API.

**Tech Stack:** NestJS 10 + Supabase (backend, jest/ts-jest para tests nuevos) · React 18 + Vite 5 + TypeScript (frontend, vitest para tests nuevos).

**Spec:** `SIREGG/docs/superpowers/specs/2026-09-29-conexion-backend-design.md`

## Global Constraints

- `main` de `facturas-app` no se toca; todo el backend va en la rama local `feature/roles-por-empresa`, sin push.
- Ninguna migración se aplica sobre `Registrodefacturasn8n`. Las migraciones las aplica el usuario en el proyecto Supabase `SIREGG` (`bqcfsgdlhzjstzbfbner`, plan free, sin branches de BD).
- El frontend de esta entrega conecta solo: login, selector de empresa, Dashboard, Gastos (lista/detalle) y Revisión. Proveedores, categorías, usuarios, empresa, proyectos, reportes y notificaciones siguen como demo.
- Roles por empresa: `propietario | administrador | supervisor | contador | empleado`. `super_admin` es el flag `usuarios.es_super_admin`.
- IDs de la API son numéricos; en el frontend son `string` (`String(id)`).
- Rutas: backend `C:\Users\adria\Desktop\Github Clone\facturas-app\backend`, frontend `C:\Users\adria\Desktop\Github Clone\SIREGG\app`.
- Los mensajes de commit terminan con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- El texto de UI va en español.

## Review Focus

- Usuario sin ninguna empresa asignada: el backend no debe darle rol de admin ni acceso; el frontend debe mostrar "sin empresas" en vez de romperse. (Task B2, Task F3)
- `usuario_empresas.rol` nulo o fila legacy sin migrar: se cae al rol global (`admin`→administrador, resto→empleado), nunca a un rol más alto. (Task B1)
- Gasto con relaciones vacías (sin categoría, proveedor, pagos, evidencias) y `monto` como string (`"12.50"`, así lo devuelve PostgREST para `numeric`). (Task F2)
- Sesión que expira a mitad de uso (401) y backend caído (fetch rechazado): el cliente limpia el token y vuelve al login / lanza un error legible. (Task F1)
- Dashboard con empresa sin gastos (`resumen` vacío) o si `resumen` falló (`null`): no debe lanzar excepción. (Task F5)

---

## Task 0: Aplicar las migraciones (lo hace el usuario)

No es código; sin esto las tareas B2/B3 fallan contra una BD real (sus tests usan mocks y pasan igual).

- [ ] **Step 1:** En Supabase → proyecto **SIREGG** → SQL Editor, ejecutar en orden `backend/supabase/migrations/0001_esquema_base.sql` y luego `0002_rol_por_empresa.sql`.
- [ ] **Step 2:** Ejecutar `backend/supabase/seed-dev.sql` (lo crea Task B5). Deja el usuario `lucia@siregg.dev` / `Siregg123`, dos empresas y gastos de prueba.
- [ ] **Step 3:** Copiar `SUPABASE_URL` y la service-role key del proyecto SIREGG a `backend/.env` (no se commitea).

---

# Backend (repo `facturas-app`, rama `feature/roles-por-empresa`)

### Task B1: Jest y helpers puros de rol por empresa

**Files:**
- Modify: `backend/package.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/src/auth/roles-empresa.ts`
- Test: `backend/src/auth/roles-empresa.spec.ts`

**Interfaces:**
- Produces (todos exportados desde `src/auth/roles-empresa.ts`):
  - `ROLES_EMPRESA` (`readonly ['propietario','administrador','supervisor','contador','empleado']`), `type RolEmpresa`, `interface EmpresaRol { empresa_id: number; rol: RolEmpresa }`
  - `esRolEmpresa(v: unknown): v is RolEmpresa`
  - `esSuperAdmin(fila: { es_super_admin?: boolean | null; rol: string }): boolean`
  - `rolLegacy(esSuper: boolean, rolEmpresa: RolEmpresa | null): 'super_admin' | 'admin' | 'empleado'`
  - `rolEmpresaDesdeLegacy(rol: string): RolEmpresa`
  - `rolEmpresaActualizado(actual: RolEmpresa, legacyNuevo: string): RolEmpresa`
  - `empresasDeFilas(filas: { empresa_id: number; rol?: string | null }[] | null, rolGlobal: string): EmpresaRol[]`
  - `elegirEmpresaActiva(empresas: EmpresaRol[], empresaIdQuery: string | undefined, ultimaEmpresaId: number | null): EmpresaRol | null`

- [ ] **Step 1: Instalar jest**

Run (en `backend/`): `pnpm add -D jest@29 ts-jest@29 @types/jest@29 @nestjs/testing@10`

En `package.json` agregar en `"scripts"`: `"test": "jest"` y al final del objeto raíz:

```json
"jest": {
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "moduleFileExtensions": ["js", "json", "ts"],
  "transform": { "^.+\\.ts$": "ts-jest" },
  "testEnvironment": "node"
}
```

- [ ] **Step 2: Excluir specs del build**

Crear `backend/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Escribir el test que falla**

`backend/src/auth/roles-empresa.spec.ts`:

```ts
import {
    elegirEmpresaActiva,
    EmpresaRol,
    empresasDeFilas,
    esRolEmpresa,
    esSuperAdmin,
    rolEmpresaActualizado,
    rolEmpresaDesdeLegacy,
    rolLegacy,
} from './roles-empresa';

const empresas: EmpresaRol[] = [
    { empresa_id: 1, rol: 'contador' },
    { empresa_id: 2, rol: 'propietario' },
];

describe('rolLegacy', () => {
    it('super_admin gana sobre cualquier rol de empresa', () => {
        expect(rolLegacy(true, 'empleado')).toBe('super_admin');
        expect(rolLegacy(true, null)).toBe('super_admin');
    });
    it('propietario y administrador equivalen a admin', () => {
        expect(rolLegacy(false, 'propietario')).toBe('admin');
        expect(rolLegacy(false, 'administrador')).toBe('admin');
    });
    it('supervisor, contador, empleado y sin empresa equivalen a empleado', () => {
        expect(rolLegacy(false, 'supervisor')).toBe('empleado');
        expect(rolLegacy(false, 'contador')).toBe('empleado');
        expect(rolLegacy(false, 'empleado')).toBe('empleado');
        expect(rolLegacy(false, null)).toBe('empleado');
    });
});

describe('rolEmpresaDesdeLegacy', () => {
    it('empleado se queda empleado; admin y super_admin pasan a administrador', () => {
        expect(rolEmpresaDesdeLegacy('empleado')).toBe('empleado');
        expect(rolEmpresaDesdeLegacy('admin')).toBe('administrador');
        expect(rolEmpresaDesdeLegacy('super_admin')).toBe('administrador');
    });
    it('un valor desconocido cae al rol más bajo', () => {
        expect(rolEmpresaDesdeLegacy('cualquier-cosa')).toBe('empleado');
    });
});

describe('rolEmpresaActualizado', () => {
    it('conserva el rol fino si la clase legacy no cambia', () => {
        expect(rolEmpresaActualizado('propietario', 'admin')).toBe('propietario');
        expect(rolEmpresaActualizado('contador', 'empleado')).toBe('contador');
    });
    it('cambia cuando la clase legacy cambia', () => {
        expect(rolEmpresaActualizado('contador', 'admin')).toBe('administrador');
        expect(rolEmpresaActualizado('administrador', 'empleado')).toBe('empleado');
    });
});

describe('esRolEmpresa / esSuperAdmin', () => {
    it('valida los cinco roles', () => {
        expect(esRolEmpresa('contador')).toBe(true);
        expect(esRolEmpresa('admin')).toBe(false);
        expect(esRolEmpresa(null)).toBe(false);
    });
    it('super admin por flag o por rol legacy', () => {
        expect(esSuperAdmin({ es_super_admin: true, rol: 'empleado' })).toBe(true);
        expect(esSuperAdmin({ es_super_admin: false, rol: 'super_admin' })).toBe(true);
        expect(esSuperAdmin({ es_super_admin: null, rol: 'admin' })).toBe(false);
    });
});

describe('empresasDeFilas', () => {
    it('usa el rol de la fila cuando es válido', () => {
        expect(empresasDeFilas([{ empresa_id: 3, rol: 'supervisor' }], 'empleado')).toEqual([{ empresa_id: 3, rol: 'supervisor' }]);
    });
    it('rol nulo o inválido cae al rol global legacy, nunca a uno más alto', () => {
        expect(empresasDeFilas([{ empresa_id: 3, rol: null }], 'empleado')).toEqual([{ empresa_id: 3, rol: 'empleado' }]);
        expect(empresasDeFilas([{ empresa_id: 4, rol: 'basura' }], 'admin')).toEqual([{ empresa_id: 4, rol: 'administrador' }]);
    });
    it('null o vacío devuelve lista vacía', () => {
        expect(empresasDeFilas(null, 'admin')).toEqual([]);
        expect(empresasDeFilas([], 'admin')).toEqual([]);
    });
});

describe('elegirEmpresaActiva', () => {
    it('sin empresas devuelve null', () => {
        expect(elegirEmpresaActiva([], '1', 1)).toBeNull();
    });
    it('prioriza ?empresa_id si el usuario tiene acceso', () => {
        expect(elegirEmpresaActiva(empresas, '2', 1)?.empresa_id).toBe(2);
    });
    it('ignora ?empresa_id ajeno o inválido y usa la última empresa', () => {
        expect(elegirEmpresaActiva(empresas, '99', 2)?.empresa_id).toBe(2);
        expect(elegirEmpresaActiva(empresas, 'abc', 2)?.empresa_id).toBe(2);
    });
    it('sin query ni última empresa usa la primera', () => {
        expect(elegirEmpresaActiva(empresas, undefined, null)?.empresa_id).toBe(1);
    });
});
```

- [ ] **Step 4: Verificar que falla**

Run: `pnpm test -- roles-empresa`
Expected: FAIL — "Cannot find module './roles-empresa'".

- [ ] **Step 5: Implementación mínima**

`backend/src/auth/roles-empresa.ts`:

```ts
// Rol por empresa (usuario_empresas.rol). El rol "legacy" de req.user.rol
// (super_admin | admin | empleado) se DERIVA de la empresa activa para que
// RolesGuard, UsuariosController, el gateway y Telegram sigan funcionando
// sin reescribirse.

export const ROLES_EMPRESA = ['propietario', 'administrador', 'supervisor', 'contador', 'empleado'] as const;
export type RolEmpresa = (typeof ROLES_EMPRESA)[number];

export interface EmpresaRol {
    empresa_id: number;
    rol: RolEmpresa;
}

export type RolLegacy = 'super_admin' | 'admin' | 'empleado';

export function esRolEmpresa(v: unknown): v is RolEmpresa {
    return typeof v === 'string' && (ROLES_EMPRESA as readonly string[]).includes(v);
}

// El flag es_super_admin es la fuente nueva; usuarios.rol = 'super_admin'
// se sigue respetando mientras exista la columna legacy.
export function esSuperAdmin(fila: { es_super_admin?: boolean | null; rol: string }): boolean {
    return !!fila.es_super_admin || fila.rol === 'super_admin';
}

export function rolLegacy(esSuper: boolean, rolEmpresa: RolEmpresa | null): RolLegacy {
    if (esSuper) return 'super_admin';
    return rolEmpresa === 'propietario' || rolEmpresa === 'administrador' ? 'admin' : 'empleado';
}

export function rolEmpresaDesdeLegacy(rol: string): RolEmpresa {
    if (rol === 'admin' || rol === 'super_admin') return 'administrador';
    return 'empleado';
}

// Al editar el rol legacy de un usuario no se pisa un rol fino (p. ej.
// contador) si la clase legacy resultante es la misma.
export function rolEmpresaActualizado(actual: RolEmpresa, legacyNuevo: string): RolEmpresa {
    return rolLegacy(false, actual) === legacyNuevo ? actual : rolEmpresaDesdeLegacy(legacyNuevo);
}

export function empresasDeFilas(
    filas: { empresa_id: number; rol?: string | null }[] | null,
    rolGlobal: string,
): EmpresaRol[] {
    return (filas ?? []).map((f) => ({
        empresa_id: f.empresa_id,
        rol: esRolEmpresa(f.rol) ? f.rol : rolEmpresaDesdeLegacy(rolGlobal),
    }));
}

export function elegirEmpresaActiva(
    empresas: EmpresaRol[],
    empresaIdQuery: string | undefined,
    ultimaEmpresaId: number | null,
): EmpresaRol | null {
    if (empresas.length === 0) return null;
    const q = empresaIdQuery ? Number(empresaIdQuery) : NaN;
    if (Number.isInteger(q)) {
        const porQuery = empresas.find((e) => e.empresa_id === q);
        if (porQuery) return porQuery;
    }
    if (ultimaEmpresaId != null) {
        const porUltima = empresas.find((e) => e.empresa_id === ultimaEmpresaId);
        if (porUltima) return porUltima;
    }
    return empresas[0];
}
```

- [ ] **Step 6: Verificar que pasa**

Run: `pnpm test -- roles-empresa`
Expected: PASS (todos los `it`).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.build.json src/auth/roles-empresa.ts src/auth/roles-empresa.spec.ts
git commit -m "feat(auth): helpers puros de rol por empresa y jest"
```

---

### Task B2: Contexto de usuario y JwtStrategy con rol por empresa

**Files:**
- Modify: `backend/src/common/usuario-contexto.service.ts`
- Modify: `backend/src/auth/strategies/jwt.strategy.ts`
- Test: `backend/src/auth/strategies/jwt.strategy.spec.ts`

**Interfaces:**
- Consumes: `elegirEmpresaActiva`, `rolLegacy`, `empresasDeFilas`, `esSuperAdmin`, `EmpresaRol` (Task B1).
- Produces: `UsuarioContexto` gana `es_super_admin: boolean` y `empresas: EmpresaRol[]`. `req.user` gana `rol_empresa: RolEmpresa | null`, `es_super_admin: boolean`, `empresas: EmpresaRol[]`; `req.user.rol` sigue siendo `'super_admin'|'admin'|'empleado'` pero derivado de la empresa activa (`?empresa_id=`, si no `ultima_empresa_id`, si no la primera).

- [ ] **Step 1: Escribir el test que falla**

`backend/src/auth/strategies/jwt.strategy.spec.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

const config = { get: () => 'secreto-de-prueba' } as any;

function estrategia(over: Record<string, unknown> = {}) {
    const ctx = {
        obtener: jest.fn().mockResolvedValue({
            id: 1,
            email: 'a@b.pe',
            rol: 'empleado',
            activo: true,
            es_super_admin: false,
            empresa_ids: [1, 2],
            empresas: [
                { empresa_id: 1, rol: 'contador' },
                { empresa_id: 2, rol: 'administrador' },
            ],
            puede_registrar_personal: true,
            ultima_empresa_id: 1,
            ...over,
        }),
    };
    return new JwtStrategy(config, ctx as any);
}

describe('JwtStrategy.validate', () => {
    it('deriva el rol de la empresa pedida por ?empresa_id', async () => {
        const u = await estrategia().validate({ query: { empresa_id: '2' } }, { sub: 1 });
        expect(u.rol).toBe('admin');
        expect(u.rol_empresa).toBe('administrador');
    });

    it('sin query usa ultima_empresa_id', async () => {
        const u = await estrategia().validate({ query: {} }, { sub: 1 });
        expect(u.rol).toBe('empleado');
        expect(u.rol_empresa).toBe('contador');
    });

    it('super_admin conserva rol super_admin y se trata como propietario', async () => {
        const u = await estrategia({ es_super_admin: true, empresas: [], empresa_ids: [] }).validate({ query: {} }, { sub: 1 });
        expect(u.rol).toBe('super_admin');
        expect(u.rol_empresa).toBe('propietario');
        expect(u.es_super_admin).toBe(true);
    });

    it('usuario sin empresas: empleado sin rol de empresa', async () => {
        const u = await estrategia({ empresas: [], empresa_ids: [], ultima_empresa_id: null }).validate({ query: {} }, { sub: 1 });
        expect(u.rol).toBe('empleado');
        expect(u.rol_empresa).toBeNull();
        expect(u.empresa_ids).toEqual([]);
    });

    it('rechaza usuario inactivo', async () => {
        await expect(estrategia({ activo: false }).validate({ query: {} }, { sub: 1 })).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza usuario inexistente', async () => {
        const s = estrategia();
        (s as any).usuarioContexto.obtener.mockResolvedValue(null);
        await expect(s.validate({ query: {} }, { sub: 1 })).rejects.toThrow(UnauthorizedException);
    });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test -- jwt.strategy`
Expected: FAIL (`validate` recibe un solo argumento y no expone `rol_empresa`).

- [ ] **Step 3: Actualizar `UsuarioContextoService`**

En `backend/src/common/usuario-contexto.service.ts` reemplazar el import inicial, la interfaz y `obtener`:

```ts
import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { EmpresaRol, empresasDeFilas, esSuperAdmin } from '../auth/roles-empresa';

export interface UsuarioContexto {
    id: number;
    email: string | null;
    rol: string; // columna legacy usuarios.rol
    activo: boolean;
    es_super_admin: boolean;
    empresa_ids: number[];
    empresas: EmpresaRol[];
    puede_registrar_personal: boolean;
    ultima_empresa_id: number | null;
}
```

y el cuerpo de `obtener` (mantener el comentario de cabecera de la clase):

```ts
    async obtener(usuarioId: number): Promise<UsuarioContexto | null> {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('usuarios')
            .select('id, email, rol, activo, es_super_admin, puede_registrar_personal, ultima_empresa_id, usuario_empresas(empresa_id, rol)')
            .eq('id', usuarioId)
            .maybeSingle();

        if (error) throw new Error(`Error consultando usuario: ${error.message}`);
        if (!data) return null;

        const empresas = empresasDeFilas(data.usuario_empresas as any, data.rol);
        return {
            id: data.id,
            email: data.email,
            rol: data.rol,
            activo: data.activo,
            es_super_admin: esSuperAdmin(data),
            puede_registrar_personal: data.puede_registrar_personal,
            ultima_empresa_id: data.ultima_empresa_id ?? null,
            empresa_ids: empresas.map((e) => e.empresa_id),
            empresas,
        };
    }
```

- [ ] **Step 4: Actualizar `JwtStrategy`**

En `backend/src/auth/strategies/jwt.strategy.ts` agregar el import
`import { elegirEmpresaActiva, rolLegacy } from '../roles-empresa';`, agregar `passReqToCallback: true,` dentro del objeto de `super({...})` y reemplazar `validate`:

```ts
    // Paso 44: el token solo identifica al usuario (`sub`); todo lo demás se
    // lee de la base en cada request. `rol` (legacy) se deriva del rol que el
    // usuario tiene en la empresa activa de ESTE request (?empresa_id=, si no
    // ultima_empresa_id, si no la primera).
    async validate(req: { query?: Record<string, unknown> }, payload: { sub: number }) {
        const usuario = await this.usuarioContexto.obtener(payload.sub);
        if (!usuario || !usuario.activo) {
            throw new UnauthorizedException('Sesión inválida o usuario desactivado');
        }
        const q = req?.query?.empresa_id;
        const activa = elegirEmpresaActiva(usuario.empresas, typeof q === 'string' ? q : undefined, usuario.ultima_empresa_id);
        return {
            id: usuario.id,
            email: usuario.email,
            rol: rolLegacy(usuario.es_super_admin, activa?.rol ?? null),
            rol_empresa: usuario.es_super_admin ? 'propietario' : (activa?.rol ?? null),
            es_super_admin: usuario.es_super_admin,
            empresas: usuario.empresas,
            empresa_ids: usuario.empresa_ids,
            puede_registrar_personal: usuario.puede_registrar_personal,
            ultima_empresa_id: usuario.ultima_empresa_id,
        };
    }
```

- [ ] **Step 5: Verificar que pasa**

Run: `pnpm test -- jwt.strategy`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/common/usuario-contexto.service.ts src/auth/strategies/jwt.strategy.ts src/auth/strategies/jwt.strategy.spec.ts
git commit -m "feat(auth): rol por empresa en el contexto de usuario y JwtStrategy"
```

---

### Task B3: Login devuelve rol por empresa

**Files:**
- Modify: `backend/src/auth/auth.service.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `empresasDeFilas`, `esSuperAdmin`, `EmpresaRol` (Task B1).
- Produces: `UsuarioAutenticado` gana `es_super_admin: boolean` y `empresas: EmpresaRol[]`. `POST /auth/login` → `{ access_token, usuario }` con esos campos.

- [ ] **Step 1: Escribir el test que falla**

`backend/src/auth/auth.service.spec.ts`:

```ts
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

function servicio(fila: Record<string, unknown>) {
    const supabase = {
        getClient: () => ({
            from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }) }),
        }),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('tok') };
    return new AuthService(supabase as any, jwt as any);
}

const base = {
    id: 7,
    nombre: 'Lucía',
    email: 'l@x.pe',
    password_hash: bcrypt.hashSync('clave123', 4),
    rol: 'admin',
    activo: true,
    es_super_admin: false,
    puede_registrar_personal: true,
    ultima_empresa_id: 2,
    usuario_empresas: [
        { empresa_id: 2, rol: 'administrador' },
        { empresa_id: 5, rol: 'contador' },
    ],
};

describe('AuthService.login', () => {
    it('devuelve el rol por empresa y el flag de super admin', async () => {
        const r = await servicio(base).login({ email: 'l@x.pe', password: 'clave123' } as any);
        expect(r.access_token).toBe('tok');
        expect(r.usuario.empresas).toEqual([
            { empresa_id: 2, rol: 'administrador' },
            { empresa_id: 5, rol: 'contador' },
        ]);
        expect(r.usuario.empresa_ids).toEqual([2, 5]);
        expect(r.usuario.es_super_admin).toBe(false);
    });

    it('un usuario con rol legacy super_admin es super admin aunque el flag no esté', async () => {
        const r = await servicio({ ...base, rol: 'super_admin', es_super_admin: false, usuario_empresas: [] })
            .login({ email: 'l@x.pe', password: 'clave123' } as any);
        expect(r.usuario.es_super_admin).toBe(true);
        expect(r.usuario.empresas).toEqual([]);
    });

    it('fila de empresa sin rol cae al rol global legacy', async () => {
        const r = await servicio({ ...base, usuario_empresas: [{ empresa_id: 2, rol: null }] })
            .login({ email: 'l@x.pe', password: 'clave123' } as any);
        expect(r.usuario.empresas).toEqual([{ empresa_id: 2, rol: 'administrador' }]);
    });

    it('contraseña incorrecta lanza Unauthorized', async () => {
        await expect(servicio(base).login({ email: 'l@x.pe', password: 'mala' } as any)).rejects.toThrow(UnauthorizedException);
    });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `pnpm test -- auth.service`
Expected: FAIL (`r.usuario.empresas` es `undefined`).

- [ ] **Step 3: Implementar**

En `backend/src/auth/auth.service.ts`: agregar `import { EmpresaRol, empresasDeFilas, esSuperAdmin } from './roles-empresa';`, ampliar la interfaz:

```ts
export interface UsuarioAutenticado {
    id: number;
    nombre: string | null;
    email: string | null;
    rol: string;
    es_super_admin: boolean;
    empresa_ids: number[];
    empresas: EmpresaRol[];
    puede_registrar_personal: boolean;
    ultima_empresa_id: number | null;
}
```

cambiar el `.select(...)` de `login` por
`'id, nombre, email, password_hash, rol, activo, es_super_admin, puede_registrar_personal, ultima_empresa_id, usuario_empresas(empresa_id, rol)'`
y reemplazar la construcción de `usuario`:

```ts
        const empresas = empresasDeFilas(data.usuario_empresas as any, data.rol);
        const usuario: UsuarioAutenticado = {
            id: data.id,
            nombre: data.nombre,
            email: data.email,
            rol: data.rol,
            es_super_admin: esSuperAdmin(data),
            empresa_ids: empresas.map((e) => e.empresa_id),
            empresas,
            puede_registrar_personal: data.puede_registrar_personal,
            ultima_empresa_id: data.ultima_empresa_id ?? null,
        };
```

El `signAsync` no cambia (el token solo identifica al usuario).

- [ ] **Step 4: Verificar que pasa**

Run: `pnpm test -- auth.service`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/auth/auth.service.ts src/auth/auth.service.spec.ts
git commit -m "feat(auth): el login devuelve el rol por empresa"
```

---

### Task B4: UsuariosService mantiene usuario_empresas.rol sincronizado

Sin esto, un admin creado por la API quedaría con rol `empleado` en su empresa (default de la columna) y perdería permisos con la derivación de B2. La lógica de decisión ya está probada en B1; aquí solo se cablea (verificación = typecheck/build + prueba manual en Task F8).

**Files:**
- Modify: `backend/src/usuarios/usuarios.service.ts`

**Interfaces:**
- Consumes: `esRolEmpresa`, `rolEmpresaActualizado`, `rolEmpresaDesdeLegacy`, `RolEmpresa` (Task B1).
- Produces: `asignarEmpresas(usuarioId: number, empresaIds: number[], rolPorDefecto?: RolEmpresa)` conserva el rol previo de las empresas que se mantienen.

- [ ] **Step 1: Import**

Agregar arriba: `import { esRolEmpresa, RolEmpresa, rolEmpresaActualizado, rolEmpresaDesdeLegacy } from '../auth/roles-empresa';`

- [ ] **Step 2: `crear` asigna el rol inicial**

Reemplazar

```ts
            await this.asignarEmpresas(data.id, empresaIds);
```
(dentro de `crear`) por

```ts
            await this.asignarEmpresas(data.id, empresaIds, rolEmpresaDesdeLegacy(dto.rol ?? 'empleado'));
```

- [ ] **Step 3: `actualizar` sincroniza el rol**

En `actualizar`, justo después del bloque `if (Object.keys(cambios).length > 0) { ... }` y antes del comentario "Reasignar empresas", insertar:

```ts
        if (dto.rol !== undefined) {
            await this.sincronizarRolEmpresas(id, dto.rol, empresaIdPermitido);
        }
```

y reemplazar el bloque de reasignación por:

```ts
        if (dto.empresa_ids !== undefined && empresaIdPermitido === undefined) {
            const rolBase = dto.rol ?? (await this.rolGlobal(id));
            await this.asignarEmpresas(id, dto.empresa_ids, rolEmpresaDesdeLegacy(rolBase));
        }
```

- [ ] **Step 4: `asignarEmpresas` conserva roles + métodos nuevos**

Reemplazar `asignarEmpresas` completo por:

```ts
    // Reemplaza por completo la lista de empresas del usuario, CONSERVANDO el
    // rol de las empresas que se mantienen (las nuevas reciben rolPorDefecto).
    async asignarEmpresas(usuarioId: number, empresaIds: number[], rolPorDefecto: RolEmpresa = 'empleado'): Promise<void> {
        const client = this.supabaseService.getClient();

        const { data: previas, error: errorLectura } = await client
            .from('usuario_empresas')
            .select('empresa_id, rol')
            .eq('usuario_id', usuarioId);
        if (errorLectura) throw new Error(`Error reasignando empresas: ${errorLectura.message}`);
        const rolPrevio = new Map<number, RolEmpresa>(
            (previas ?? []).filter((f: any) => esRolEmpresa(f.rol)).map((f: any) => [f.empresa_id, f.rol as RolEmpresa]),
        );

        const { error: errorBorrado } = await client.from('usuario_empresas').delete().eq('usuario_id', usuarioId);
        if (errorBorrado) throw new Error(`Error reasignando empresas: ${errorBorrado.message}`);

        if (empresaIds.length === 0) return;
        const filas = empresaIds.map((empresaId) => ({
            usuario_id: usuarioId,
            empresa_id: empresaId,
            rol: rolPrevio.get(empresaId) ?? rolPorDefecto,
        }));
        const { error: errorInsert } = await client.from('usuario_empresas').insert(filas);
        if (errorInsert) throw new Error(`Error reasignando empresas: ${errorInsert.message}`);
    }

    // Aplica un cambio de rol legacy (admin/empleado) a las filas de
    // usuario_empresas sin pisar roles finos de la misma clase.
    private async sincronizarRolEmpresas(usuarioId: number, rolLegacyNuevo: string, soloEmpresaId?: number): Promise<void> {
        const client = this.supabaseService.getClient();
        let query = client.from('usuario_empresas').select('id, rol').eq('usuario_id', usuarioId);
        if (soloEmpresaId !== undefined) query = query.eq('empresa_id', soloEmpresaId);
        const { data, error } = await query;
        if (error) throw new Error(`Error leyendo roles por empresa: ${error.message}`);

        for (const fila of (data ?? []) as { id: number; rol: string | null }[]) {
            const nuevo = rolEmpresaActualizado(esRolEmpresa(fila.rol) ? fila.rol : 'empleado', rolLegacyNuevo);
            if (nuevo === fila.rol) continue;
            const { error: errorUpdate } = await client.from('usuario_empresas').update({ rol: nuevo }).eq('id', fila.id);
            if (errorUpdate) throw new Error(`Error actualizando rol por empresa: ${errorUpdate.message}`);
        }
    }

    private async rolGlobal(usuarioId: number): Promise<string> {
        const { data, error } = await this.supabaseService.getClient().from('usuarios').select('rol').eq('id', usuarioId).maybeSingle();
        if (error) throw new Error(`Error consultando el rol del usuario: ${error.message}`);
        return data?.rol ?? 'empleado';
    }
```

- [ ] **Step 5: Verificar compilación y tests**

Run: `pnpm build && pnpm test`
Expected: build sin errores de TypeScript; todos los tests previos en PASS.

- [ ] **Step 6: Commit**

```bash
git add src/usuarios/usuarios.service.ts
git commit -m "feat(usuarios): mantener usuario_empresas.rol sincronizado con el rol legacy"
```

---

### Task B5: Seed de desarrollo y nota de despliegue

**Files:**
- Create: `backend/supabase/seed-dev.sql`
- Modify: `backend/.env.example` (solo comentario)

- [ ] **Step 1: Crear el seed**

`backend/supabase/seed-dev.sql` (requiere `0001` y `0002` aplicadas; usuario `lucia@siregg.dev` / `Siregg123`):

```sql
-- Datos de prueba para desarrollo. NO ejecutar en producción.
create extension if not exists pgcrypto with schema extensions;

insert into public.empresas (nombre)
values ('Empresa Demo S.A.C.'), ('Constructora Andina S.A.C.');

insert into public.usuarios (nombre, email, password_hash, rol)
values ('Lucía Ramírez', 'lucia@siregg.dev', extensions.crypt('Siregg123', extensions.gen_salt('bf', 10)), 'admin');

insert into public.usuario_empresas (usuario_id, empresa_id, rol)
select u.id, e.id,
       case e.nombre when 'Empresa Demo S.A.C.' then 'administrador' else 'contador' end
from public.usuarios u, public.empresas e
where u.email = 'lucia@siregg.dev';

insert into public.categorias (empresa_id, nombre)
select e.id, c
from public.empresas e, unnest(array['Materiales','Transporte','Alimentación','Servicios']) as c
where e.nombre = 'Empresa Demo S.A.C.';

insert into public.gastos
  (usuario_id, empresa_id, categoria_id, es_personal, descripcion, monto, fecha, confianza, pendiente_revision, usuario_nombre)
select u.id, e.id,
       (select c.id from public.categorias c where c.empresa_id = e.id and c.nombre = g.cat),
       g.personal, g.descr, g.monto, current_date - g.dias, g.conf, g.pend, u.nombre
from public.empresas e
join public.usuarios u on u.email = 'lucia@siregg.dev'
cross join (values
  ('Materiales',   'Cemento y fierro para almacén', 1240.00, 1,  'alta',  false, false),
  ('Transporte',   'Taxi a reunión',                  28.90, 2,  'alta',  false, false),
  ('Transporte',   'Taxi a reunión (duplicado)',      28.90, 2,  'media', true,  false),
  ('Alimentación', 'Almuerzo de equipo',              96.00, 3,  'media', true,  false),
  ('Servicios',    'Hosting anual',                  389.00, 5,  'alta',  false, false),
  ('Alimentación', 'Almuerzo personal',               32.00, 6,  'alta',  false, true)
) as g(cat, descr, monto, dias, conf, pend, personal)
where e.nombre = 'Empresa Demo S.A.C.';

update public.gastos d
set posible_duplicado_de = o.id
from public.gastos o
where d.descripcion = 'Taxi a reunión (duplicado)'
  and o.descripcion = 'Taxi a reunión'
  and o.empresa_id = d.empresa_id;
```

- [ ] **Step 2: Nota en `.env.example`**

Debajo de la sección `# --- Auth ---` agregar la línea:
`# Requiere aplicar supabase/migrations/0001 y 0002 antes de arrancar (rol por empresa).`

- [ ] **Step 3: Verificación final del backend**

Run: `pnpm build && pnpm test`
Expected: build OK, todos los tests en PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed-dev.sql .env.example
git commit -m "chore: seed de desarrollo y nota de migraciones"
```

---

# Frontend (repo `SIREGG`, rama nueva `feature/conexion-backend`)

### Task F0: Rama, dependencias de test y entorno

**Files:**
- Modify: `app/package.json`, `app/vite.config.ts`
- Create: `app/.env.example`

- [ ] **Step 1: Crear la rama y guardar spec y plan**

Run (en `SIREGG/`):

```bash
git checkout -b feature/conexion-backend
git add docs
git commit -m "docs: spec y plan de la conexión con el backend"
```

- [ ] **Step 2: Instalar vitest**

Run (en `SIREGG/app/`): `npm i -D vitest@^2`

En `package.json` agregar en `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 3: Configurar vitest**

`app/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] **Step 4: `.env.example`**

`app/.env.example`:

```
# URL del backend (facturas-app). Sin barra final.
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/vite.config.ts app/.env.example
git commit -m "chore: vitest y variable VITE_API_URL"
```

---

### Task F1: Cliente HTTP

**Files:**
- Create: `app/src/api/client.ts`
- Test: `app/src/api/client.test.ts`

**Interfaces:**
- Produces: `api<T>(path: string, opts?: { method?: 'GET'|'POST'|'PATCH'|'DELETE'; body?: unknown; query?: Record<string, string|number|boolean|undefined> }): Promise<T>`; `class ApiError extends Error { status: number }` (`status` 0 = sin conexión); `getToken(): string|null`; `setToken(t: string): void`; `clearToken(): void`; `setUnauthorizedHandler(fn: (() => void) | null): void`.

- [ ] **Step 1: Escribir el test que falla**

`app/src/api/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, clearToken, getToken, setToken, setUnauthorizedHandler } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => { clearToken(); setUnauthorizedHandler(null); });
afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('agrega Authorization y omite parámetros undefined', async () => {
    setToken('abc');
    const f = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', f);
    await api('/gastos', { query: { empresa_id: 3, limite: 50, desde: undefined } });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3000/gastos?empresa_id=3&limite=50');
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('serializa el body como JSON', async () => {
    const f = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal('fetch', f);
    await api('/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } });
    const [, init] = f.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"email":"a","password":"b"}');
  });

  it('401 limpia el token, avisa y lanza ApiError', async () => {
    setToken('abc');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { message: 'Credenciales inválidas' })));
    await expect(api('/gastos')).rejects.toMatchObject({ status: 401, message: 'Credenciales inválidas' });
    expect(getToken()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('une los mensajes de validación de Nest (array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { message: ['monto debe ser número', 'fecha inválida'] })));
    await expect(api('/gastos/1', { method: 'PATCH', body: {} })).rejects.toMatchObject({
      status: 400,
      message: 'monto debe ser número, fecha inválida',
    });
  });

  it('backend caído: ApiError legible con status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await api('/gastos').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toBe('No se pudo conectar con el servidor.');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test`
Expected: FAIL — "Failed to resolve import './client'".

- [ ] **Step 3: Implementar**

`app/src/api/client.ts`:

```ts
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN_KEY = 'siregg-token';

let memToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  if (memToken) return memToken;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string) {
  memToken = t;
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* solo en memoria */ }
}
export function clearToken() {
  memToken = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* nada que limpiar */ }
}
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

type Query = Record<string, string | number | boolean | undefined>;
interface Options { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Query }

async function messageOf(res: Response, fallback: string): Promise<string> {
  try {
    const m = (await res.json())?.message;
    return Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : fallback;
  } catch {
    return fallback;
  }
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }

  if (res.status === 401) {
    const msg = await messageOf(res, 'Sesión expirada');
    clearToken();
    onUnauthorized?.();
    throw new ApiError(401, msg);
  }
  if (!res.ok) throw new ApiError(res.status, await messageOf(res, 'Error ' + res.status));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test`
Expected: PASS (5 tests de `client.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add app/src/api/client.ts app/src/api/client.test.ts
git commit -m "feat(api): cliente HTTP con JWT y manejo de 401"
```

---

### Task F2: Tipos de API, mappers, planificador de sincronización y endpoints

**Files:**
- Create: `app/src/api/types.ts`, `app/src/api/mappers.ts`, `app/src/api/sync.ts`, `app/src/api/endpoints.ts`
- Modify: `app/src/data/types.ts` (Evidence gana `url`)
- Test: `app/src/api/mappers.test.ts`, `app/src/api/sync.test.ts`

**Interfaces:**
- Consumes: `api` (Task F1); tipos `Company`, `Expense`, `Evidence`, `Role`, `Status` de `data/types`.
- Produces:
  - `mapRole(r: RolEmpresa): Role`, `initialsOf(name: string): string`, `mapCompany(e: ApiEmpresa, rol: RolEmpresa): Company`, `mapGasto(g: ApiGasto): Expense`
  - `planSync(cur: Expense, p: Partial<Expense>, cats: { id: number; nombre: string }[]): SyncPlan` con `SyncPlan = {kind:'none'} | {kind:'confirmarConfianza'} | {kind:'confirmarDuplicado'} | {kind:'descartarDuplicado'} | {kind:'patch'; body: PatchBody}`
  - `endpoints`: `login(email, password)`, `me()`, `empresasMias()`, `setEmpresaActiva(empresaId)`, `listGastos(empresaId)`, `resumen(empresaId)`, `conteos(empresaId)`, `categorias(empresaId)`, `patchGasto(id, empresaId, body)`, `confirmarConfianza(id, empresaId)`, `confirmarDuplicado(id, empresaId)`, `descartarDuplicado(id, empresaId)`, `rechazar(id, empresaId)`

- [ ] **Step 1: Tipos de la API**

`app/src/api/types.ts`:

```ts
export type RolEmpresa = 'propietario' | 'administrador' | 'supervisor' | 'contador' | 'empleado';

export interface ApiUsuario {
  id: number;
  nombre?: string | null;
  email: string | null;
  rol: string;
  es_super_admin: boolean;
  empresa_ids: number[];
  empresas: { empresa_id: number; rol: RolEmpresa }[];
  puede_registrar_personal: boolean;
  ultima_empresa_id: number | null;
}
export interface ApiLogin { access_token: string; usuario: ApiUsuario }

export interface ApiEmpresa { id: number; nombre: string; activa: boolean; logo_url: string | null }
export interface ApiCategoria { id: number; nombre: string; empresa_id: number }

export interface ApiGasto {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  empresa_id: number | null;
  es_personal: boolean;
  descripcion: string | null;
  monto: number | string; // PostgREST devuelve numeric como número o string
  fecha: string; // YYYY-MM-DD
  confianza: string | null;
  pendiente_revision: boolean;
  posible_duplicado_de: number | null;
  categorias: { nombre: string } | null;
  proveedores: { nombre: string } | null;
  pedidos: { nombre: string } | null;
  comprobantes: { id: number; numero: string | null; tipo: string }[];
  pagos: { id: number; medio: string; numero_operacion: string | null }[];
  evidencias: { id: number; tipo: string; origen: string; storage_path: string; url?: string | null }[];
}

export interface ApiResumen {
  today: number;
  week: number;
  month: number;
  company: number;
  personal: number;
  topCategorias: { id: number; nombre: string; cantidad: number }[];
  topProveedores: { id: number; nombre: string; cantidad: number }[];
  recientes: ApiGasto[];
  tendenciaDiaria: { fecha: string; total: number }[];
}

export interface ApiConteos {
  todos: number;
  empresa: number;
  personal: number;
  requiereRevision: number;
  posibleDuplicado: number;
  duplicadoConfirmado: number;
  sinComprobante: number;
}
```

En `app/src/data/types.ts`, cambiar `Evidence` por:

```ts
export interface Evidence {
  k: EvidenceKind;
  file: string;
  /** URL firmada de la imagen real (solo datos del backend). */
  url?: string | null;
}
```

- [ ] **Step 2: Escribir el test de mappers (falla)**

`app/src/api/mappers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialsOf, mapCompany, mapGasto, mapRole } from './mappers';
import type { ApiGasto } from './types';

const gasto = (over: Partial<ApiGasto> = {}): ApiGasto => ({
  id: 12, usuario_id: 1, usuario_nombre: 'Lucía Ramírez', empresa_id: 1, es_personal: false,
  descripcion: 'Cemento', monto: '1240.50', fecha: '2026-09-28', confianza: 'alta',
  pendiente_revision: false, posible_duplicado_de: null,
  categorias: { nombre: 'Materiales' }, proveedores: { nombre: 'Sodimac' }, pedidos: null,
  comprobantes: [{ id: 1, numero: 'F001-23', tipo: 'factura' }],
  pagos: [{ id: 1, medio: 'yape', numero_operacion: '998877' }],
  evidencias: [{ id: 1, tipo: 'imagen', origen: 'telegram', storage_path: 'a.webp', url: 'https://x/a.webp' }],
  ...over,
});

describe('mapGasto', () => {
  it('convierte un gasto completo', () => {
    const e = mapGasto(gasto());
    expect(e).toMatchObject({
      id: '12', desc: 'Cemento', prov: 'Sodimac', cat: 'Materiales', type: 'Empresarial',
      amt: 1240.5, st: 'ok', user: 'Lucía Ramírez', pay: 'Yape', op: '998877', dupOf: null, proj: '',
    });
    expect(e.date.getFullYear()).toBe(2026);
    expect(e.date.getMonth()).toBe(8);
    expect(e.date.getDate()).toBe(28);
    expect(e.ev.map((x) => x.k)).toEqual(['Factura', 'Yape', 'Foto']);
    expect(e.ev[2].url).toBe('https://x/a.webp');
  });

  it('estados: pendiente, duplicado pendiente, duplicado confirmado', () => {
    expect(mapGasto(gasto({ pendiente_revision: true })).st).toBe('pend');
    const dup = mapGasto(gasto({ pendiente_revision: true, posible_duplicado_de: 9 }));
    expect(dup.st).toBe('dup');
    expect(dup.dupOf).toBe('9');
    expect(mapGasto(gasto({ pendiente_revision: false, posible_duplicado_de: 9 })).st).toBe('desc');
  });

  it('gasto personal y relaciones vacías no rompen el mapeo', () => {
    const e = mapGasto(gasto({
      es_personal: true, descripcion: null, categorias: null, proveedores: null, usuario_nombre: null,
      comprobantes: [], pagos: [], evidencias: [], monto: 'abc',
    }));
    expect(e).toMatchObject({ type: 'Personal', desc: '', prov: '', cat: 'Sin categoría', user: '', pay: '', op: '', amt: 0, ev: [] });
  });

  it('boleta y medios de pago sin equivalente visual', () => {
    const e = mapGasto(gasto({
      comprobantes: [{ id: 2, numero: null, tipo: 'boleta' }],
      pagos: [{ id: 2, medio: 'efectivo', numero_operacion: null }],
      evidencias: [{ id: 3, tipo: 'audio', origen: 'web', storage_path: 'a.ogg' }],
    }));
    expect(e.ev.map((x) => x.k)).toEqual(['Boleta', 'Audio']);
    expect(e.pay).toBe('Efectivo');
  });
});

describe('empresas y roles', () => {
  it('mapRole traduce los cinco roles', () => {
    expect(mapRole('propietario')).toBe('Propietario');
    expect(mapRole('administrador')).toBe('Administrador');
    expect(mapRole('supervisor')).toBe('Supervisor');
    expect(mapRole('contador')).toBe('Contador');
    expect(mapRole('empleado')).toBe('Empleado');
  });

  it('mapCompany arma nombre corto, iniciales y color estable', () => {
    const c = mapCompany({ id: 3, nombre: 'Constructora Andina S.A.C.', activa: true, logo_url: null }, 'contador');
    expect(c).toMatchObject({ id: '3', name: 'Constructora Andina S.A.C.', short: 'Constructora Andina', initials: 'CA', role: 'Contador', kind: 'Empresa', review: 0 });
    expect(mapCompany({ id: 3, nombre: 'X', activa: true, logo_url: null }, 'empleado').color).toBe(c.color);
  });

  it('initialsOf tolera espacios y nombres vacíos', () => {
    expect(initialsOf('  lucía   ramírez ')).toBe('LR');
    expect(initialsOf('')).toBe('?');
  });
});
```

- [ ] **Step 3: Escribir el test del planificador (falla)**

`app/src/api/sync.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planSync } from './sync';
import type { Expense } from '../data/types';

const base: Expense = {
  id: '5', date: new Date(2026, 8, 28), desc: 'Taxi', prov: 'Cabify', ruc: '', cat: 'Transporte', type: 'Empresarial',
  proj: '', pay: 'Yape', amt: 28.9, st: 'pend', user: 'Lucía', channel: 'Telegram', dupOf: null, ev: [], op: '',
};
const cats = [{ id: 1, nombre: 'Transporte' }, { id: 2, nombre: 'Materiales' }];

describe('planSync', () => {
  it('duplicado: "Conservar ambos" descarta la marca', () => {
    expect(planSync({ ...base, st: 'dup' }, { st: 'ok', dupOf: null }, cats)).toEqual({ kind: 'descartarDuplicado' });
  });
  it('duplicado: "Descartar este gasto" confirma el duplicado', () => {
    expect(planSync({ ...base, st: 'dup' }, { st: 'desc' }, cats)).toEqual({ kind: 'confirmarDuplicado' });
  });
  it('confirmar sin cambios usa confirmar-confianza', () => {
    expect(planSync(base, { st: 'ok' }, cats)).toEqual({ kind: 'confirmarConfianza' });
  });
  it('confirmar con datos corregidos hace PATCH solo de lo que cambió', () => {
    expect(planSync(base, { st: 'ok', amt: 30, cat: 'Materiales', type: 'Personal', desc: 'Taxi aeropuerto' }, cats))
      .toEqual({ kind: 'patch', body: { monto: 30, descripcion: 'Taxi aeropuerto', es_personal: true, categoria_id: 2 } });
  });
  it('categoría que no existe en el backend se ignora', () => {
    expect(planSync(base, { st: 'ok', cat: 'Inventada' }, cats)).toEqual({ kind: 'confirmarConfianza' });
  });
  it('editar un gasto ya registrado hace PATCH', () => {
    expect(planSync({ ...base, st: 'ok' }, { st: 'ok', desc: 'Nuevo texto' }, cats)).toEqual({ kind: 'patch', body: { descripcion: 'Nuevo texto' } });
  });
  it('campos que el backend no soporta (proyecto, proveedor, RUC) no llaman a la API', () => {
    expect(planSync({ ...base, st: 'ok' }, { proj: 'Obra Surco', prov: 'Otro', ruc: '20123456789' }, cats)).toEqual({ kind: 'none' });
  });
});
```

- [ ] **Step 4: Verificar que fallan**

Run: `npm test`
Expected: FAIL — no se resuelven `./mappers` ni `./sync`.

- [ ] **Step 5: Implementar mappers**

`app/src/api/mappers.ts`:

```ts
import type { Company, Evidence, Expense, Role, Status } from '../data/types';
import type { ApiEmpresa, ApiGasto, RolEmpresa } from './types';

const ROLE: Record<RolEmpresa, Role> = {
  propietario: 'Propietario', administrador: 'Administrador', supervisor: 'Supervisor', contador: 'Contador', empleado: 'Empleado',
};
export const mapRole = (r: RolEmpresa): Role => ROLE[r];

const PALETTE = ['#0088b0', '#6b5d52', '#4f6b3a', '#7a4b8c', '#a4552b', '#5c5856'];

export const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export function mapCompany(e: ApiEmpresa, rol: RolEmpresa): Company {
  const short = e.nombre.replace(/\s+(S\.?A\.?C\.?|S\.?A\.?|E\.?I\.?R\.?L\.?|S\.?R\.?L\.?)$/i, '').trim() || e.nombre;
  return {
    id: String(e.id), name: e.nombre, short, initials: initialsOf(short), role: ROLE[rol],
    color: PALETTE[e.id % PALETTE.length], kind: 'Empresa', review: 0,
  };
}

const PAY: Record<string, string> = { yape: 'Yape', transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta: 'Tarjeta', otro: 'Otro' };

function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function statusOf(g: Pick<ApiGasto, 'pendiente_revision' | 'posible_duplicado_de'>): Status {
  if (g.pendiente_revision) return g.posible_duplicado_de != null ? 'dup' : 'pend';
  return g.posible_duplicado_de != null ? 'desc' : 'ok';
}

function mapEvidence(g: ApiGasto): Evidence[] {
  const ev: Evidence[] = [];
  for (const c of g.comprobantes ?? []) ev.push({ k: c.tipo === 'boleta' ? 'Boleta' : 'Factura', file: c.numero ?? 'comprobante-' + c.id });
  for (const p of g.pagos ?? []) {
    const k = p.medio === 'yape' ? 'Yape' : p.medio === 'transferencia' ? 'Transferencia' : null;
    if (k) ev.push({ k, file: (p.numero_operacion ?? 'pago') + '-' + p.id });
  }
  for (const e of g.evidencias ?? []) ev.push({ k: e.tipo === 'audio' ? 'Audio' : 'Foto', file: e.storage_path, url: e.url ?? null });
  return ev;
}

function channelOf(g: ApiGasto): string {
  const origen = g.evidencias?.[0]?.origen;
  return origen === 'telegram' ? 'Telegram' : origen === 'web' ? 'Web' : '—';
}

export function mapGasto(g: ApiGasto): Expense {
  const pago = g.pagos?.[0];
  return {
    id: String(g.id),
    date: parseDate(g.fecha),
    desc: g.descripcion ?? '',
    prov: g.proveedores?.nombre ?? '',
    ruc: '',
    cat: g.categorias?.nombre ?? 'Sin categoría',
    type: g.es_personal ? 'Personal' : 'Empresarial',
    proj: g.pedidos?.nombre ?? '',
    pay: pago ? PAY[pago.medio] ?? pago.medio : '',
    amt: Number(g.monto) || 0,
    st: statusOf(g),
    user: g.usuario_nombre ?? '',
    channel: channelOf(g),
    dupOf: g.posible_duplicado_de != null ? String(g.posible_duplicado_de) : null,
    ev: mapEvidence(g),
    op: pago?.numero_operacion ?? '',
  };
}
```

- [ ] **Step 6: Implementar el planificador**

`app/src/api/sync.ts`:

```ts
import type { Expense } from '../data/types';

export interface PatchBody { monto?: number; descripcion?: string; es_personal?: boolean; categoria_id?: number }

export type SyncPlan =
  | { kind: 'none' }
  | { kind: 'confirmarConfianza' }
  | { kind: 'confirmarDuplicado' }
  | { kind: 'descartarDuplicado' }
  | { kind: 'patch'; body: PatchBody };

/**
 * Decide qué endpoint corresponde a un cambio hecho desde la UI.
 * "Conservar ambos" (dup→ok) = el backend lo llama descartar-duplicado (NO es el mismo pago);
 * "Descartar este gasto" (dup→desc) = confirmar-duplicado (SÍ es el mismo pago, no suma a totales).
 * Proyecto, proveedor, RUC y medio de pago no tienen endpoint: se quedan solo en la UI.
 */
export function planSync(cur: Expense, p: Partial<Expense>, cats: { id: number; nombre: string }[]): SyncPlan {
  if (cur.st === 'dup' && p.st === 'ok') return { kind: 'descartarDuplicado' };
  if (cur.st === 'dup' && p.st === 'desc') return { kind: 'confirmarDuplicado' };

  const body: PatchBody = {};
  if (p.amt !== undefined && p.amt !== cur.amt) body.monto = p.amt;
  if (p.desc !== undefined && p.desc !== cur.desc) body.descripcion = p.desc;
  if (p.type !== undefined && p.type !== cur.type) body.es_personal = p.type === 'Personal';
  if (p.cat !== undefined && p.cat !== cur.cat) {
    const c = cats.find((x) => x.nombre === p.cat);
    if (c) body.categoria_id = c.id;
  }
  if (Object.keys(body).length) return { kind: 'patch', body };

  if (cur.st === 'pend' && p.st === 'ok') return { kind: 'confirmarConfianza' };
  return { kind: 'none' };
}
```

- [ ] **Step 7: Endpoints**

`app/src/api/endpoints.ts`:

```ts
import { api } from './client';
import type { PatchBody } from './sync';
import type { ApiCategoria, ApiConteos, ApiEmpresa, ApiGasto, ApiLogin, ApiResumen, ApiUsuario } from './types';

export const login = (email: string, password: string) =>
  api<ApiLogin>('/auth/login', { method: 'POST', body: { email, password } });
export const me = () => api<Partial<ApiUsuario>>('/auth/me', { method: 'POST' });
export const empresasMias = () => api<ApiEmpresa[]>('/empresas/mias');
export const setEmpresaActiva = (empresaId: number) =>
  api<{ ultima_empresa_id: number }>('/auth/empresa-activa', { method: 'PATCH', body: { empresa_id: empresaId } });

export const listGastos = (empresaId: number) =>
  api<ApiGasto[]>('/gastos', { query: { empresa_id: empresaId, limite: 200 } });
export const resumen = (empresaId: number) => api<ApiResumen>('/gastos/resumen', { query: { empresa_id: empresaId } });
export const conteos = (empresaId: number) => api<ApiConteos>('/gastos/conteos', { query: { empresa_id: empresaId } });
export const categorias = (empresaId: number) => api<ApiCategoria[]>('/categorias', { query: { empresa_id: empresaId } });

const accion = (id: number, empresaId: number, ruta: string) =>
  api<unknown>('/gastos/' + id + '/' + ruta, { method: 'PATCH', query: { empresa_id: empresaId } });
export const patchGasto = (id: number, empresaId: number, body: PatchBody) =>
  api<unknown>('/gastos/' + id, { method: 'PATCH', body, query: { empresa_id: empresaId } });
export const confirmarConfianza = (id: number, empresaId: number) => accion(id, empresaId, 'confirmar-confianza');
export const confirmarDuplicado = (id: number, empresaId: number) => accion(id, empresaId, 'confirmar-duplicado');
export const descartarDuplicado = (id: number, empresaId: number) => accion(id, empresaId, 'descartar-duplicado');
export const rechazar = (id: number, empresaId: number) => accion(id, empresaId, 'rechazar');
```

- [ ] **Step 8: Verificar**

Run: `npm test && npm run typecheck`
Expected: todos los tests PASS; typecheck sin errores.

- [ ] **Step 9: Commit**

```bash
git add app/src/api app/src/data/types.ts
git commit -m "feat(api): tipos, mappers, planificador de sincronización y endpoints"
```

---

### Task F3: Sesión (login) y puerta de entrada

**Files:**
- Create: `app/src/state/Auth.tsx`, `app/src/pages/Login.tsx`
- Modify: `app/src/main.tsx`

**Interfaces:**
- Consumes: `endpoints`, `setToken`, `clearToken`, `getToken`, `setUnauthorizedHandler`, `mapCompany`, `initialsOf` (Tasks F1–F2).
- Produces: `useAuth(): { status: 'loading'|'out'|'in'; user: SessionUser | null; companies: Company[]; login(email, password): Promise<void>; logout(): void }` con `SessionUser = { id: number; name: string; email: string; initials: string; esSuperAdmin: boolean; lastCompanyId: number | null }`; `<AuthProvider>`; páginas `Login` y `NoCompanies`.

- [ ] **Step 1: `Auth.tsx`**

`app/src/state/Auth.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearToken, getToken, setToken, setUnauthorizedHandler } from '../api/client';
import * as endpoints from '../api/endpoints';
import { initialsOf, mapCompany } from '../api/mappers';
import type { ApiUsuario } from '../api/types';
import type { Company } from '../data/types';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  initials: string;
  esSuperAdmin: boolean;
  lastCompanyId: number | null;
}

interface AuthState {
  status: 'loading' | 'out' | 'in';
  user: SessionUser | null;
  companies: Company[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const SESSION_KEY = 'siregg-session';

const readCached = (): ApiUsuario | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
};
const writeCached = (u: ApiUsuario | null) => {
  try { u ? localStorage.setItem(SESSION_KEY, JSON.stringify(u)) : localStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
};

const toUser = (u: ApiUsuario): SessionUser => {
  const name = u.nombre || u.email || 'Usuario';
  return { id: u.id, name, email: u.email || '', initials: initialsOf(name), esSuperAdmin: u.es_super_admin, lastCompanyId: u.ultima_empresa_id };
};

async function loadCompanies(u: ApiUsuario): Promise<Company[]> {
  const empresas = await endpoints.empresasMias();
  return empresas
    .filter((e) => e.activa !== false)
    .map((e) => mapCompany(e, u.es_super_admin ? 'propietario' : u.empresas.find((x) => x.empresa_id === e.id)?.rol ?? 'empleado'));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>(getToken() ? 'loading' : 'out');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const reset = useCallback(() => {
    clearToken(); writeCached(null);
    setUser(null); setCompanies([]); setStatus('out');
  }, []);

  const enter = useCallback(async (u: ApiUsuario) => {
    const list = await loadCompanies(u);
    writeCached(u);
    setUser(toUser(u)); setCompanies(list); setStatus('in');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(reset);
    return () => setUnauthorizedHandler(null);
  }, [reset]);

  // Sesión previa: valida el token y refresca roles/empresas desde /auth/me.
  useEffect(() => {
    if (!getToken()) return;
    const cached = readCached();
    endpoints.me()
      .then((fresh) => enter({ ...(cached ?? {}), ...fresh } as ApiUsuario))
      .catch(reset);
  }, [enter, reset]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await endpoints.login(email, password);
    setToken(res.access_token);
    try {
      await enter(res.usuario);
    } catch (e) {
      reset();
      throw e;
    }
  }, [enter, reset]);

  const value = useMemo<AuthState>(() => ({ status, user, companies, login, logout: reset }), [status, user, companies, login, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
```

- [ ] **Step 2: Páginas de login y "sin empresas"**

`app/src/pages/Login.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui';
import { useAuth } from '../state/Auth';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(''); setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form onSubmit={submit} className="panel stack" style={{ width: 'min(400px, 100%)', gap: 16, padding: 28 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="brand-mark">S</span>
          <span style={{ fontSize: 20, fontWeight: 600 }}>siregg</span>
        </div>
        <p className="muted" style={{ margin: 0 }}>Inicia sesión para ver los gastos de tu organización.</p>
        <div className="field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input id="login-email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="login-pass">Contraseña</label>
          <input id="login-pass" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div role="alert" className="row" style={{ gap: 8, color: 'var(--color-accent-2-700)', fontSize: 14 }}><Icon n="ph-warning-circle" />{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}

export function NoCompanies() {
  const { logout } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel stack" style={{ width: 'min(420px, 100%)', gap: 14, padding: 28 }}>
        <strong style={{ fontSize: 18 }}>Sin organizaciones asignadas</strong>
        <p className="muted" style={{ margin: 0 }}>Tu usuario todavía no pertenece a ninguna empresa. Pide a un administrador que te agregue.</p>
        <button className="btn btn-secondary" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Puerta en `main.tsx`**

Reemplazar en `app/src/main.tsx` el bloque desde `import { AppStateProvider, useApp } ...` hasta el final por:

```tsx
import Login, { NoCompanies } from './pages/Login';
import { AppStateProvider, useApp } from './state/AppState';
import { AuthProvider, useAuth } from './state/Auth';

function Home() {
  const { lastPage } = useApp();
  return <Navigate to={'/' + lastPage} replace />;
}

function Gate() {
  const auth = useAuth();
  if (auth.status === 'loading') return <div className="muted" style={{ padding: 40 }}>Cargando…</div>;
  if (auth.status === 'out') return <Login />;
  if (!auth.companies.length) return <NoCompanies />;
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="revision" element={<Revision />} />
            <Route path="gastos" element={<Gastos />}>
              <Route path=":id" element={null} />
            </Route>
            <Route path="comprobantes" element={<Comprobantes />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="proyectos" element={<Proyectos />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="empresa" element={<ConfigEmpresa />} />
            <Route path="personal" element={<ConfigPersonal />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </StrictMode>,
);
```

(El resto de imports de `main.tsx` —Layout, páginas, estilos— se mantiene.)

- [ ] **Step 4: Commit** (el typecheck completo se verifica al terminar F4; `AppState` aún no usa `useAuth` pero compila)

Run: `npm run typecheck`
Expected: sin errores.

```bash
git add app/src/state/Auth.tsx app/src/pages/Login.tsx app/src/main.tsx
git commit -m "feat(auth): login, sesión persistida y puerta de entrada"
```

---

### Task F4: AppState cargado desde la API

**Files:**
- Modify (reescribir): `app/src/state/AppState.tsx`
- Modify: `app/src/data/expenses.ts` (pools seguros para empresas reales)

**Interfaces:**
- Consumes: `useAuth` (F3), `endpoints`, `mapGasto`, `planSync` (F2).
- Produces: `useApp()` mantiene todo lo anterior (`co, allowed, loading, switchCompany, expenses, pendingCount, patchExpense, edits, setEdits, toast, showToast, hideToast, lastPage, rememberPage, theme, dark, setTheme`) y agrega `user: SessionUser`, `companies: Company[]`, `resumen: ApiResumen | null`, `counts: ApiConteos | null`, `categories: ApiCategoria[]`, `logout(): void`. `co.review` = `counts.requiereRevision`.

- [ ] **Step 1: Pools seguros en `data/expenses.ts`**

En `app/src/data/expenses.ts`, justo después de la constante `POOLS` (termina en `};` antes de `/** Categories a company uses by default`), agregar:

```ts
const EMPTY_POOL: Pool = { v: [], p: [], u: [] };
/** Las empresas reales (ids numéricos) no tienen pool demo: devuelven vacío. */
const poolOf = (coId: string): Pool => POOLS[coId] ?? EMPTY_POOL;
```

y cambiar las tres funciones para usarlo:

```ts
export const baseCategories = (coId: string) => uniq(poolOf(coId).v.map((v) => v[1]));
export const baseProjects = (coId: string) => poolOf(coId).p;
export const vendorsForCategory = (coId: string, cat: string) =>
  uniq(poolOf(coId).v.filter((v) => v[1] === cat).map((v) => v[0]));
```

- [ ] **Step 2: Reescribir `AppState.tsx`**

`app/src/state/AppState.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as endpoints from '../api/endpoints';
import { mapGasto } from '../api/mappers';
import { planSync } from '../api/sync';
import type { ApiCategoria, ApiConteos, ApiResumen } from '../api/types';
import { isPending } from '../data/expenses';
import { PERMS } from '../data/org';
import type { Company, Expense, Member, PageId } from '../data/types';
import { useAuth, type SessionUser } from './Auth';

export type ThemePref = 'light' | 'dark' | 'auto';

interface Toast { text: string; icon: string }

/**
 * Ediciones locales. `expenses` es un overlay optimista de los cambios que sí
 * viajan al backend y de los campos sin endpoint (proyecto, proveedor, RUC, medio de pago).
 * El resto (proyectos, categorías, miembros…) sigue siendo demostración en memoria.
 */
interface DemoEdits {
  expenses: Record<string, Partial<Expense>>;
  projects: Record<string, string[]>;
  categories: Record<string, string[]>;
  categoriesOff: Record<string, boolean>;
  members: Record<string, Partial<Member>>;
  invited: Record<string, Member[]>;
  companyCfg: Record<string, Record<string, string>>;
  companyPrefs: Record<string, Record<string, boolean>>;
  myPrefs: Record<string, boolean>;
}

const EMPTY_EDITS: DemoEdits = {
  expenses: {}, projects: {}, categories: {}, categoriesOff: {}, members: {}, invited: {}, companyCfg: {}, companyPrefs: {}, myPrefs: {},
};

/** Campos que el backend no guarda: sobreviven a una recarga desde la API. */
const LOCAL_ONLY: (keyof Expense)[] = ['proj', 'prov', 'ruc', 'pay'];

function keepLocalOnly(map: Record<string, Partial<Expense>>): Record<string, Partial<Expense>> {
  const out: Record<string, Partial<Expense>> = {};
  for (const [k, v] of Object.entries(map)) {
    const kept: Partial<Expense> = {};
    for (const f of LOCAL_ONLY) if (f in v) (kept as Record<string, unknown>)[f] = v[f];
    if (Object.keys(kept).length) out[k] = kept;
  }
  return out;
}

interface AppState {
  theme: ThemePref;
  dark: boolean;
  setTheme: (t: ThemePref) => void;
  user: SessionUser;
  logout: () => void;
  companies: Company[];
  co: Company;
  allowed: PageId[];
  loading: boolean;
  /** Cambia de empresa; devuelve la página a la que ir (dashboard si el rol no puede ver `page`). */
  switchCompany: (id: string, page: PageId) => PageId;
  expenses: Expense[];
  pendingCount: number;
  resumen: ApiResumen | null;
  counts: ApiConteos | null;
  categories: ApiCategoria[];
  patchExpense: (id: string, p: Partial<Expense>) => void;
  edits: DemoEdits;
  setEdits: (fn: (e: DemoEdits) => DemoEdits) => void;
  toast: Toast | null;
  showToast: (text: string, icon?: string) => void;
  hideToast: () => void;
  lastPage: PageId;
  rememberPage: (p: PageId) => void;
}

const Ctx = createContext<AppState | null>(null);
const STORE_KEY = 'siregg-ui';

function readStored(): { theme?: ThemePref; coId?: string; page?: PageId } {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const companies = auth.companies;
  const user = auth.user!;
  const stored = useRef(readStored()).current;
  const [theme, setThemeState] = useState<ThemePref>(stored.theme || 'light');
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [coId, setCoId] = useState(() => {
    if (stored.coId && companies.some((c) => c.id === stored.coId)) return stored.coId;
    const last = user.lastCompanyId;
    if (last != null && companies.some((c) => c.id === String(last))) return String(last);
    return companies[0].id;
  });
  const [lastPage, setLastPage] = useState<PageId>(stored.page || 'dashboard');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [edits, setEdits] = useState<DemoEdits>(EMPTY_EDITS);
  const [gastos, setGastos] = useState<Expense[]>([]);
  const [resumen, setResumen] = useState<ApiResumen | null>(null);
  const [counts, setCounts] = useState<ApiConteos | null>(null);
  const [categories, setCategories] = useState<ApiCategoria[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const silentRef = useRef(false);
  const toastTimer = useRef<number>();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSysDark(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const dark = theme === 'dark' || (theme === 'auto' && sysDark);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-dark', dark);
    root.classList.toggle('theme-light', !dark);
  }, [dark]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ theme, coId, page: lastPage }));
    } catch {
      /* storage unavailable: preferences just won't persist */
    }
  }, [theme, coId, lastPage]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((text: string, icon = 'ph-info') => {
    clearTimeout(toastTimer.current);
    setToast({ text, icon });
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  // Carga de la empresa activa. Un cambio de empresa muestra el estado de carga;
  // una recarga tras guardar (silentRef) no desmonta la pantalla.
  useEffect(() => {
    let alive = true;
    const empresaId = Number(coId);
    if (silentRef.current) silentRef.current = false;
    else setLoading(true);
    Promise.all([endpoints.listGastos(empresaId), endpoints.conteos(empresaId), endpoints.resumen(empresaId), endpoints.categorias(empresaId)])
      .then(([g, c, r, cats]) => {
        if (!alive) return;
        setGastos(g.map(mapGasto));
        setCounts(c);
        setResumen(r);
        setCategories(cats);
        setEdits((s) => ({ ...s, expenses: keepLocalOnly(s.expenses) }));
      })
      .catch((e) => {
        if (!alive) return;
        setGastos([]); setCounts(null); setResumen(null); setCategories([]);
        showToast(e instanceof Error ? e.message : 'No se pudieron cargar los datos.', 'ph-warning-circle');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [coId, reloadTick, showToast]);

  const base = companies.find((c) => c.id === coId) ?? companies[0];
  const co = useMemo<Company>(() => ({ ...base, review: counts?.requiereRevision ?? 0 }), [base, counts]);
  const allowed = PERMS[co.role];

  const switchCompany = useCallback((id: string, page: PageId): PageId => {
    const next = companies.find((c) => c.id === id);
    if (!next) return page;
    const target = PERMS[next.role].includes(page) ? page : 'dashboard';
    if (id === coId) return target;
    setCoId(id);
    setLastPage(target);
    setGastos([]); setCounts(null); setResumen(null);
    endpoints.setEmpresaActiva(Number(id)).catch(() => { /* solo recuerda la preferencia */ });
    showToast('Ahora en ' + next.name, 'ph-arrows-left-right');
    return target;
  }, [companies, coId, showToast]);

  const expenses = useMemo(
    () => gastos.map((e) => ({ ...e, ...(edits.expenses[coId + '|' + e.id] || {}) })),
    [gastos, coId, edits.expenses],
  );
  const expensesRef = useRef<Expense[]>([]);
  expensesRef.current = expenses;
  const pendingCount = useMemo(() => expenses.filter((e) => isPending(e.st)).length, [expenses]);

  const patchExpense = useCallback((id: string, p: Partial<Expense>) => {
    const key = coId + '|' + id;
    const cur = expensesRef.current.find((e) => e.id === id);
    setEdits((s) => ({ ...s, expenses: { ...s.expenses, [key]: { ...(s.expenses[key] || {}), ...p } } }));
    if (!cur) return;

    const plan = planSync(cur, p, categories);
    if (plan.kind === 'none') return;
    const n = Number(id);
    const empresaId = Number(coId);
    const call =
      plan.kind === 'patch' ? endpoints.patchGasto(n, empresaId, plan.body)
      : plan.kind === 'confirmarConfianza' ? endpoints.confirmarConfianza(n, empresaId)
      : plan.kind === 'confirmarDuplicado' ? endpoints.confirmarDuplicado(n, empresaId)
      : endpoints.descartarDuplicado(n, empresaId);

    call
      .then(() => { silentRef.current = true; setReloadTick((t) => t + 1); })
      .catch((err) => {
        setEdits((s) => {
          const rest = { ...s.expenses };
          delete rest[key];
          return { ...s, expenses: rest };
        });
        showToast(err instanceof Error ? err.message : 'No se pudo guardar el cambio.', 'ph-warning-circle');
      });
  }, [coId, categories, showToast]);

  const value: AppState = {
    theme, dark, setTheme: setThemeState, user, logout: auth.logout, companies, co, allowed, loading, switchCompany,
    expenses, pendingCount, resumen, counts, categories, patchExpense, edits, setEdits,
    toast, showToast, hideToast: () => setToast(null),
    lastPage, rememberPage: setLastPage,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm test`
Expected: typecheck sin errores (Layout aún compila porque sigue importando datos demo); tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/state/AppState.tsx app/src/data/expenses.ts
git commit -m "feat(state): AppState carga gastos, resumen y conteos desde la API"
```

---

### Task F5: Dashboard con datos reales

**Files:**
- Modify (reescribir): `app/src/data/dashboard.ts`
- Modify: `app/src/pages/Dashboard.tsx`
- Test: `app/src/data/dashboard.test.ts`

**Interfaces:**
- Consumes: `ApiResumen`, `mapGasto` (F2), `Expense`, `Company`; `curve`, `fd`, `money`, `MONTHS` de `lib/format`.
- Produces: `buildDashboard(co: Company, r: ApiResumen | null, expenses: Expense[])` con la misma forma que antes más `monthName: string`, `monthLabel: string`, `dayLabels: string[]`. Mantiene `CAT_ICON`, `CHART_W`, `CHART_H`, `Delta`.

- [ ] **Step 1: Escribir el test que falla**

`app/src/data/dashboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ApiResumen } from '../api/types';
import { buildDashboard } from './dashboard';
import type { Company, Expense } from './types';

const co: Company = { id: '1', name: 'Demo', short: 'Demo', initials: 'D', role: 'Administrador', color: '#000', kind: 'Empresa', review: 0 };

const dias = Array.from({ length: 14 }, (_, i) => ({ fecha: `2026-09-${String(15 + i).padStart(2, '0')}`, total: i === 13 ? 300 : 100 }));
const resumen: ApiResumen = {
  today: 300, week: 1200, month: 4000, company: 3000, personal: 1000,
  topCategorias: [], topProveedores: [], recientes: [], tendenciaDiaria: dias,
};
const gasto = (cat: string, amt: number): Expense => ({
  id: cat + amt, date: new Date(2026, 8, 20), desc: 'x', prov: 'P', ruc: '', cat, type: 'Empresarial', proj: '', pay: '',
  amt, st: 'ok', user: '', channel: '', dupOf: null, ev: [], op: '',
});

describe('buildDashboard', () => {
  it('arma KPIs, serie de 14 días y etiquetas desde el resumen', () => {
    const d = buildDashboard(co, resumen, [gasto('Materiales', 300), gasto('Transporte', 100)]);
    expect(d.month).toBe(4000);
    expect(d.kpis.map((k) => k.raw)).toEqual([300, 1200, 4000 / 28]);
    expect(d.vals).toHaveLength(14);
    expect(d.pts).toHaveLength(14);
    expect(d.monthName).toBe('setiembre');
    expect(d.dayLabels[13]).toBe('28 de setiembre');
    expect(d.xLabels).toHaveLength(5);
    expect(d.xLabels[4]).toBe('HOY');
    expect(d.bizPct).toBe('75%');
    expect(d.perPct).toBe('25%');
    expect(d.cats.map((c) => c.name)).toEqual(['Materiales', 'Transporte']);
  });

  it('sin gastos (resumen vacío o nulo) no lanza y devuelve ceros', () => {
    for (const r of [null, { ...resumen, today: 0, week: 0, month: 0, company: 0, personal: 0, tendenciaDiaria: [] } as ApiResumen]) {
      const d = buildDashboard(co, r, []);
      expect(d.month).toBe(0);
      expect(d.vals).toHaveLength(14);
      expect(d.cats).toEqual([]);
      expect(d.review).toEqual([]);
      expect(d.recent).toEqual([]);
      expect(d.bizPct).toBe('100%');
    }
  });

  it('la lista de revisión toma duplicados y pendientes', () => {
    const pend: Expense = { ...gasto('Materiales', 50), st: 'pend', prov: 'Sodimac' };
    const dup: Expense = { ...gasto('Transporte', 10), st: 'dup', prov: 'Cabify' };
    const d = buildDashboard(co, resumen, [pend, dup, gasto('Otros', 5)]);
    expect(d.review.map((r) => r.kind)).toEqual(['pend', 'dup']);
    expect(d.review[0].title).toBe('Sodimac · S/ 50.00');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -- dashboard`
Expected: FAIL (firma de `buildDashboard` distinta).

- [ ] **Step 3: Reescribir `data/dashboard.ts`**

`app/src/data/dashboard.ts`:

```ts
import { mapGasto } from '../api/mappers';
import type { ApiResumen } from '../api/types';
import { curve, fd, money, MONTHS } from '../lib/format';
import type { Company, Expense } from './types';

type ReviewKind = 'dup' | 'info' | 'pend' | 'proc' | 'err';

const REVIEW_KIND: Record<ReviewKind, [tone: 'a' | 'a2' | 'n', label: string]> = {
  dup: ['a2', 'Posible duplicado'],
  info: ['a2', 'Requiere info'],
  pend: ['a', 'Pendiente'],
  proc: ['n', 'Procesando'],
  err: ['a2', 'Error'],
};

export const CAT_ICON: Record<string, string> = {
  Materiales: 'ph-package', Servicios: 'ph-plugs', Transporte: 'ph-car', Alimentación: 'ph-fork-knife', Oficina: 'ph-paperclip',
  Otros: 'ph-dots-three', Maquinaria: 'ph-gear', 'Mano de obra': 'ph-hard-hat', Combustible: 'ph-gas-pump', Mantenimiento: 'ph-wrench',
  Peajes: 'ph-road-horizon', Seguros: 'ph-shield-check', Hogar: 'ph-house', Salud: 'ph-first-aid', Ocio: 'ph-film-slate',
};

export interface Delta { delta: string; vs: string; dColor: string; up: number }

const NO_DELTA: Delta = { delta: '—', vs: 'sin comparativo', dColor: 'var(--color-neutral-700)', up: 0 };

export const CHART_W = 600;
export const CHART_H = 200;

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const PALETTE = ['var(--color-accent)', 'var(--color-violet)', 'var(--color-accent-700)', 'var(--color-neutral-500)', 'var(--color-neutral-300)', 'var(--color-neutral-200)'];

const EMPTY: ApiResumen = {
  today: 0, week: 0, month: 0, company: 0, personal: 0, topCategorias: [], topProveedores: [], recientes: [], tendenciaDiaria: [],
};

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Serie de 14 días; si el backend no la trae completa, se rellena con ceros terminando hoy. */
function lastFourteenDays(r: ApiResumen): { fecha: string; total: number }[] {
  if (r.tendenciaDiaria.length === 14) return r.tendenciaDiaria;
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return { fecha: isoOf(d), total: 0 };
  });
}

const dayNum = (iso: string) => Number(iso.slice(8, 10));
const monthIdx = (iso: string) => Number(iso.slice(5, 7)) - 1;

function sparkOf(vals: number[]) {
  const x = Math.max(...vals);
  const n = Math.min(...vals);
  return curve(vals.map((v, i) => [(i / (vals.length - 1)) * 100, 3 + (1 - (v - n) / (x - n || 1)) * 22] as [number, number]));
}

export function buildDashboard(co: Company, resumen: ApiResumen | null, expenses: Expense[]) {
  const r = resumen ?? EMPTY;
  const days = lastFourteenDays(r);
  const vals = days.map((d) => d.total);
  const lastIso = days[13].fecha;
  const mIdx = monthIdx(lastIso);
  const year = Number(lastIso.slice(0, 4));

  const P = 18;
  const mx = Math.max(...vals);
  const mn = Math.min(...vals) * 0.6;
  const pts = vals.map((v, i) => [(i / 13) * CHART_W, P + (1 - (v - mn) / (mx - mn || 1)) * (CHART_H - 2 * P)] as [number, number]);
  const line = curve(pts);

  // Categorías del mes en curso, por monto (sobre los gastos cargados).
  const byCat: Record<string, number> = {};
  let catTotal = 0;
  for (const e of expenses) {
    if (e.st === 'desc' || e.date.getFullYear() !== year || e.date.getMonth() !== mIdx) continue;
    byCat[e.cat] = (byCat[e.cat] || 0) + e.amt;
    catTotal += e.amt;
  }
  const C = 2 * Math.PI * 40;
  let acc = 0;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, amount], i) => {
    const p = catTotal ? (amount / catTotal) * 100 : 0;
    const o = {
      name, pct: p.toFixed(0) + '%', amt: money(amount), color: PALETTE[i % 6],
      dash: Math.max(0, (C * p) / 100 - 1.5).toFixed(2) + ' ' + C.toFixed(2), off: ((-C * acc) / 100).toFixed(2),
    };
    acc += p;
    return o;
  });

  const kpi = (label: string, raw: number) => ({ label, raw, ...NO_DELTA, spark: sparkOf(vals), sc: 'var(--color-violet)' });

  const split = r.company + r.personal;
  const biz = split ? Math.round((r.company / split) * 100) : 100;

  const xIdx = [0, 1, 2, 3].map((i) => Math.round((i * 13) / 4));
  const xLabels = xIdx
    .map((idx, i) => (i === 0 ? dayNum(days[idx].fecha) + ' ' + MONTHS[monthIdx(days[idx].fecha)].toUpperCase() : String(dayNum(days[idx].fecha))))
    .concat('HOY');

  return {
    scope: co.role === 'Empleado' ? 'Mostrando solo tus gastos' : 'Todos los gastos de la organización',
    month: r.month,
    monthDelta: NO_DELTA,
    monthName: MONTH_NAMES[mIdx],
    monthLabel: MONTH_NAMES[mIdx][0].toUpperCase() + MONTH_NAMES[mIdx].slice(1),
    dayLabels: days.map((d) => dayNum(d.fecha) + ' de ' + MONTH_NAMES[monthIdx(d.fecha)]),
    kpis: [kpi('Hoy', r.today), kpi('Esta semana', r.week), kpi('Promedio diario', r.month / dayNum(lastIso))],
    vals, pts, line, area: line + ' L' + CHART_W + ' ' + CHART_H + ' L0 ' + CHART_H + ' Z',
    xLabels,
    cats, bizPct: biz + '%', perPct: 100 - biz + '%',
    review: expenses.filter((e) => e.st === 'dup' || e.st === 'pend').slice(0, 4).map((e) => {
      const kind: ReviewKind = e.st === 'dup' ? 'dup' : 'pend';
      const [tone, status] = REVIEW_KIND[kind];
      return { kind, title: (e.prov || e.desc || 'Gasto') + ' · ' + money(e.amt), status, color: tone === 'a2' ? 'var(--color-accent-2)' : 'var(--color-accent)' };
    }),
    recent: r.recientes.map(mapGasto).map((e) => ({
      date: fd(e.date), desc: e.desc || e.prov, prov: e.prov, cat: e.cat, amt: money(e.amt), icon: CAT_ICON[e.cat] || 'ph-receipt',
    })),
  };
}
```

- [ ] **Step 4: Verificar el test**

Run: `npm test -- dashboard`
Expected: PASS (3 tests).

- [ ] **Step 5: Ajustar `Dashboard.tsx`**

En `app/src/pages/Dashboard.tsx`:

1. Línea 10: `const { co, pendingCount } = useApp();` → `const { co, pendingCount, resumen, expenses } = useApp();`
2. Línea 13: `const d = useMemo(() => buildDashboard(co), [co]);` → `const d = useMemo(() => buildDashboard(co, resumen, expenses), [co, resumen, expenses]);`
3. Línea 16: `const sel = hi ?? 13;` (sin cambios).
4. `Gasto de setiembre` → `Gasto de {d.monthName}`.
5. `<span className="muted">vs. agosto</span>` → `<span className="muted">{md.vs}</span>`.
6. `{15 + sel} de setiembre{sel === 13 ? ' · hoy' : ''}` → `{d.dayLabels[sel]}{sel === 13 ? ' · hoy' : ''}`.
7. `<span className="muted" style={{ fontSize: 12.5 }}>Setiembre</span>` → `<span className="muted" style={{ fontSize: 12.5 }}>{d.monthLabel}</span>`.
8. Eliminar la línea `<p className="demo-note"><Icon n="ph-flask" /> Datos ficticios de demostración para {co.name}.</p>`.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm test`
Expected: sin errores; todos los tests PASS. Luego `grep -rn "agosto\|setiembre\|Setiembre" app/src/pages app/src/components` → solo debe quedar `Layout.tsx` (se corrige en F6).

- [ ] **Step 7: Commit**

```bash
git add app/src/data/dashboard.ts app/src/data/dashboard.test.ts app/src/pages/Dashboard.tsx
git commit -m "feat(dashboard): datos reales desde /gastos/resumen"
```

---

### Task F6: Layout, Gastos y detalle usan datos reales

**Files:**
- Modify: `app/src/components/Layout.tsx`, `app/src/pages/Gastos.tsx`, `app/src/pages/Configuracion.tsx`, `app/src/components/ExpenseDetail.tsx`

- [ ] **Step 1: `Layout.tsx` — empresas y usuario reales**

1. Import (línea 3): `import { COMPANIES, CURRENT_USER, NAV_GROUPS, NOTIFS, PAGES, PERSONAL } from '../data/org';` → `import { NAV_GROUPS, NOTIFS, PAGES } from '../data/org';`
2. Línea 53: `const coList = COMPANIES.filter(...)` → `const coList = app.companies.filter((c) => !q || c.name.toLowerCase().includes(q));`
3. Línea 54: `const coEmpty = coList.length === 0 && !'gastos personales'.includes(q);` → `const coEmpty = coList.length === 0;`
4. Eliminar el bloque del espacio personal (líneas 95-100): el `<div style={{ height: 'var(--space-2)' }} />` y el `<button role="option" ... switchTo(PERSONAL.id) ...>...</button>` completo.
5. Línea 184: `{CURRENT_USER.initials}` → `{app.user.initials}`; línea 187: `{CURRENT_USER.name}` → `{app.user.name}` y `{CURRENT_USER.email}` → `{app.user.email}`.
6. Cierre de sesión (líneas 192-195): reemplazar el `onClick` por `onClick={() => { setOpen(null); app.logout(); }}`.
7. `PageHeader`, línea 223: reemplazar por `const scope = co.role === 'Empleado' ? 'Mostrando solo tus gastos' : 'Todos los gastos de la organización';`
8. `PageHeader`, línea 239: `<span>{co.name} · Setiembre 2026</span>` → `<span>{co.name} · <span style={{ textTransform: 'capitalize' }}>{new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}</span></span>`.
9. Línea 254: `showRegisterInfo` — cambiar el texto a `'Los gastos se registran enviando foto, audio o texto por Telegram.'`.

- [ ] **Step 2: `Gastos.tsx`**

1. Import: `import { ALERT_STATUSES, baseCategories, isPending, PAYS, STAT } from '../data/expenses';` → `import { ALERT_STATUSES, isPending, PAYS, STAT } from '../data/expenses';` y `import { fd, money } from '../lib/format';` → `import { fd, money, uniq } from '../lib/format';`
2. Línea 64: `... : +a.date - +b.date || b.id.localeCompare(a.id);` → `... : +a.date - +b.date || +b.id - +a.id;`
3. Línea 79: `opts: baseCategories(co.id).map((v) => ({ v })) },` → `opts: uniq(expenses.map((e) => e.cat)).sort().map((v) => ({ v })) },`
4. Si tras el cambio `co` queda sin uso en `GastosList`, quitarlo de la desestructuración de la línea 37 (`noUnusedLocals`).

- [ ] **Step 3: `Configuracion.tsx` — usuario real en Configuración personal**

1. Línea 3: `import { COMPANIES, CURRENT_USER, ORG_INFO } from '../data/org';` → `import { ORG_INFO } from '../data/org';`
2. Línea 75: `const { theme, setTheme, edits, setEdits, showToast } = useApp();` → `const { theme, setTheme, edits, setEdits, showToast, user, companies } = useApp();`
3. Líneas 89-94: `CURRENT_USER.initials` → `user.initials`; `CURRENT_USER.name` → `user.name`; `COMPANIES.length` → `companies.length`; `CURRENT_USER.email` → `user.email` (incluye los `defaultValue`).
4. Si `ConfigEmpresa` (línea ~23-30) referencia `COMPANIES`/`CURRENT_USER`, aplicar el mismo reemplazo (`grep -n "COMPANIES\|CURRENT_USER" app/src` debe quedar sin resultados fuera de `data/org.ts`).

- [ ] **Step 4: `ExpenseDetail.tsx` — categorías reales y textos**

1. Línea 4: `import { fd, money } from '../lib/format';` → `import { fd, money, uniq } from '../lib/format';`
2. Línea 43: `const { co, expenses, patchExpense, showToast } = useApp();` → `const { co, expenses, patchExpense, showToast, categories } = useApp();`
3. Línea 60: `const cats = baseCategories(co.id);` → `const cats = uniq([...baseCategories(co.id), ...categories.map((c) => c.nombre), e.cat]);`
4. Banner `desc` (línea 25): texto → `'Marcado como duplicado. No se incluye en totales.'`
5. Línea 81: `showToast(e.id + ' registrado (solo en esta demostración).', 'ph-check-circle');` → `showToast('Gasto ' + e.id + ' registrado.', 'ph-check-circle');`
6. Línea 92: `'Se conservaron ambos gastos (demostración).'` → `'Se conservaron ambos gastos.'`
7. Línea 96: `e.id + ' descartado como duplicado (demostración).'` → `'Gasto ' + e.id + ' marcado como duplicado.'`
8. Línea 105: el texto `'Cambio aplicado solo en esta demostración. No se guardó en ningún servidor.'` → `'Cambio guardado.'`

- [ ] **Step 5: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck y build sin errores; tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components app/src/pages
git commit -m "feat(ui): empresas, usuario, gastos y detalle con datos reales"
```

---

### Task F7: README del frontend

**Files:**
- Modify: `app/README.md`

- [ ] **Step 1:** Reemplazar la sección "Conectar el backend" por:

```markdown
## Backend

El frontend consume la API de `facturas-app/backend` (NestJS + Supabase).

```bash
cp .env.example .env     # VITE_API_URL=http://localhost:3000
npm run dev
```

- Conectado: login, selector de empresa, Dashboard, Gastos (lista/detalle) y Revisión. Ver `src/api/` (cliente, mappers y endpoints) y `src/state/`.
- Sigue como demostración: proveedores, categorías, usuarios, configuración de empresa, proyectos/pedidos, reportes y notificaciones (`src/data/`).
- Proyecto, proveedor, RUC y medio de pago de un gasto se editan solo en pantalla: el backend aún no tiene endpoint para ellos.
- Los permisos por rol solo ocultan navegación; el backend valida el acceso por empresa.
- `npm test` corre los tests de `src/api` y `src/data`.
```

- [ ] **Step 2: Commit**

```bash
git add app/README.md
git commit -m "docs: cómo conectar el frontend al backend"
```

---

### Task F8: Verificación de punta a punta

No agrega código. Requiere Task 0 hecha (BD SIREGG con migraciones y seed) y `backend/.env` apuntando a ese proyecto.

- [ ] **Step 1: Arrancar el backend**

Run (en `facturas-app/backend`, rama `feature/roles-por-empresa`): `pnpm start:dev`
Expected: log "Backend corriendo en http://localhost:3000". Si falla con "column es_super_admin does not exist", falta `0002`.

- [ ] **Step 2: Arrancar el frontend**

Run (en `SIREGG/app`): `npm run dev` → abrir `http://localhost:5173`.

- [ ] **Step 3: Recorrido manual**

1. Login `lucia@siregg.dev` / `Siregg123` → entra al Dashboard de "Empresa Demo" con rol Administrador y ve 6 gastos, 2 pendientes de revisión (incluye el duplicado).
2. Contraseña incorrecta → mensaje "Credenciales inválidas", sin pantalla en blanco.
3. Cambiar a "Constructora Andina" (rol Contador): el menú oculta Usuarios y Configuración de empresa; sin gastos → estados vacíos sin errores.
4. Revisión: confirmar un pendiente sin cambios (→ `confirmar-confianza`); corregir un monto y confirmar (→ `PATCH /gastos/:id`); en el duplicado, "Conservar ambos" (→ `descartar-duplicado`). Recargar la página y comprobar que los cambios persisten.
5. Cerrar sesión → vuelve al login; recargar no restaura la sesión.
6. Detener el backend y recargar → toast "No se pudo conectar con el servidor." sin romper la interfaz.

- [ ] **Step 4: Resultado**

Anotar cualquier desvío (pantalla que consuma un dato ausente, texto demo residual) y corregirlo antes de dar la entrega por terminada. Suite final: `pnpm test` (backend) y `npm test && npm run build` (frontend) en verde.

---

---

# Adenda: crear usuarios (alcance añadido por el usuario)

Se conecta la creación de usuarios (y la lista de miembros, para que lo creado persista) de la página Usuarios. Cambiar rol, suspender y reenviar siguen como demostración. Orden de ejecución: B1–B5, U1, F0–F6, U2, F7–F8.

### Task U1: Backend — alta de usuarios con rol por empresa

**Files:**
- Modify: `backend/src/auth/roles-empresa.ts` (+ `roles-empresa.spec.ts`), `backend/src/auth/strategies/jwt.strategy.ts` (+ spec), `backend/src/usuarios/dto/crear-usuario.dto.ts`, `backend/src/usuarios/usuarios.service.ts`, `backend/src/usuarios/usuarios.controller.ts`
- Test: `backend/src/usuarios/usuarios.service.spec.ts`

**Interfaces:**
- Produces: `resolverRolAlta(dto: { rol?: string; rol_empresa?: RolEmpresa }, quien: { es_super_admin: boolean; rol_empresa: RolEmpresa | null }): { rol_empresa: RolEmpresa; rol: string }` (lanza `ForbiddenException`); `req.user.empresa_activa_id: number | null`; `CrearUsuarioDto.rol_empresa?: RolEmpresa`; `UsuariosService.crear(dto, forzarEmpresaIds?, alta?)`; `Usuario` gana `empresas: EmpresaRol[]` y `tiene_password: boolean` y ya no expone `password_hash`; `GET /usuarios?empresa_id=` lista la empresa activa; correo repetido → 409.

- [ ] **Step 1: tests que fallan** — en `roles-empresa.spec.ts`: rol_empresa `contador` → `{rol_empresa:'contador', rol:'empleado'}`; solo `rol:'admin'` → `administrador/admin`; nada → `empleado/empleado`; `propietario` pedido por un `administrador` → Forbidden, por `propietario` o super admin → ok; `rol:'super_admin'` por no-super → Forbidden. En `jwt.strategy.spec.ts`: `empresa_activa_id` es 2 con `?empresa_id=2` y `null` sin empresas. En `usuarios.service.spec.ts` (mock de supabase): `listar()` no devuelve `password_hash`, sí `empresas` y `tiene_password`; `crear` con error `23505` lanza `ConflictException`.
- [ ] **Step 2:** `pnpm test` → FAIL (funciones/campos inexistentes).
- [ ] **Step 3: implementar** — `resolverRolAlta` en `roles-empresa.ts`; `empresa_activa_id: activa?.empresa_id ?? null` en `validate`; `rol_empresa` con `@IsIn(ROLES_EMPRESA)` en el DTO; en el servicio `SELECT_CON_EMPRESAS = '*, usuario_empresas(empresa_id, rol)'`, `mapear` sin `password_hash` y con `empresas`/`tiene_password`, `crear(dto, forzarEmpresaIds, alta)` usando `alta.rol` y `alta.rol_empresa` y mapeando el código `23505` a `ConflictException('Ese correo ya está registrado.')`; en el controlador `crear` calcula `alta = resolverRolAlta(...)` y, para un admin, fuerza `[req.user.empresa_activa_id]`; `listar` acepta `?empresa_id=` (super admin) o usa `empresa_activa_id`.
- [ ] **Step 4:** `pnpm test && pnpm build` → PASS.
- [ ] **Step 5: Commit** `feat(usuarios): alta con rol por empresa, lista sin hash y correo repetido = 409`.

### Task U2: Frontend — crear usuarios desde la página Usuarios

**Files:**
- Modify: `app/src/api/types.ts`, `app/src/api/endpoints.ts`, `app/src/api/mappers.ts` (+ `mappers.test.ts`), `app/src/pages/Usuarios.tsx`

**Interfaces:**
- Produces: `listUsuarios(empresaId)`, `crearUsuario(empresaId, body: { nombre: string; email: string; password: string; rol_empresa: RolEmpresa })`; `mapMember(u: ApiUsuarioLista, empresaId: number, meId: number): Member`; `toRolEmpresa(role: Role): RolEmpresa`.

- [ ] **Step 1: tests que fallan** — `mapMember`: con contraseña y activo → `Aceptada/Activa`; sin contraseña → `Pendiente/—`; desactivado → `Aceptada/Suspendida`; `me` cuando el id coincide; rol de la empresa pedida (o `Empleado` si no aparece); sin correo usa `usuario-<id>`. `toRolEmpresa`: los cinco roles y `Titular → empleado`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: implementar** mappers, tipos y endpoints; en `Usuarios.tsx` cargar miembros con `listUsuarios(Number(co.id))`, cambiar el diálogo a nombre + correo + contraseña temporal (mín. 6) + rol, llamar `crearUsuario`, recargar la lista y mostrar el error del backend (p. ej. correo repetido); quitar `edits.invited` y el texto "no se enviará ningún correo".
- [ ] **Step 4:** `npm test && npm run typecheck && npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(usuarios): crear miembros desde la página Usuarios`.

## Self-Review

- **Spec coverage:** migraciones (ya escritas) ✔; JWT/guards con rol por empresa → B1–B3 ✔ (deviación explícita: el rol legacy se deriva de la empresa activa para no reescribir 17 archivos; `@Roles` sigue usando `admin|empleado|super_admin`); login con `empresas` → B3 ✔; usuarios sincronizados → B4 ✔; cliente/401 → F1 ✔; auth y empresa activa (`PATCH /auth/empresa-activa`) → F3/F4 ✔; Dashboard → F5 ✔; Gastos lista/detalle (la lista ya trae evidencias firmadas, por eso no se llama `GET /gastos/:id`) → F4/F6 ✔; Revisión y acciones → F2/F4 ✔; `VITE_API_URL` → F0 ✔; tests de guard/mappers → B1–B3, F1–F2, F5 ✔. Pendiente por diseño: espacio "Personal/Titular" oculto (el backend modela lo personal como `es_personal` por gasto, no como empresa).
- **Placeholders:** ninguno; el hash de contraseña del seed lo genera `pgcrypto` en SQL.
- **Consistencia de tipos:** `EmpresaRol`/`RolEmpresa` (B1) usados igual en B2–B4; `PatchBody` definido en `sync.ts` (F2) y consumido en `endpoints.ts`; `SessionUser` de `Auth.tsx` (F3) consumido por `AppState` (F4) y Layout (F6); `buildDashboard(co, resumen, expenses)` igual en test, implementación y `Dashboard.tsx`.
- **Review Focus:** cubiertos por tests en B1 (rol nulo/legacy), B2 (sin empresas), F1 (401 y backend caído), F2 (relaciones vacías y monto string), F5 (resumen vacío/nulo).
