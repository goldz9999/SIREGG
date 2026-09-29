import { fd, money } from '../lib/format';
import type { Evidence, Expense } from './types';

/** Una fila de la comparación: `igual` es null cuando no aplica (p. ej. quién registró, o falta el dato en ambos). */
export interface FilaComparacion { campo: string; nuevo: string; existente: string; igual: boolean | null }

export interface Comparacion {
  filas: FilaComparacion[];
  coinciden: string[];
  difieren: string[];
  /** Por qué se detectó: "Misma factura 000014 y RUC", "Misma operación de Yape 06924092", "Misma fecha y monto". */
  motivo: string;
  nivel: 'alta' | 'media';
}

const TOLERANCIA = 0.5;
// Igual que el backend (UMBRAL_HUELLA): hasta 12 bits distintos de 256 es la misma imagen.
const UMBRAL_HUELLA = 12;
function distanciaHuella(a?: string | null, b?: string | null): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}
/** La misma imagen está en los dos gastos: devuelve qué es (factura, pago…) o null. */
function imagenComun(n: Expense, o: Expense): Evidence | null {
  for (const f of n.ev) {
    if (!f.huella) continue;
    if (o.ev.some((g) => distanciaHuella(f.huella, g.huella) <= UMBRAL_HUELLA)) return f;
  }
  return null;
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const esComprobante = (f: Evidence) => f.k === 'Factura' || f.k === 'Boleta';
export const esPago = (f: Evidence) => f.k === 'Yape' || f.k === 'Transferencia' || f.k === 'Plin';
const numeros = (x: Expense) => x.ev.filter(esComprobante).map((f) => f.file);
const comprobanteDe = (x: Expense) => x.ev.filter(esComprobante).map((f) => f.k + ' ' + f.file).join(', ');
const fechaLarga = (d: Date) => fd(d) + ' ' + d.getFullYear();
const medioDe = (x: Expense) => (x.pay ? x.pay + (x.op ? ' · Op. ' + x.op : '') : '');

/** Compara un gasto marcado como duplicado con el gasto original. */
export function compararDuplicado(n: Expense, o: Expense): Comparacion {
  const mismaFecha = n.date.toDateString() === o.date.toDateString();
  const mismoMonto = Math.abs(n.amt - o.amt) <= TOLERANCIA;
  const mismoProveedor = !!n.prov && !!o.prov && norm(n.prov) === norm(o.prov);
  const mismoRuc = !!n.ruc && !!o.ruc && n.ruc === o.ruc;
  const numComun = numeros(n).find((x) => numeros(o).includes(x));
  const mismaOperacion = !!n.op && !!o.op && n.op === o.op;
  const imagen = imagenComun(n, o);

  const cmp = (a: string, b: string, igual: boolean): boolean | null => (!a && !b ? null : igual);
  const filas: FilaComparacion[] = [
    { campo: 'Fecha', nuevo: fechaLarga(n.date), existente: fechaLarga(o.date), igual: mismaFecha },
    { campo: 'Proveedor', nuevo: n.prov, existente: o.prov, igual: cmp(n.prov, o.prov, mismoProveedor) },
    { campo: 'RUC', nuevo: n.ruc, existente: o.ruc, igual: cmp(n.ruc, o.ruc, mismoRuc) },
    { campo: 'Comprobante', nuevo: comprobanteDe(n), existente: comprobanteDe(o), igual: cmp(comprobanteDe(n), comprobanteDe(o), !!numComun) },
    { campo: 'Monto', nuevo: money(n.amt), existente: money(o.amt), igual: mismoMonto },
    { campo: 'Medio de pago', nuevo: medioDe(n), existente: medioDe(o), igual: cmp(medioDe(n), medioDe(o), medioDe(n) === medioDe(o)) },
    { campo: 'Registró', nuevo: n.user, existente: o.user, igual: null },
  ];

  const etiqueta: Record<string, (f: FilaComparacion) => string> = {
    Fecha: (f) => f.igual ? 'Fecha ' + f.nuevo : 'Fecha: ' + fd(n.date) + ' / ' + fd(o.date),
    Proveedor: () => 'Proveedor',
    RUC: (f) => f.igual ? 'RUC ' + f.nuevo : 'RUC',
    Comprobante: (f) => f.igual ? 'N.º ' + numComun : 'Comprobante',
    Monto: (f) => f.igual ? 'Monto ' + f.nuevo : 'Monto: ' + f.nuevo + ' / ' + f.existente,
    'Medio de pago': (f) => f.igual ? 'Medio de pago' : 'Medio: ' + (n.pay || 'sin pago') + ' / ' + (o.pay || 'sin pago'),
  };
  const coinciden = [...(imagen ? ['Misma imagen'] : []), ...filas.filter((f) => f.igual === true).map((f) => etiqueta[f.campo]?.(f) ?? f.campo)];
  const difieren = filas.filter((f) => f.igual === false).map((f) => etiqueta[f.campo]?.(f) ?? f.campo);

  const quien = o.user ? ' de ' + o.user : '';
  const tipoComp = n.ev.find(esComprobante)?.k.toLowerCase() ?? 'factura';
  let motivo: string;
  let nivel: 'alta' | 'media' = 'alta';
  if (imagen) {
    const que = esComprobante(imagen) ? 'foto de la ' + imagen.k.toLowerCase() : esPago(imagen) ? 'captura del pago' : 'foto';
    motivo = 'Misma imagen (' + que + ') que el gasto #' + o.id + quien;
  } else if (mismaOperacion) motivo = 'Misma operación de ' + (n.pay || 'pago') + ' ' + n.op + ' que el gasto #' + o.id + quien;
  else if (numComun && (mismoRuc || mismoProveedor)) motivo = 'Misma ' + tipoComp + ' ' + numComun + ' y ' + (mismoRuc ? 'RUC' : 'proveedor') + ' que el gasto #' + o.id + quien;
  else if (mismaFecha && mismoMonto) {
    motivo = 'Misma fecha y monto que el gasto #' + o.id + quien;
    nivel = numComun || mismoRuc || mismoProveedor ? 'alta' : 'media';
  } else {
    motivo = 'Coincide con el gasto #' + o.id + quien;
    nivel = 'media';
  }
  return { filas, coinciden, difieren, motivo, nivel };
}
