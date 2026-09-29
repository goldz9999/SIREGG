import { describe, expect, it } from 'vitest';
import type { ApiResumen } from '../api/types';
import { buildDashboard } from './dashboard';
import type { Company, Expense } from './types';

const co: Company = { id: '1', name: 'Demo', short: 'Demo', initials: 'D', role: 'Administrador', color: '#000', kind: 'Empresa', review: 0, ruc: '', address: '', currency: 'PEN', logoUrl: null };

const dias = Array.from({ length: 14 }, (_, i) => ({ fecha: `2026-09-${String(15 + i).padStart(2, '0')}`, total: i === 13 ? 300 : 100 }));
const resumen: ApiResumen = {
  today: 300, week: 1200, month: 4000, company: 3000, personal: 1000,
  topCategorias: [], topProveedores: [], recientes: [], tendenciaDiaria: dias,
};
const gasto = (cat: string, amt: number): Expense => ({
  id: cat + amt, date: new Date(2026, 8, 20), desc: 'x', prov: 'P', ruc: '', cat, type: 'Empresarial', proj: '', pay: '',
  amt, st: 'ok', user: '', channel: '', dupOf: null, ev: [], op: '',
});

describe('buildDashboard', () => {
  it('arma KPIs, serie de 14 días y etiquetas desde el resumen', () => {
    const d = buildDashboard(co, resumen, [gasto('Materiales', 300), gasto('Transporte', 100)]);
    expect(d.month).toBe(4000);
    expect(d.kpis.map((k) => k.raw)).toEqual([300, 1200, 4000 / 28]);
    expect(d.vals).toHaveLength(14);
    expect(d.pts).toHaveLength(14);
    expect(d.monthName).toBe('setiembre');
    expect(d.dayLabels[13]).toBe('28 de setiembre');
    expect(d.xLabels).toHaveLength(5);
    expect(d.xLabels[4]).toBe('HOY');
    expect(d.bizPct).toBe('75%');
    expect(d.perPct).toBe('25%');
    expect(d.cats.map((c) => c.name)).toEqual(['Materiales', 'Transporte']);
  });

  it('sin gastos (resumen vacío o nulo) no lanza y devuelve ceros', () => {
    for (const r of [null, { ...resumen, today: 0, week: 0, month: 0, company: 0, personal: 0, tendenciaDiaria: [] } as ApiResumen]) {
      const d = buildDashboard(co, r, []);
      expect(d.month).toBe(0);
      expect(d.vals).toHaveLength(14);
      expect(d.cats).toEqual([]);
      expect(d.review).toEqual([]);
      expect(d.recent).toEqual([]);
      expect(d.bizPct).toBe('100%');
    }
  });

  it('la lista de revisión toma duplicados y pendientes', () => {
    const pend: Expense = { ...gasto('Materiales', 50), st: 'pend', prov: 'Sodimac' };
    const dup: Expense = { ...gasto('Transporte', 10), st: 'dup', prov: 'Cabify' };
    const d = buildDashboard(co, resumen, [pend, dup, gasto('Otros', 5)]);
    expect(d.review.map((r) => r.kind)).toEqual(['pend', 'dup']);
    expect(d.review[0].title).toBe('Sodimac · S/ 50.00');
  });
});
