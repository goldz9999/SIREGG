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

/** Fila de GET /usuarios (sin hash de contraseña). */
export interface ApiUsuarioLista {
  id: number;
  nombre: string | null;
  email: string | null;
  rol: string;
  activo: boolean;
  tiene_password: boolean;
  empresas: { empresa_id: number; rol: RolEmpresa }[];
}

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
