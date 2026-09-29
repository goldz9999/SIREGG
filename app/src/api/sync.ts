import type { Expense } from '../data/types';

export interface PatchBody { monto?: number; descripcion?: string; es_personal?: boolean; categoria_id?: number; pedido_id?: number | null }

export type SyncPlan =
  | { kind: 'none' }
  | { kind: 'confirmarConfianza' }
  | { kind: 'confirmarDuplicado'; body?: PatchBody }
  | { kind: 'descartarDuplicado'; body?: PatchBody }
  | { kind: 'patch'; body: PatchBody };

/**
 * Decide qué endpoint corresponde a un cambio hecho desde la UI.
 * "Conservar ambos" (dup→ok) = el backend lo llama descartar-duplicado (NO es el mismo pago);
 * "Descartar este gasto" (dup→desc) = confirmar-duplicado (SÍ es el mismo pago, no suma a totales).
 * Si además se corrigieron datos, `body` se guarda DESPUÉS de resolver el duplicado.
 * Proveedor, RUC y medio de pago no se editan desde el gasto: no llaman a la API.
 */
export function planSync(
  cur: Expense,
  p: Partial<Expense>,
  cats: { id: number; nombre: string }[],
  pedidos: { id: number; nombre: string }[],
): SyncPlan {
  const body: PatchBody = {};
  if (p.amt !== undefined && p.amt !== cur.amt) body.monto = p.amt;
  if (p.desc !== undefined && p.desc !== cur.desc) body.descripcion = p.desc;
  if (p.type !== undefined && p.type !== cur.type) body.es_personal = p.type === 'Personal';
  if (p.cat !== undefined && p.cat !== cur.cat) {
    const c = cats.find((x) => x.nombre === p.cat);
    if (c) body.categoria_id = c.id;
  }
  if (p.proj !== undefined && p.proj !== cur.proj) {
    if (p.proj === '') body.pedido_id = null;
    else {
      const ped = pedidos.find((x) => x.nombre === p.proj);
      if (ped) body.pedido_id = ped.id;
    }
  }
  const hasBody = Object.keys(body).length > 0;

  if (cur.st === 'dup' && p.st === 'ok') return hasBody ? { kind: 'descartarDuplicado', body } : { kind: 'descartarDuplicado' };
  if (cur.st === 'dup' && p.st === 'desc') return hasBody ? { kind: 'confirmarDuplicado', body } : { kind: 'confirmarDuplicado' };

  if (hasBody) return { kind: 'patch', body };
  if (cur.st === 'pend' && p.st === 'ok') return { kind: 'confirmarConfianza' };
  return { kind: 'none' };
}
