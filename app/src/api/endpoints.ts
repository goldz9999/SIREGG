import { api } from './client';
import type { PatchBody } from './sync';
import type { ApiCategoria, ApiConteos, ApiEmpresa, ApiGasto, ApiLogin, ApiResumen, ApiUsuario, ApiUsuarioLista, RolEmpresa } from './types';

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

export interface NuevoUsuario { nombre: string; email: string; password: string; rol_empresa: RolEmpresa }
export const listUsuarios = (empresaId: number) => api<ApiUsuarioLista[]>('/usuarios', { query: { empresa_id: empresaId } });
export const crearUsuario = (empresaId: number, u: NuevoUsuario) =>
  api<ApiUsuarioLista>('/usuarios', { method: 'POST', body: { ...u, empresa_ids: [empresaId] }, query: { empresa_id: empresaId } });
