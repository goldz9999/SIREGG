export type Role = 'Propietario' | 'Administrador' | 'Contador' | 'Supervisor' | 'Empleado' | 'Titular';

export type PageId =
  | 'dashboard' | 'revision' | 'gastos' | 'ingresos' | 'comprobantes' | 'proveedores' | 'proyectos'
  | 'categorias' | 'reportes' | 'usuarios' | 'empresa' | 'personal' | 'telegram' | 'soporte';

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
  /** Huella perceptual de la imagen (para reconocer la misma foto en otro gasto). */
  huella?: string | null;
}

export interface ExpenseItem {
  id?: number;
  producto: string;
  cantidad?: number | null;
  costo?: number | null;
  prioridad?: 'prioritario' | 'adicional' | null;
}

export interface ExpensePayment {
  id?: number;
  medio: string;
  numeroOperacion?: string | null;
  monto?: number | null;
  fecha?: string | null;
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
  /** Moneda original del comprobante (si requirió conversión cambiaria). */
  monedaOriginal?: string | null;
  /** Monto en la moneda original antes de convertir. */
  montoOriginal?: number | null;
  /** Tipo de cambio aplicado para la conversión. */
  tipoCambio?: number | null;
  /** Fecha de la tasa de cambio aplicada. */
  tipoCambioFecha?: string | null;
  /** Fuente de la tasa (p. ej. 'sunat' o 'manual'). */
  tipoCambioFuente?: string | null;
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
  items?: ExpenseItem[];
  payments?: ExpensePayment[];
  prioridad?: 'prioritario' | 'adicional' | null;
  subtotal?: number | null;
  igv?: number | null;
  comprobanteNumero?: string | null;
  comprobanteTipo?: string | null;
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
  /** Empresas a las que pertenece. */
  empresaIds: number[];
}

export interface Notification {
  icon: string;
  /** 'a' = accent (info), 'a2' = accent-2 (needs attention). */
  c: 'a' | 'a2';
  text: string;
  time: string;
}

export interface Ingreso {
  id: string;
  date: Date;
  desc: string;
  cliente: string;
  amt: number;
  monedaOriginal?: string | null;
  montoOriginal?: number | null;
  tipoCambio?: number | null;
  pay: string;
  op: string;
  proj: string;
  pedidoId?: number | null;
  user: string;
  channel: string;
  evidenciaUrl?: string | null;
  createdAt?: string;
  empresaId?: number | null;
}

export interface DesglosePedidoGanancia {
  pedidoId: number;
  nombre: string;
  ingresos: number;
  gastos: number;
  ganancia: number;
}

export interface Ganancia {
  periodo: string; // YYYY-MM
  totalIngresos: number;
  totalGastos: number;
  ganancia: number;
  margen: number; // Porcentaje de margen (ej: 42.5%)
  ultimoIngresoFecha?: string | null;
  desglosePedidos: DesglosePedidoGanancia[];
  cerrado?: boolean;
}

