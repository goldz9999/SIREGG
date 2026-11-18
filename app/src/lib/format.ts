const SYMBOL: Record<string, string> = { PEN: 'S/', USD: 'US$' };
let currency: keyof typeof SYMBOL = 'PEN';
/** Moneda de la organización activa (la fija AppState). */
export const setCurrency = (c: keyof typeof SYMBOL) => { currency = c; };
export const currencySymbol = (c?: string | null) => (c && c in SYMBOL ? SYMBOL[c] : SYMBOL[currency]);

export const money = (n: number) =>
  SYMBOL[currency] + ' ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formatea un monto en una moneda explícita (p. ej. el monto original en USD junto al convertido). */
export const moneyIn = (n: number, m?: string | null) => {
  const sym = currencySymbol(m);
  return sym + ' ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/** "28 set" */
export const fd = (d: Date) => d.getDate() + ' ' + MONTHS[d.getMonth()];

export const uniq = <T,>(a: T[]) => [...new Set(a)];

/** Smooth SVG path through points (horizontal-tangent cubic segments). */
export function curve(pts: [number, number][]) {
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ' C' + cx.toFixed(1) + ' ' + y0.toFixed(1) + ' ' + cx.toFixed(1) + ' ' + y1.toFixed(1) + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  }
  return d;
}

export const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('');
