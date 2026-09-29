import { money, seeded, uniq } from '../lib/format';
import type { EvidenceGroup, EvidenceKind, Expense, Status } from './types';

export const PAYS = ['Tarjeta', 'Yape', 'Efectivo', 'Transferencia', 'Plin'];

/** [provider, category, descriptions, min amount, max amount, hasRuc?] */
type Vendor = [string, string, string[], number, number, false?];
interface Pool { v: Vendor[]; p: string[]; u: string[] }

const POOLS: Record<string, Pool> = {
  demo: {
    v: [
      ['Sodimac Perú S.A.', 'Materiales', ['Cemento y fierro para almacén', 'Pintura y brochas', 'Herramientas eléctricas'], 120, 1800],
      ['Promart Homecenter', 'Materiales', ['Tuberías PVC', 'Cableado eléctrico'], 80, 900],
      ['Cabify Perú', 'Transporte', ['Taxi a reunión con cliente', 'Traslado al aeropuerto'], 18, 65],
      ['Grifo Primax', 'Transporte', ['Combustible camioneta'], 90, 220],
      ['La Lucha Sanguchería', 'Alimentación', ['Almuerzo de equipo', 'Refrigerio de reunión'], 30, 140],
      ['Hostinger', 'Servicios', ['Hosting anual', 'Renovación de dominio'], 40, 420, false],
      ['Movistar Perú', 'Servicios', ['Internet fibra', 'Plan móvil corporativo'], 79, 199],
      ['Tai Loy S.A.', 'Oficina', ['Útiles de oficina', 'Tóner para impresora'], 25, 260],
    ],
    p: ['Remodelación oficina Miraflores', 'Pedido #1042 — Cliente Norte', 'Almacén Callao'],
    u: ['Lucía Ramírez', 'Jorge Paredes', 'Ana Quispe'],
  },
  sec: {
    v: [
      ['Tai Loy S.A.', 'Oficina', ['Útiles de oficina', 'Archivadores'], 20, 240],
      ['Movistar Perú', 'Servicios', ['Internet fibra'], 179, 179],
      ['Olva Courier', 'Transporte', ['Courier de documentos'], 12, 40],
      ['Starbucks Perú', 'Alimentación', ['Café de reunión'], 18, 60],
      ['Estudio Contable Medina', 'Servicios', ['Asesoría tributaria'], 350, 900],
    ],
    p: ['Auditoría 2026', 'Pedido #88 — Declaraciones'],
    u: ['Lucía Ramírez', 'Rosa Medina'],
  },
  andina: {
    v: [
      ['Unicon', 'Materiales', ['Concreto premezclado'], 1800, 6000],
      ['Promart Homecenter', 'Materiales', ['Ladrillos King Kong', 'Cemento Sol'], 300, 1400],
      ['Maquinarias JR', 'Maquinaria', ['Alquiler de mezcladora', 'Alquiler de andamios'], 400, 1500],
      ['Transportes Rímac S.A.', 'Transporte', ['Flete a obra'], 250, 600],
      ['Ferretería El Maestro', 'Materiales', ['Clavos y alambre', 'Herramientas manuales'], 60, 420],
      ['Cuadrilla Huamán', 'Mano de obra', ['Pago de jornales'], 600, 2400, false],
    ],
    p: ['Obra Surco', 'Edificio San Borja', 'Pedido #311 — Acabados'],
    u: ['Lucía Ramírez', 'Carlos Vega', 'Miguel Torres'],
  },
  norte: {
    v: [
      ['Taxi Satelital', 'Transporte', ['Taxi a notaría', 'Taxi a SUNARP'], 18, 40],
      ['Restaurante El Rincón', 'Alimentación', ['Menú ejecutivo'], 14, 24, false],
      ['Copias Express', 'Oficina', ['Impresiones y copias'], 6, 30, false],
    ],
    p: ['Trámite notarial'],
    u: ['Lucía Ramírez'],
  },
  rimac: {
    v: [
      ['Grifo Repsol', 'Combustible', ['Diésel flota'], 600, 2200],
      ['Rutas de Lima', 'Peajes', ['Peajes Panamericana'], 40, 200],
      ['Llantas Perú', 'Mantenimiento', ['Cambio de llantas', 'Alineamiento y balanceo'], 180, 2400],
      ['Rímac Seguros', 'Seguros', ['Póliza vehicular mensual'], 480, 900],
    ],
    p: ['Ruta Lima–Ica', 'Ruta Lima–Huacho'],
    u: ['Lucía Ramírez', 'Pedro Salas'],
  },
  personal: {
    v: [
      ['Pardos Chicken', 'Alimentación', ['Almuerzo', 'Cena familiar'], 30, 120],
      ['Wong', 'Hogar', ['Compras del mes', 'Limpieza'], 60, 380],
      ['Inkafarma', 'Salud', ['Farmacia'], 15, 90],
      ['ATU', 'Transporte', ['Recarga Metropolitano'], 10, 30, false],
      ['Cineplanet', 'Ocio', ['Entradas de cine'], 24, 70],
    ],
    p: [],
    u: ['Lucía Ramírez'],
  },
};

/** Categories a company uses by default (in vendor order). */
export const baseCategories = (coId: string) => uniq(POOLS[coId].v.map((v) => v[1]));
/** Built-in projects/orders for a company. */
export const baseProjects = (coId: string) => POOLS[coId].p;
/** Vendors the AI suggests a category for. */
export const vendorsForCategory = (coId: string, cat: string) =>
  uniq(POOLS[coId].v.filter((v) => v[1] === cat).map((v) => v[0]));

export const STAT: Record<Status, [label: string, tagClass: string]> = {
  proc: ['Procesando', 'tag tag-neutral'],
  pend: ['Pendiente de revisión', 'tag tag-accent'],
  info: ['Requiere información', 'tag tag-accent-2'],
  dup: ['Posible duplicado', 'tag tag-accent-2'],
  ok: ['Registrado', 'tag tag-outline'],
  err: ['Error de procesamiento', 'tag tag-accent-2'],
  desc: ['Descartado', 'tag tag-neutral'],
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

const SEQ: Status[] = ['pend', 'dup', 'info', 'pend', 'proc', 'err', 'pend', 'dup', 'pend', 'info', 'pend', 'pend'];
const CACHE: Record<string, Expense[]> = {};

/**
 * Demo expenses for a company: 34 rows, the first `reviewN` pending review.
 * Deterministic per company. Replace with a backend call when one exists.
 */
export function generateExpenses(coId: string, reviewN: number): Expense[] {
  if (CACHE[coId]) return CACHE[coId];
  const P = POOLS[coId];
  const r = seeded([...coId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 233280, 11));
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const rucs = P.v.map(() => '20' + String(Math.floor(r() * 1e9)).padStart(9, '0'));
  const list: Expense[] = [];
  let day = 0;
  for (let i = 0; i < 34; i++) {
    if (i > 0 && r() < 0.55) day++;
    const vi = Math.floor(r() * P.v.length);
    const v = P.v[vi];
    const ch = pick(['foto', 'foto', 'audio', 'texto']);
    const desc = pick(v[2]);
    const type = coId === 'personal' ? 'Personal' : r() < 0.9 ? 'Empresarial' : 'Personal';
    const proj = P.p.length && r() < 0.6 ? pick(P.p) : '';
    const pay = pick(PAYS);
    const amt = Math.round((v[3] + r() * (v[4] - v[3])) * 10) / 10;
    list.push({
      id: 'G-' + (4200 - i), date: new Date(2026, 8, 28 - day), desc, prov: v[0], ruc: v[5] === false ? '' : rucs[vi], cat: v[1],
      type, proj, pay, amt, st: i < reviewN ? SEQ[i % SEQ.length] : 'ok', user: pick(P.u), channel: 'Telegram · ' + ch, ev: [], op: '',
    });
  }
  list.forEach((e, i) => {
    if (e.st === 'dup') {
      const o = list[reviewN + i];
      Object.assign(e, { desc: o.desc, prov: o.prov, ruc: o.ruc, cat: o.cat, amt: o.amt, pay: o.pay, proj: o.proj, dupOf: o.id });
    }
    if (e.st === 'info') e.ruc = '';
    const ev: EvidenceKind[] = [];
    const comp: EvidenceKind = e.ruc && e.amt >= 100 ? 'Factura' : 'Boleta';
    if (e.channel.endsWith('audio')) ev.push('Audio');
    else if (e.channel.endsWith('foto')) ev.push(comp);
    if (e.pay === 'Yape' || e.pay === 'Plin' || e.pay === 'Transferencia') ev.push(e.pay);
    if (e.channel.endsWith('foto') && r() < 0.25) ev.push('Foto');
    e.ev = ev.map((k, j) => ({ k, file: k.toLowerCase() + '-' + e.id.slice(2) + (j ? '-' + j : '') + (k === 'Audio' ? '.ogg' : '.jpg') }));
    e.op = String(Math.floor(r() * 9e7) + 1e7);
  });
  return (CACHE[coId] = list);
}

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

export const projectKind = (name: string) => (name.startsWith('Pedido') ? 'Pedido' : 'Proyecto');
