export type Role = 'Propietario' | 'Administrador' | 'Contador' | 'Supervisor' | 'Empleado' | 'Titular';

export type PageId =
  | 'dashboard' | 'revision' | 'gastos' | 'comprobantes' | 'proveedores' | 'proyectos'
  | 'categorias' | 'reportes' | 'usuarios' | 'empresa' | 'personal' | 'telegram';

export interface Company {
  id: string;
  name: string;
  short: string;
  initials: string;
  role: Role;
  color: string;
  kind: 'Empresa' | 'Personal';
  /** Gastos pendientes de revisión (viene de /gastos/conteos). */
  review: number;
  ruc: string;
  address: string;
  currency: 'PEN' | 'USD';
  logoUrl: string | null;
}

export type Status = 'proc' | 'pend' | 'info' | 'dup' | 'ok' | 'err' | 'desc';
export type ExpenseType = 'Empresarial' | 'Personal';
export type EvidenceKind = 'Factura' | 'Boleta' | 'Yape' | 'Plin' | 'Transferencia' | 'Foto' | 'Audio';
export type EvidenceGroup = 'Comprobante' | 'Pago' | 'Evidencia';

export interface Evidence {
  k: EvidenceKind;
  file: string;
  /** URL firmada de la imagen real (solo datos del backend). */
  url?: string | null;
}

export interface Expense {
  id: string;
  date: Date;
  desc: string;
  prov: string;
  ruc: string;
  cat: string;
  type: ExpenseType;
  proj: string;
  pay: string;
  amt: number;
  st: Status;
  user: string;
  channel: string;
  dupOf?: string | null;
  ev: Evidence[];
  op: string;
  /** Confianza de la lectura automática: alta | media | baja. */
  conf?: string;
  /** Momento real de registro (ISO). */
  createdAt?: string;
  /** Empresa del gasto (en "Gastos personales" se mezclan varias). */
  empresaId?: number | null;
  /** Usuario que registró el gasto. */
  userId?: number | null;
}

export interface Member {
  id?: number;
  name: string;
  email: string;
  role: Role;
  inv: 'Aceptada' | 'Pendiente' | 'Expirada';
  acc: 'Activa' | 'Suspendida' | '—';
  me?: boolean;
  /** Puede registrar gastos personales (lo decide el propietario). */
  personal: boolean;
  /** Puede gestionar las cuentas del bot de Telegram (lo decide el propietario). */
  telegram: boolean;
}

export interface Notification {
  icon: string;
  /** 'a' = accent (info), 'a2' = accent-2 (needs attention). */
  c: 'a' | 'a2';
  text: string;
  time: string;
}
