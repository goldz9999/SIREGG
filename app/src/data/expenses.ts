import { money } from '../lib/format';
import type { EvidenceGroup, EvidenceKind, Expense, Status } from './types';

/** Medios de pago que reconoce el backend. */
export const PAYS = ['Yape', 'Transferencia', 'Efectivo', 'Tarjeta', 'Otro'];

export const STAT: Record<Status, [label: string, tagClass: string]> = {
  proc: ['Procesando', 'tag tag-neutral'],
  pend: ['Pendiente de revisión', 'tag tag-accent'],
  info: ['Requiere información', 'tag tag-accent-2'],
  dup: ['Posible duplicado', 'tag tag-accent-2'],
  ok: ['Registrado', 'tag tag-outline'],
  err: ['Error de procesamiento', 'tag tag-accent-2'],
  desc: ['Duplicado confirmado', 'tag tag-neutral'],
};

/** Statuses shown in pink: they need a human decision. */
export const ALERT_STATUSES: Status[] = ['dup', 'info', 'err'];
export const isPending = (st: Status) => st !== 'ok' && st !== 'desc';

export const KIND: Record<EvidenceKind, [EvidenceGroup, string]> = {
  Factura: ['Comprobante', 'ph-receipt'],
  Boleta: ['Comprobante', 'ph-receipt'],
  Yape: ['Pago', 'ph-device-mobile'],
  Plin: ['Pago', 'ph-device-mobile'],
  Transferencia: ['Pago', 'ph-bank'],
  Foto: ['Evidencia', 'ph-camera'],
  Audio: ['Evidencia', 'ph-microphone'],
};

export const GROUP_CLS: Record<EvidenceGroup, string> = {
  Comprobante: 'tag tag-accent',
  Pago: 'tag tag-neutral',
  Evidencia: 'tag tag-outline',
};

export const CAT_PALETTE = [
  'var(--color-accent)', 'var(--color-accent-700)', 'var(--color-neutral-700)',
  'var(--color-neutral-500)', 'var(--color-neutral-300)', 'var(--color-neutral-200)',
];

export interface CatSlice { name: string; amt: string; pct: string; w: string; color: string; tip: string }

export function catBreak(rows: Expense[]): CatSlice[] {
  const m: Record<string, number> = {};
  let t = 0;
  rows.forEach((e) => { m[e.cat] = (m[e.cat] || 0) + e.amt; t += e.amt; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, a], i) => ({
    name, amt: money(a), pct: (t ? (a / t) * 100 : 0).toFixed(0) + '%', w: (t ? (a / t) * 100 : 0) + '%',
    color: CAT_PALETTE[i % 6], tip: name + ' ' + money(a),
  }));
}
