import { api } from './client';
import type { PatchBody } from './sync';
import type { ApiCategoria, ApiConteos, ApiEmpresa, ApiGasto, ApiLogin, ApiPedido, ApiPerfil, ApiProveedor, ApiResumen, ApiUsuario, ApiUsuarioLista, EstadoPedido, Moneda, RolEmpresa } from './types';

export const login = (email: string, password: string) =>
  api<ApiLogin>('/auth/login', { method: 'POST', body: { email, password } });
export const me = () => api<Partial<ApiUsuario>>('/auth/me', { method: 'POST' });
// Configuración personal: siempre sobre el usuario de la sesión.
export interface CambiosPerfil { nombre?: string; email?: string; password_actual?: string; password_nueva?: string }
export const actualizarPerfil = (body: CambiosPerfil) => api<ApiPerfil>('/auth/perfil', { method: 'PATCH', body });
export const subirAvatar = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<ApiPerfil>('/auth/perfil/avatar', { method: 'PATCH', body: form });
};
export const quitarAvatar = () => api<ApiPerfil>('/auth/perfil/avatar', { method: 'DELETE' });
export const empresasMias = () => api<ApiEmpresa[]>('/empresas/mias');
export const setEmpresaActiva = (empresaId: number) =>
  api<{ ultima_empresa_id: number }>('/auth/empresa-activa', { method: 'PATCH', body: { empresa_id: empresaId } });

export const listGastos = (empresaId: number) =>
  api<ApiGasto[]>('/gastos', { query: { empresa_id: empresaId, limite: 200 } });
export const resumen = (empresaId: number) => api<ApiResumen>('/gastos/resumen', { query: { empresa_id: empresaId } });
export const conteos = (empresaId: number) => api<ApiConteos>('/gastos/conteos', { query: { empresa_id: empresaId } });

// Espacio "Gastos personales": mis gastos marcados como personales, de todas mis empresas.
const PERSONAL = { ambito: 'personal' } as const;
export const listGastosPersonales = () => api<ApiGasto[]>('/gastos', { query: { ...PERSONAL, limite: 200 } });
export const resumenPersonal = () => api<ApiResumen>('/gastos/resumen', { query: PERSONAL });
export const conteosPersonal = () => api<ApiConteos>('/gastos/conteos', { query: PERSONAL });
export const categorias = (empresaId: number) => api<ApiCategoria[]>('/categorias', { query: { empresa_id: empresaId } });

const accion = (id: number, empresaId: number, ruta: string) =>
  api<unknown>('/gastos/' + id + '/' + ruta, { method: 'PATCH', query: { empresa_id: empresaId } });
export const patchGasto = (id: number, empresaId: number, body: PatchBody) =>
  api<unknown>('/gastos/' + id, { method: 'PATCH', body, query: { empresa_id: empresaId } });
export const confirmarConfianza = (id: number, empresaId: number) => accion(id, empresaId, 'confirmar-confianza');
export const confirmarDuplicado = (id: number, empresaId: number) => accion(id, empresaId, 'confirmar-duplicado');
export const descartarDuplicado = (id: number, empresaId: number) => accion(id, empresaId, 'descartar-duplicado');
export const rechazar = (id: number, empresaId: number) => accion(id, empresaId, 'rechazar');

export interface NuevoUsuario { nombre: string; email: string; password: string; rol_empresa: RolEmpresa; puede_registrar_personal?: boolean }
export const listUsuarios = (empresaId: number) => api<ApiUsuarioLista[]>('/usuarios', { query: { empresa_id: empresaId } });
export const crearUsuario = (empresaId: number, u: NuevoUsuario) =>
  api<ApiUsuarioLista>('/usuarios', { method: 'POST', body: { ...u, empresa_ids: [empresaId] }, query: { empresa_id: empresaId } });

// ── Proyectos/pedidos, proveedores, categorías, usuarios y empresa ──
export interface NuevoPedido { nombre: string; cliente?: string; presupuesto?: number }
export const listPedidos = (empresaId: number) => api<ApiPedido[]>('/pedidos', { query: { empresa_id: empresaId } });
export const crearPedido = (empresaId: number, p: NuevoPedido) =>
  api<ApiPedido>('/pedidos', { method: 'POST', body: p, query: { empresa_id: empresaId } });
export const actualizarPedido = (id: number, empresaId: number, body: { estado?: EstadoPedido }) =>
  api<ApiPedido>('/pedidos/' + id, { method: 'PATCH', body, query: { empresa_id: empresaId } });

export const listProveedores = (empresaId: number) => api<ApiProveedor[]>('/proveedores', { query: { empresa_id: empresaId } });

export const crearCategoria = (empresaId: number, nombre: string) =>
  api<ApiCategoria>('/categorias', { method: 'POST', body: { nombre }, query: { empresa_id: empresaId } });
export const renombrarCategoria = (id: number, empresaId: number, nombre: string) =>
  api<ApiCategoria>('/categorias/' + id, { method: 'PATCH', body: { nombre }, query: { empresa_id: empresaId } });
export const eliminarCategoria = (id: number, empresaId: number) =>
  api<unknown>('/categorias/' + id, { method: 'DELETE', query: { empresa_id: empresaId } });

export const actualizarUsuario = (id: number, empresaId: number, body: { rol_empresa?: RolEmpresa; activo?: boolean; puede_registrar_personal?: boolean }) =>
  api<ApiUsuarioLista>('/usuarios/' + id, { method: 'PATCH', body, query: { empresa_id: empresaId } });

export interface DatosEmpresa { nombre?: string; ruc?: string | null; direccion?: string | null; moneda?: Moneda }
export const actualizarEmpresa = (empresaId: number, body: DatosEmpresa) =>
  api<ApiEmpresa>('/empresas/' + empresaId, { method: 'PATCH', body, query: { empresa_id: empresaId } });
export const subirLogo = (empresaId: number, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<ApiEmpresa>('/empresas/' + empresaId + '/logo', { method: 'PATCH', body: form, query: { empresa_id: empresaId } });
};
