import { curve, money, seeded } from '../lib/format';
import type { Company } from './types';

type ReviewKind = 'dup' | 'info' | 'pend' | 'proc' | 'err';

interface DashData {
  /** [today, yesterday, week, prev week, month, prev month] */
  k: [number, number, number, number, number, number];
  base: number;
  biz: number;
  cats: [string, number][];
  review: [ReviewKind, string, string][];
  recent: [string, string, string, string, number][];
}

const DASH: Record<string, DashData> = {
  demo: {
    k: [1382.4, 960, 11240.5, 12010, 48215.3, 44560], base: 1600, biz: 86,
    cats: [['Materiales', 38], ['Servicios', 16], ['Transporte', 18], ['Alimentación', 12], ['Oficina', 9], ['Otros', 7]],
    review: [['dup', 'Tambo+ · S/ 18.50', 'Coincide con un gasto del 27 set'], ['info', 'Grifo Primax · S/ 150.00', 'Comprobante ilegible, falta RUC'], ['pend', 'Sodimac Perú · S/ 1,240.00', 'Clasificación sugerida: Materiales'], ['proc', 'Audio de Telegram', 'Recibido hace 2 min']],
    recent: [['28 set', 'Cemento y fierro para almacén', 'Sodimac Perú', 'Materiales', 1240], ['28 set', 'Taxi a reunión con cliente', 'Cabify', 'Transporte', 28.9], ['27 set', 'Almuerzo de equipo', 'La Lucha Sanguchería', 'Alimentación', 96], ['27 set', 'Hosting anual', 'Hostinger', 'Servicios', 389], ['26 set', 'Combustible camioneta', 'Grifo Primax', 'Transporte', 150]],
  },
  sec: {
    k: [240, 410, 2890, 2440, 9870.6, 10420], base: 380, biz: 94,
    cats: [['Servicios', 34], ['Oficina', 22], ['Transporte', 18], ['Alimentación', 14], ['Otros', 12]],
    review: [['pend', 'Tai Loy · S/ 212.40', 'Clasificación sugerida: Oficina'], ['info', 'Boleta sin fecha · S/ 45.00', 'Falta la fecha de emisión']],
    recent: [['28 set', 'Útiles de oficina', 'Tai Loy', 'Oficina', 212.4], ['26 set', 'Internet fibra', 'Movistar', 'Servicios', 179], ['25 set', 'Courier documentos', 'Olva Courier', 'Transporte', 22], ['24 set', 'Café reunión', 'Starbucks', 'Alimentación', 41.5]],
  },
  andina: {
    k: [6420, 5100, 31800, 28750, 126430, 118900], base: 7400, biz: 97,
    cats: [['Materiales', 52], ['Maquinaria', 19], ['Mano de obra', 14], ['Transporte', 9], ['Otros', 6]],
    review: [['dup', 'Unicon · S/ 4,860.00', 'Posible duplicado — Obra Surco'], ['dup', 'Promart · S/ 612.30', 'Posible duplicado — Obra Surco'], ['pend', 'Alquiler de mezcladora · S/ 950.00', 'Proyecto sugerido: Obra Surco'], ['err', 'Foto borrosa', 'No se pudo leer el comprobante']],
    recent: [['28 set', 'Concreto premezclado', 'Unicon', 'Materiales', 4860], ['28 set', 'Alquiler mezcladora', 'Maquinarias JR', 'Maquinaria', 950], ['27 set', 'Ladrillos King Kong', 'Promart', 'Materiales', 612.3], ['27 set', 'Flete a obra', 'Transportes Rímac', 'Transporte', 380]],
  },
  norte: {
    k: [64, 0, 318.5, 290, 1240.8, 1180], base: 90, biz: 100,
    cats: [['Transporte', 41], ['Alimentación', 33], ['Oficina', 26]],
    review: [['pend', 'Taxi Satelital · S/ 32.00', 'Clasificación sugerida: Transporte']],
    recent: [['28 set', 'Taxi a notaría', 'Taxi Satelital', 'Transporte', 32], ['26 set', 'Menú ejecutivo', 'Restaurante El Rincón', 'Alimentación', 18], ['24 set', 'Impresiones', 'Copias Express', 'Oficina', 14.5]],
  },
  rimac: {
    k: [2150, 2380, 14800, 15920, 61240, 63800], base: 2200, biz: 92,
    cats: [['Combustible', 46], ['Mantenimiento', 24], ['Peajes', 12], ['Seguros', 10], ['Otros', 8]],
    review: [],
    recent: [['28 set', 'Diésel flota', 'Grifo Repsol', 'Combustible', 1820], ['27 set', 'Peajes Panamericana', 'Rutas de Lima', 'Peajes', 186], ['26 set', 'Cambio de llantas', 'Llantas Perú', 'Mantenimiento', 2340]],
  },
  personal: {
    k: [48.5, 112, 386.2, 455, 1692.3, 1810], base: 120, biz: 0,
    cats: [['Alimentación', 36], ['Transporte', 21], ['Hogar', 19], ['Salud', 12], ['Ocio', 12]],
    review: [['pend', 'Audio: almuerzo · S/ 32.00', 'Clasificación sugerida: Alimentación']],
    recent: [['28 set', 'Almuerzo', 'Pardos Chicken', 'Alimentación', 32], ['27 set', 'Recarga Metropolitano', 'ATU', 'Transporte', 20], ['26 set', 'Farmacia', 'Inkafarma', 'Salud', 64.9]],
  },
};

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

const delta = (a: number, b: number, vs: string): Delta => {
  if (!b) return { delta: '—', vs, dColor: 'var(--color-neutral-700)', up: 0 };
  const p = ((a - b) / b) * 100;
  // Spending more is the alert case (pink); spending less is accent.
  return {
    delta: (p >= 0 ? '↑ ' : '↓ ') + Math.abs(p).toFixed(1) + '%', vs, up: p > 0 ? 1 : -1,
    dColor: p > 0 ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)',
  };
};

export const CHART_W = 600;
export const CHART_H = 200;

export function buildDashboard(co: Company) {
  const d = DASH[co.id];
  const [t, pt, w, pw, m, pm] = d.k;
  const rnd = seeded([...co.id].reduce((a, c) => a + c.charCodeAt(0), 7));

  // Last 14 days; the final point is today's real total.
  const vals = Array.from({ length: 14 }, (_, i) => (i === 13 ? t : d.base * (0.35 + rnd() * 1.1)));
  const P = 18;
  const mx = Math.max(...vals);
  const mn = Math.min(...vals) * 0.6;
  const pts = vals.map((v, i) => [(i / 13) * CHART_W, P + (1 - (v - mn) / (mx - mn || 1)) * (CHART_H - 2 * P)] as [number, number]);
  const line = curve(pts);

  const pal = ['var(--color-accent)', 'var(--color-violet)', 'var(--color-accent-700)', 'var(--color-neutral-500)', 'var(--color-neutral-300)', 'var(--color-neutral-200)'];
  const C = 2 * Math.PI * 40;
  let acc = 0;
  const cats = d.cats.map(([name, p], i) => {
    const o = { name, pct: p + '%', amt: money((m * p) / 100), color: pal[i % 6], dash: Math.max(0, (C * p) / 100 - 1.5).toFixed(2) + ' ' + C.toFixed(2), off: ((-C * acc) / 100).toFixed(2) };
    acc += p;
    return o;
  });

  const spark = (trend: number) => {
    const a = Array.from({ length: 10 }, (_, i) => 0.5 + rnd() * 0.6 + i * trend * 0.06);
    const x = Math.max(...a);
    const n = Math.min(...a);
    return curve(a.map((v, i) => [(i / 9) * 100, 3 + (1 - (v - n) / (x - n || 1)) * 22]));
  };
  const kpi = (label: string, raw: number, dd: Delta) => ({
    label, raw, ...dd, spark: spark(dd.up || 0),
    sc: dd.up > 0 ? 'var(--color-accent-2)' : dd.up < 0 ? 'var(--color-accent)' : 'var(--color-violet)',
  });
  const md = delta(m, pm, 'vs. agosto');

  return {
    scope: co.role === 'Empleado' ? 'Mostrando solo tus gastos' : co.kind === 'Personal' ? 'Espacio personal, separado de las empresas' : 'Todos los gastos de la organización',
    month: m,
    monthDelta: md,
    kpis: [kpi('Hoy', t, delta(t, pt, 'vs. ayer')), kpi('Esta semana', w, delta(w, pw, 'vs. semana anterior')), kpi('Promedio diario', m / 28, delta(m / 28, pm / 31, 'vs. agosto'))],
    vals, pts, line, area: line + ' L' + CHART_W + ' ' + CHART_H + ' L0 ' + CHART_H + ' Z',
    xLabels: ['15 SET', '18', '21', '24', 'HOY'],
    cats, bizPct: d.biz + '%', perPct: 100 - d.biz + '%',
    review: d.review.slice(0, 4).map(([k, title]) => {
      const [tone, status] = REVIEW_KIND[k];
      return { kind: k, title, status, color: tone === 'a2' ? 'var(--color-accent-2)' : tone === 'a' ? 'var(--color-accent)' : 'var(--color-neutral-500)' };
    }),
    recent: d.recent.map(([date, desc, prov, cat, a]) => ({ date, desc, prov, cat, amt: money(a), icon: CAT_ICON[cat] || 'ph-receipt' })),
  };
}
