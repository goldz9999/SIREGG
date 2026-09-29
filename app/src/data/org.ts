import type { Company, Member, Notification, PageId, Role } from './types';

export const COMPANIES: Company[] = [
  { id: 'demo', name: 'Empresa Demo S.A.C.', short: 'Empresa Demo', initials: 'ED', role: 'Administrador', color: '#0088b0', kind: 'Empresa', review: 7 },
  { id: 'sec', name: 'Empresa Secundaria S.A.C.', short: 'Empresa Secundaria', initials: 'ES', role: 'Contador', color: '#6b5d52', kind: 'Empresa', review: 3 },
  { id: 'andina', name: 'Constructora Andina S.A.C.', short: 'Constructora Andina', initials: 'CA', role: 'Supervisor', color: '#4f6b3a', kind: 'Empresa', review: 12 },
  { id: 'norte', name: 'Inversiones Lima Norte E.I.R.L.', short: 'Lima Norte', initials: 'LN', role: 'Empleado', color: '#7a4b8c', kind: 'Empresa', review: 1 },
  { id: 'rimac', name: 'Transportes Rímac S.A.', short: 'Transportes Rímac', initials: 'TR', role: 'Propietario', color: '#a4552b', kind: 'Empresa', review: 0 },
];

export const PERSONAL: Company = {
  id: 'personal', name: 'Gastos personales', short: 'Personal', initials: 'GP', role: 'Titular', color: '#5c5856', kind: 'Personal', review: 2,
};

export const findCompany = (id: string): Company =>
  id === 'personal' ? PERSONAL : COMPANIES.find((c) => c.id === id) || COMPANIES[0];

export const PAGES: Record<PageId, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard', icon: 'ph-squares-four' },
  revision: { label: 'Revisión IA', icon: 'ph-sparkle' },
  gastos: { label: 'Gastos', icon: 'ph-receipt' },
  comprobantes: { label: 'Comprobantes y evidencias', icon: 'ph-files' },
  proveedores: { label: 'Proveedores', icon: 'ph-storefront' },
  proyectos: { label: 'Proyectos y pedidos', icon: 'ph-folders' },
  categorias: { label: 'Categorías', icon: 'ph-tag' },
  reportes: { label: 'Reportes', icon: 'ph-chart-bar' },
  usuarios: { label: 'Usuarios y miembros', icon: 'ph-users' },
  empresa: { label: 'Configuración de empresa', icon: 'ph-buildings' },
  personal: { label: 'Configuración personal', icon: 'ph-user-gear' },
};

export const NAV_GROUPS: { label: string; ids: PageId[] }[] = [
  { label: 'Principal', ids: ['dashboard', 'revision', 'gastos', 'comprobantes', 'proveedores', 'proyectos', 'categorias', 'reportes'] },
  { label: 'Administración', ids: ['usuarios', 'empresa', 'personal'] },
];

const ALL_PAGES = Object.keys(PAGES) as PageId[];

/** Pages each role can open. The UI only hides what the backend must also enforce. */
export const PERMS: Record<Role, PageId[]> = {
  Propietario: ALL_PAGES,
  Administrador: ALL_PAGES,
  Contador: ['dashboard', 'revision', 'gastos', 'comprobantes', 'proveedores', 'proyectos', 'categorias', 'reportes', 'personal'],
  Supervisor: ['dashboard', 'revision', 'gastos', 'comprobantes', 'proveedores', 'proyectos', 'reportes', 'personal'],
  Empleado: ['dashboard', 'revision', 'gastos', 'comprobantes', 'proyectos', 'personal'],
  Titular: ['dashboard', 'revision', 'gastos', 'comprobantes', 'proveedores', 'categorias', 'reportes', 'personal'],
};

export const ROLES: Role[] = ['Propietario', 'Administrador', 'Supervisor', 'Contador', 'Empleado'];

export const ROLE_DOCS: [Role, string][] = [
  ['Propietario', 'Control total, facturación y transferencia de la organización.'],
  ['Administrador', 'Gestiona miembros, categorías, proyectos y configuración.'],
  ['Supervisor', 'Revisa y aprueba gastos de su equipo y proyectos.'],
  ['Contador', 'Consulta todos los gastos, comprobantes y reportes; corrige clasificación.'],
  ['Empleado', 'Registra y consulta solo sus propios gastos.'],
];

export const NOTIFS: Record<string, Notification[]> = {
  demo: [
    { icon: 'ph-copy', c: 'a2', text: 'Posible duplicado: Tambo+ S/ 18.50', time: 'Hace 12 min' },
    { icon: 'ph-telegram-logo', c: 'a', text: '3 gastos recibidos por Telegram', time: 'Hace 1 h' },
    { icon: 'ph-warning', c: 'a2', text: 'Comprobante ilegible: Grifo Primax', time: 'Ayer' },
  ],
  sec: [{ icon: 'ph-check-circle', c: 'a', text: 'Reporte de agosto listo', time: 'Hace 3 h' }],
  andina: [
    { icon: 'ph-copy', c: 'a2', text: '2 posibles duplicados en Obra Surco', time: 'Hace 20 min' },
    { icon: 'ph-user-plus', c: 'a', text: 'Carlos Vega aceptó la invitación', time: 'Ayer' },
  ],
  norte: [],
  rimac: [],
  personal: [{ icon: 'ph-microphone', c: 'a', text: 'Audio procesado: almuerzo S/ 32.00', time: 'Hace 2 h' }],
};

type MemberRow = [string, string, Role, Member['inv'], Member['acc'], 1?];
const MEMBER_ROWS: Record<string, MemberRow[]> = {
  demo: [
    ['Martín Castro', 'martin.castro@empresademo.pe', 'Propietario', 'Aceptada', 'Activa'],
    ['Lucía Ramírez', 'lucia.ramirez@correo.pe', 'Administrador', 'Aceptada', 'Activa', 1],
    ['Jorge Paredes', 'jorge.paredes@empresademo.pe', 'Empleado', 'Aceptada', 'Activa'],
    ['Ana Quispe', 'ana.quispe@empresademo.pe', 'Supervisor', 'Aceptada', 'Activa'],
    ['Rosa Medina', 'rosa.medina@contamedina.pe', 'Contador', 'Pendiente', '—'],
    ['Diego Luna', 'diego.luna@empresademo.pe', 'Empleado', 'Aceptada', 'Suspendida'],
  ],
  sec: [
    ['Raúl Soto', 'raul.soto@secundaria.pe', 'Propietario', 'Aceptada', 'Activa'],
    ['Lucía Ramírez', 'lucia.ramirez@correo.pe', 'Contador', 'Aceptada', 'Activa', 1],
    ['Rosa Medina', 'rosa.medina@contamedina.pe', 'Administrador', 'Aceptada', 'Activa'],
  ],
  andina: [
    ['Elena Huamán', 'elena.huaman@andina.pe', 'Propietario', 'Aceptada', 'Activa'],
    ['Lucía Ramírez', 'lucia.ramirez@correo.pe', 'Supervisor', 'Aceptada', 'Activa', 1],
    ['Carlos Vega', 'carlos.vega@andina.pe', 'Empleado', 'Aceptada', 'Activa'],
    ['Miguel Torres', 'miguel.torres@andina.pe', 'Empleado', 'Aceptada', 'Activa'],
    ['Sofía Ríos', 'sofia.rios@andina.pe', 'Contador', 'Expirada', '—'],
  ],
  norte: [
    ['Héctor Díaz', 'hector.diaz@limanorte.pe', 'Propietario', 'Aceptada', 'Activa'],
    ['Lucía Ramírez', 'lucia.ramirez@correo.pe', 'Empleado', 'Aceptada', 'Activa', 1],
  ],
  rimac: [
    ['Lucía Ramírez', 'lucia.ramirez@correo.pe', 'Propietario', 'Aceptada', 'Activa', 1],
    ['Pedro Salas', 'pedro.salas@trimac.pe', 'Administrador', 'Aceptada', 'Activa'],
    ['Nora Chávez', 'nora.chavez@trimac.pe', 'Contador', 'Pendiente', '—'],
  ],
};

export const getMembers = (coId: string): Member[] =>
  (MEMBER_ROWS[coId] || []).map(([name, email, role, inv, acc, me]) => ({ name, email, role, inv, acc, me: !!me }));

export const ORG_INFO: Record<string, [ruc: string, address: string]> = {
  demo: ['20601234561', 'Av. Larco 1150, Miraflores, Lima'],
  sec: ['20607654329', 'Jr. Huallaga 320, Cercado de Lima'],
  andina: ['20512398764', 'Av. Primavera 890, Surco, Lima'],
  norte: ['20609871230', 'Av. Túpac Amaru 4410, Comas, Lima'],
  rimac: ['20456781236', 'Av. Argentina 2350, Callao'],
};

export const CURRENT_USER = { name: 'Lucía Ramírez', email: 'lucia.ramirez@correo.pe', initials: 'LR' };
