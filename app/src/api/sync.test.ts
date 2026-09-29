import { describe, expect, it } from 'vitest';
import { planSync } from './sync';
import type { Expense } from '../data/types';

const base: Expense = {
  id: '5', date: new Date(2026, 8, 28), desc: 'Taxi', prov: 'Cabify', ruc: '', cat: 'Transporte', type: 'Empresarial',
  proj: '', pay: 'Yape', amt: 28.9, st: 'pend', user: 'Lucía', channel: 'Telegram', dupOf: null, ev: [], op: '',
};
const cats = [{ id: 1, nombre: 'Transporte' }, { id: 2, nombre: 'Materiales' }];

describe('planSync', () => {
  it('duplicado: "Conservar ambos" descarta la marca', () => {
    expect(planSync({ ...base, st: 'dup' }, { st: 'ok', dupOf: null }, cats)).toEqual({ kind: 'descartarDuplicado' });
  });
  it('duplicado: "Descartar este gasto" confirma el duplicado', () => {
    expect(planSync({ ...base, st: 'dup' }, { st: 'desc' }, cats)).toEqual({ kind: 'confirmarDuplicado' });
  });
  it('confirmar sin cambios usa confirmar-confianza', () => {
    expect(planSync(base, { st: 'ok' }, cats)).toEqual({ kind: 'confirmarConfianza' });
  });
  it('confirmar con datos corregidos hace PATCH solo de lo que cambió', () => {
    expect(planSync(base, { st: 'ok', amt: 30, cat: 'Materiales', type: 'Personal', desc: 'Taxi aeropuerto' }, cats))
      .toEqual({ kind: 'patch', body: { monto: 30, descripcion: 'Taxi aeropuerto', es_personal: true, categoria_id: 2 } });
  });
  it('categoría que no existe en el backend se ignora', () => {
    expect(planSync(base, { st: 'ok', cat: 'Inventada' }, cats)).toEqual({ kind: 'confirmarConfianza' });
  });
  it('editar un gasto ya registrado hace PATCH', () => {
    expect(planSync({ ...base, st: 'ok' }, { st: 'ok', desc: 'Nuevo texto' }, cats)).toEqual({ kind: 'patch', body: { descripcion: 'Nuevo texto' } });
  });
  it('campos que el backend no soporta (proyecto, proveedor, RUC) no llaman a la API', () => {
    expect(planSync({ ...base, st: 'ok' }, { proj: 'Obra Surco', prov: 'Otro', ruc: '20123456789' }, cats)).toEqual({ kind: 'none' });
  });
});
