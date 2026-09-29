import type { Company, Evidence, Expense, Member, Role, Status } from '../data/types';
import type { ApiEmpresa, ApiGasto, ApiUsuarioLista, RolEmpresa } from './types';

const ROLE: Record<RolEmpresa, Role> = {
  propietario: 'Propietario', administrador: 'Administrador', supervisor: 'Supervisor', contador: 'Contador', empleado: 'Empleado',
};
export const mapRole = (r: RolEmpresa): Role => ROLE[r];

const ROL_EMPRESA: Record<Role, RolEmpresa> = {
  Propietario: 'propietario', Administrador: 'administrador', Supervisor: 'supervisor', Contador: 'contador', Empleado: 'empleado', Titular: 'empleado',
};
export const toRolEmpresa = (r: Role): RolEmpresa => ROL_EMPRESA[r];

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
    conf: g.confianza ?? undefined,
    createdAt: g.creado_en,
  };
}

/** Miembro de la empresa `empresaId` tal como lo muestra la página Usuarios. */
export function mapMember(u: ApiUsuarioLista, empresaId: number, meId: number): Member {
  const fallback = 'usuario-' + u.id;
  const rol = u.empresas.find((e) => e.empresa_id === empresaId)?.rol ?? 'empleado';
  return {
    id: u.id,
    name: u.nombre || fallback,
    email: u.email || fallback,
    role: ROLE[rol],
    inv: u.tiene_password ? 'Aceptada' : 'Pendiente',
    acc: !u.tiene_password ? '—' : u.activo ? 'Activa' : 'Suspendida',
    me: u.id === meId,
  };
}
