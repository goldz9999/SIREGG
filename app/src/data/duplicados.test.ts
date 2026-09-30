import { describe, expect, it } from 'vitest';
import { compararDuplicado } from './duplicados';
import type { Expense } from './types';

const base: Expense = {
  id: '1', date: new Date(2026, 6, 20), desc: 'ROMMAX', prov: "ROMMAX'S FABRICA TEXTIL E&R S.A.C.", ruc: '20607668524', cat: 'Tela',
  type: 'Empresarial', proj: '', pay: '', amt: 368.5, st: 'ok', user: 'Adrian', channel: 'Telegram', dupOf: null,
  ev: [{ k: 'Factura', file: '000014', url: null }], op: '',
};

describe('compararDuplicado', () => {
  it('caso Miguel: misma factura y RUC con otra fecha y con Yape', () => {
    const nuevo: Expense = { ...base, id: '4', date: new Date(2026, 8, 3), prov: "ROMMAX'S FÁBRICA TEXTIL E&R S.A.C.", user: 'Miguel Peralta', pay: 'Yape', op: '06924092', st: 'dup', dupOf: '1',
      ev: [{ k: 'Factura', file: '000014', url: null }, { k: 'Yape', file: '06924092', url: null }] };
    const c = compararDuplicado(nuevo, base);
    expect(c.motivo).toBe('Misma factura 000014 y RUC que el gasto #1 de Adrian');
    expect(c.nivel).toBe('alta');
    expect(c.coinciden).toEqual(['Proveedor', 'RUC 20607668524', 'N.º 000014', 'Monto S/ 368.50']);
    expect(c.difieren).toEqual(['Fecha: 3 set / 20 jul', 'Medio: Yape / sin pago']);
    expect(c.filas.find((f) => f.campo === 'Registró')?.igual).toBeNull();
  });

  it('misma operación de Yape', () => {
    const o = { ...base, ev: [], pay: 'Yape', op: '555' };
    const c = compararDuplicado({ ...o, id: '9', amt: 10, date: new Date(2026, 0, 1) }, o);
    expect(c.motivo).toBe('Misma operación de Yape 555 que el gasto #1 de Adrian');
  });

  it('solo misma fecha y monto: confianza media', () => {
    const o = { ...base, ev: [], ruc: '', prov: '' };
    const c = compararDuplicado({ ...o, id: '9' }, o);
    expect(c.motivo).toBe('Misma fecha y monto que el gasto #1 de Adrian');
    expect(c.nivel).toBe('media');
  });
  it('misma imagen (la foto reenviada) tiene prioridad en el motivo', () => {
    const h = 'a'.repeat(64);
    const o = { ...base, ev: [{ k: 'Factura' as const, file: '000014', url: 'x', huella: h }] };
    const n = { ...base, id: '5', user: 'Miguel', ev: [{ k: 'Factura' as const, file: '000014', url: 'y', huella: 'a'.repeat(63) + 'b' }] };
    const c = compararDuplicado(n, o);
    expect(c.motivo).toBe('Misma imagen (foto de la factura) que el gasto #1 de Adrian');
    expect(c.coinciden[0]).toBe('Misma imagen');
  });
});
