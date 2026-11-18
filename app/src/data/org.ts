import type { PageId, Role } from './types';

export const PAGES: Record<PageId, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard', icon: 'ph-squares-four' },
  revision: { label: 'Revisión IA', icon: 'ph-sparkle' },
  gastos: { label: 'Gastos', icon: 'ph-receipt' },
  ingresos: { label: 'Ingresos', icon: 'ph-trend-up' },
  comprobantes: { label: 'Comprobantes y evidencias', icon: 'ph-files' },
  proveedores: { label: 'Proveedores', icon: 'ph-storefront' },
  proyectos: { label: 'Proyectos y pedidos', icon: 'ph-folders' },
  categorias: { label: 'Categorías', icon: 'ph-tag' },
  reportes: { label: 'Reportes', icon: 'ph-chart-bar' },
  usuarios: { label: 'Usuarios y miembros', icon: 'ph-users' },
  empresa: { label: 'Configuración de empresa', icon: 'ph-buildings' },
  personal: { label: 'Configuración personal', icon: 'ph-user-gear' },
  telegram: { label: 'Bot de Telegram', icon: 'ph-telegram-logo' },
  soporte: { label: 'Ayuda y soporte', icon: 'ph-lifebuoy' },
};

export const NAV_GROUPS: { label: string; ids: PageId[] }[] = [
  { label: 'Principal', ids: ['dashboard', 'revision', 'gastos', 'ingresos', 'comprobantes', 'proveedores', 'proyectos', 'categorias', 'reportes'] },
];

/** Segunda barra lateral: se abre desde "Configuración". */
export const SETTINGS_GROUPS: { label: string; ids: PageId[] }[] = [
  { label: 'Tu cuenta', ids: ['personal'] },
  { label: 'Organización', ids: ['empresa', 'usuarios'] },
  { label: 'Integraciones', ids: ['telegram'] },
];
export const SETTINGS_PAGES: PageId[] = SETTINGS_GROUPS.flatMap((g) => g.ids);

const ALL_PAGES = Object.keys(PAGES) as PageId[];
// El bot de Telegram es uno para toda la plataforma: solo lo reconecta el propietario.
const ADMIN_PAGES = ALL_PAGES.filter((p) => p !== 'telegram');

/** Pages each role can open. The UI only hides what the backend must also enforce. */
export const PERMS: Record<Role, PageId[]> = {
  Propietario: ALL_PAGES,
  Administrador: ADMIN_PAGES,
  Contador: ['dashboard', 'revision', 'gastos', 'ingresos', 'comprobantes', 'proveedores', 'proyectos', 'categorias', 'reportes', 'personal', 'soporte'],
  Supervisor: ['dashboard', 'revision', 'gastos', 'comprobantes', 'proveedores', 'proyectos', 'reportes', 'personal', 'soporte'],
  Empleado: ['dashboard', 'revision', 'gastos', 'comprobantes', 'proyectos', 'personal', 'soporte'],
  // Espacio "Gastos personales": proveedores, categorías y proyectos son catálogos de cada empresa.
  Titular: ['dashboard', 'revision', 'gastos', 'ingresos', 'comprobantes', 'reportes', 'personal', 'soporte'],
};

export const ROLES: Role[] = ['Propietario', 'Administrador', 'Supervisor', 'Contador', 'Empleado'];

export const ROLE_DOCS: [Role, string][] = [
  ['Propietario', 'Control total de la organización: miembros, categorías, proyectos y configuración. Decide quién puede registrar gastos personales y quién gestiona las cuentas de Telegram.'],
  ['Administrador', 'Gestiona miembros, categorías, proyectos y configuración.'],
  ['Supervisor', 'Revisa gastos y gestiona proyectos y pedidos.'],
  ['Contador', 'Consulta gastos, comprobantes y reportes; gestiona categorías y proveedores.'],
  ['Empleado', 'Consulta y revisa los gastos de la organización.'],
];
