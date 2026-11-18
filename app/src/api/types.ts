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
  avatar_url?: string | null;
  /** Puede vincular o quitar cuentas del bot (el propietario siempre). */
  puede_gestionar_telegram?: boolean;
}
/** Respuesta de PATCH /auth/perfil y /auth/perfil/avatar. */
export interface ApiPerfil { id: number; nombre: string | null; email: string | null; avatar_url: string | null }
export interface ApiLogin { access_token: string; usuario: ApiUsuario }

/** Fila de GET /usuarios (sin hash de contraseña). */
export interface ApiUsuarioLista {
  id: number;
  nombre: string | null;
  email: string | null;
  rol: string;
  activo: boolean;
  tiene_password: boolean;
  /** Permiso efectivo: el propietario siempre puede; el resto si un propietario lo activó. */
  puede_registrar_personal: boolean;
  puede_gestionar_telegram: boolean;
  empresas: { empresa_id: number; rol: RolEmpresa }[];
}

/** Fila de GET /telegram/usuarios: miembros de la empresa activa y su cuenta del bot. */
export interface ApiTelegramUsuario {
  id: number;
  nombre: string | null;
  email: string | null;
  activo: boolean;
  telegram_id: number | null;
  rol_empresa: RolEmpresa;
  tiene_password: boolean;
}

export type Moneda = 'PEN' | 'USD';
export interface ApiEmpresa {
  id: number;
  nombre: string;
  activa: boolean;
  logo_url: string | null;
  ruc?: string | null;
  direccion?: string | null;
  moneda?: Moneda;
}
export interface ApiCategoria { id: number; nombre: string; empresa_id: number }

export interface ApiComprobanteItem {
  id?: number;
  producto: string;
  cantidad?: number | string | null;
  costo?: number | string | null;
  prioridad?: 'prioritario' | 'adicional' | null;
}

export interface ApiComprobante {
  id: number;
  numero: string | null;
  tipo: string;
  subtotal?: number | string | null;
  igv?: number | string | null;
  total?: number | string | null;
  moneda?: string | null;
  creado_en?: string;
  items?: ApiComprobanteItem[];
  comprobante_items?: ApiComprobanteItem[];
}

export interface ApiPago {
  id: number;
  medio: string;
  numero_operacion: string | null;
  monto?: number | string | null;
  fecha?: string | null;
  creado_en?: string;
}

export interface ApiGastoItem {
  id?: number;
  producto: string;
  cantidad?: number | string | null;
  costo?: number | string | null;
  prioridad?: 'prioritario' | 'adicional' | null;
}

export interface ApiGasto {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  empresa_id: number | null;
  es_personal: boolean;
  descripcion: string | null;
  monto: number | string; // PostgREST devuelve numeric como número o string
  moneda_original?: string | null;
  monto_original?: number | string | null;
  tipo_cambio?: number | string | null;
  tipo_cambio_fecha?: string | null;
  tipo_cambio_fuente?: string | null;
  prioridad?: 'prioritario' | 'adicional' | null;
  fecha: string; // YYYY-MM-DD
  confianza: string | null;
  pendiente_revision: boolean;
  posible_duplicado_de: number | null;
  pedido_id: number | null;
  creado_en: string;
  categorias: { nombre: string } | null;
  proveedores: { nombre: string; ruc?: string | null } | null;
  pedidos: { nombre: string } | null;
  comprobantes: ApiComprobante[];
  pagos: ApiPago[];
  gasto_items?: ApiGastoItem[];
  evidencias: { id: number; tipo: string; origen: string; storage_path: string; url?: string | null; creado_en?: string; huella?: string | null }[];
}

export interface ApiResumen {
  today: number;
  week: number;
  month: number;
  company: number;
  personal: number;
  prioritario?: number;
  adicional?: number;
  sin_clasificar?: number;
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

export interface ApiEstadoBot {
  token_configurado: boolean;
  secret_configurado: boolean;
  bot: { username: string; nombre: string } | null;
  webhook: { url: string | null; base_url: string | null; pendientes: number; ultimo_error: string | null; ultimo_error_en: string | null } | null;
  ruta_webhook: string;
}

export type EstadoPedido = 'activo' | 'finalizado' | 'cancelado';

export interface ApiPedido {
  id: number;
  empresa_id: number;
  nombre: string;
  cliente: string | null;
  presupuesto: number | string | null;
  estado: EstadoPedido;
  celular: string | null;
  fecha_culminacion: string | null;
  creado_en: string;
  cantidad_gastos: number;
  total_gastado: number;
}

export interface ApiProveedor {
  id: number;
  nombre: string;
  ruc: string | null;
  categoria_id_sugerida: number | null;
  es_personal_sugerido: boolean | null;
  empresa_id: number;
  veces_usado: number;
  ultimo_uso: string | null;
  categoria_sugerida_nombre: string | null;
}

export interface ApiIngreso {
  id: number;
  empresa_id: number;
  fecha: string;
  descripcion: string;
  cliente: string | null;
  monto: number | string;
  moneda_original?: string | null;
  monto_original?: number | string | null;
  tipo_cambio?: number | string | null;
  medio_pago?: string | null;
  numero_operacion?: string | null;
  pedido_id?: number | null;
  pedidos?: { nombre: string } | null;
  usuario_id?: number | null;
  usuario_nombre?: string | null;
  canal?: string | null;
  evidencia_url?: string | null;
  creado_en: string;
}

export interface ApiGananciaDesglose {
  pedido_id: number;
  nombre: string;
  ingresos: number | string;
  gastos: number | string;
  ganancia: number | string;
}

export interface ApiGanancia {
  periodo?: string;
  total_ingresos: number | string;
  total_gastos: number | string;
  ganancia: number | string;
  margen: number | string;
  ultimo_ingreso_fecha?: string | null;
  desglose_pedidos?: ApiGananciaDesglose[];
  cerrado?: boolean;
}

export interface NuevoIngreso {
  fecha: string;
  descripcion: string;
  monto: number;
  cliente?: string;
  moneda_original?: string;
  monto_original?: number;
  tipo_cambio?: number;
  medio_pago?: string;
  numero_operacion?: string;
  pedido_id?: number;
}

// ── Soporte y Tickets ──
export type TipoTicket = 'error' | 'duda' | 'sugerencia';
export type EstadoTicket = 'abierto' | 'en_proceso' | 'resuelto';

export interface ApiTicket {
  id: number;
  empresa_id: number | null;
  usuario_id: number;
  usuario_nombre?: string | null;
  asunto: string;
  tipo: TipoTicket;
  descripcion: string;
  pagina?: string | null;
  adjunto_path?: string | null;
  adjunto_url?: string | null;
  estado: EstadoTicket;
  respuesta?: string | null;
  creado_en: string;
  actualizado_en?: string;
}

export interface NuevoTicket {
  asunto: string;
  tipo: TipoTicket;
  descripcion: string;
  pagina?: string;
  empresa_id?: number;
}

