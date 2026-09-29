import { mapGasto } from '../api/mappers';
import type { ApiResumen } from '../api/types';
import { curve, fd, money, MONTHS } from '../lib/format';
import type { Company, Expense } from './types';

type ReviewKind = 'dup' | 'info' | 'pend' | 'proc' | 'err';

const REVIEW_KIND: Record<ReviewKind, [tone: 'a' | 'a2' | 'n', label: string]> = {
  dup: ['a2', 'Posible duplicado'],
  info: ['a2', 'Requiere info'],
  pend: ['a', 'Pendiente'],
  proc: ['n', 'Procesando'],
  err: ['a2', 'Error'],
};

export const CAT_ICON: Record<string, string> = {
  Materiales: 'ph-package', Servicios: 'ph-plugs', Transporte: 'ph-car', Alimentación: 'ph-fork-knife', Oficina: 'ph-paperclip',
  Otros: 'ph-dots-three', Maquinaria: 'ph-gear', 'Mano de obra': 'ph-hard-hat', Combustible: 'ph-gas-pump', Mantenimiento: 'ph-wrench',
  Peajes: 'ph-road-horizon', Seguros: 'ph-shield-check', Hogar: 'ph-house', Salud: 'ph-first-aid', Ocio: 'ph-film-slate',
};

export interface Delta { delta: string; vs: string; dColor: string; up: number }

const NO_DELTA: Delta = { delta: '—', vs: 'sin comparativo', dColor: 'var(--color-neutral-700)', up: 0 };

export const CHART_W = 600;
export const CHART_H = 200;

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const PALETTE = ['var(--color-accent)', 'var(--color-violet)', 'var(--color-accent-700)', 'var(--color-neutral-500)', 'var(--color-neutral-300)', 'var(--color-neutral-200)'];

const EMPTY: ApiResumen = {
  today: 0, week: 0, month: 0, company: 0, personal: 0, topCategorias: [], topProveedores: [], recientes: [], tendenciaDiaria: [],
};

const isoOf = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** Serie de 14 días; si el backend no la trae completa, se rellena con ceros terminando hoy. */
function lastFourteenDays(r: ApiResumen): { fecha: string; total: number }[] {
  if (r.tendenciaDiaria.length === 14) return r.tendenciaDiaria;
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return { fecha: isoOf(d), total: 0 };
  });
}

const dayNum = (iso: string) => Number(iso.slice(8, 10));
const monthIdx = (iso: string) => Number(iso.slice(5, 7)) - 1;

function sparkOf(vals: number[]) {
  const x = Math.max(...vals);
  const n = Math.min(...vals);
  return curve(vals.map((v, i) => [(i / (vals.length - 1)) * 100, 3 + (1 - (v - n) / (x - n || 1)) * 22] as [number, number]));
}

export function buildDashboard(co: Company, resumen: ApiResumen | null, expenses: Expense[]) {
  const r = resumen ?? EMPTY;
  const days = lastFourteenDays(r);
  const vals = days.map((d) => d.total);
  const lastIso = days[13].fecha;
  const mIdx = monthIdx(lastIso);
  const year = Number(lastIso.slice(0, 4));

  const P = 18;
  const mx = Math.max(...vals);
  const mn = Math.min(...vals) * 0.6;
  const pts = vals.map((v, i) => [(i / 13) * CHART_W, P + (1 - (v - mn) / (mx - mn || 1)) * (CHART_H - 2 * P)] as [number, number]);
  const line = curve(pts);

  // Categorías del mes en curso, por monto (sobre los gastos cargados).
  const byCat: Record<string, number> = {};
  let catTotal = 0;
  for (const e of expenses) {
    if (e.st === 'desc' || e.date.getFullYear() !== year || e.date.getMonth() !== mIdx) continue;
    byCat[e.cat] = (byCat[e.cat] || 0) + e.amt;
    catTotal += e.amt;
  }
  const C = 2 * Math.PI * 40;
  let acc = 0;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, amount], i) => {
    const p = catTotal ? (amount / catTotal) * 100 : 0;
    const o = {
      name, pct: p.toFixed(0) + '%', amt: money(amount), color: PALETTE[i % 6],
      dash: Math.max(0, (C * p) / 100 - 1.5).toFixed(2) + ' ' + C.toFixed(2), off: ((-C * acc) / 100).toFixed(2),
    };
    acc += p;
    return o;
  });

  const kpi = (label: string, raw: number) => ({ label, raw, ...NO_DELTA, spark: sparkOf(vals), sc: 'var(--color-violet)' });

  const split = r.company + r.personal;
  const biz = split ? Math.round((r.company / split) * 100) : 100;

  const xIdx = [0, 1, 2, 3].map((i) => Math.round((i * 13) / 4));
  const xLabels = xIdx
    .map((idx, i) => (i === 0 ? dayNum(days[idx].fecha) + ' ' + MONTHS[monthIdx(days[idx].fecha)].toUpperCase() : String(dayNum(days[idx].fecha))))
    .concat('HOY');

  return {
    scope: co.role === 'Empleado' ? 'Mostrando solo tus gastos' : 'Todos los gastos de la organización',
    month: r.month,
    monthDelta: NO_DELTA,
    monthName: MONTH_NAMES[mIdx],
    monthLabel: MONTH_NAMES[mIdx][0].toUpperCase() + MONTH_NAMES[mIdx].slice(1),
    dayLabels: days.map((d) => dayNum(d.fecha) + ' de ' + MONTH_NAMES[monthIdx(d.fecha)]),
    kpis: [kpi('Hoy', r.today), kpi('Esta semana', r.week), kpi('Promedio diario', r.month / dayNum(lastIso))],
    vals, pts, line, area: line + ' L' + CHART_W + ' ' + CHART_H + ' L0 ' + CHART_H + ' Z',
    xLabels,
    cats, bizPct: biz + '%', perPct: 100 - biz + '%',
    review: expenses.filter((e) => e.st === 'dup' || e.st === 'pend').slice(0, 4).map((e) => {
      const kind: ReviewKind = e.st === 'dup' ? 'dup' : 'pend';
      const [tone, status] = REVIEW_KIND[kind];
      return { kind, title: (e.prov || e.desc || 'Gasto') + ' · ' + money(e.amt), status, color: tone === 'a2' ? 'var(--color-accent-2)' : 'var(--color-accent)' };
    }),
    recent: r.recientes.map(mapGasto).map((e) => ({
      date: fd(e.date), desc: e.desc || e.prov, prov: e.prov, cat: e.cat, amt: money(e.amt), icon: CAT_ICON[e.cat] || 'ph-receipt',
    })),
  };
}
