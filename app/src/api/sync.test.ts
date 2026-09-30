import { describe, expect, it } from 'vitest';
import { planSync } from './sync';
import type { Expense } from '../data/types';

const base: Expense = {
  id: '5', date: new Date(2026, 8, 28), desc: 'Taxi', prov: 'Cabify', ruc: '', cat: 'Transporte', type: 'Empresarial',
  proj: '', pay: 'Yape', amt: 28.9, st: 'pend', user: 'Lucía', channel: 'Telegram', dupOf: null, ev: [], op: '',
};
const cats = [{ id: 1, nombre: 'Transporte' }, { id: 2, nombre: 'Materiales' }];
const peds = [{ id: 3, nombre: 'Obra Surco' }];

describe('planSync', () => {
  it('duplicado: "Conservar ambos" descarta la marca', () => {
    expect(planSync({ ...base, st: 'dup' }, { st: 'ok', dupOf: null }, cats, peds)).toEqual({ kind: 'descartarDuplicado' });
  });
  it('duplicado: "Descartar este gasto" confirma el duplicado', () => {
    expect(planSync({ ...base, st: 'dup' }, { st: 'desc' }, cats, peds)).toEqual({ kind: 'confirmarDuplicado' });
  });
  it('duplicado con datos corregidos: primero resuelve el duplicado y luego guarda los cambios', () => {
    expect(planSync({ ...base, st: 'dup' }, { st: 'ok', amt: 30 }, cats, peds)).toEqual({ kind: 'descartarDuplicado', body: { monto: 30 } });
    expect(planSync({ ...base, st: 'dup' }, { st: 'desc', desc: 'Otro' }, cats, peds)).toEqual({ kind: 'confirmarDuplicado', body: { descripcion: 'Otro' } });
  });
  it('confirmar sin cambios usa confirmar-confianza', () => {
    expect(planSync(base, { st: 'ok' }, cats, peds)).toEqual({ kind: 'confirmarConfianza' });
  });
  it('confirmar con datos corregidos hace PATCH solo de lo que cambió', () => {
    expect(planSync(base, { st: 'ok', amt: 30, cat: 'Materiales', type: 'Personal', desc: 'Taxi aeropuerto' }, cats, peds))
      .toEqual({ kind: 'patch', body: { monto: 30, descripcion: 'Taxi aeropuerto', es_personal: true, categoria_id: 2 } });
  });
  it('categoría que no existe en el backend se ignora', () => {
    expect(planSync(base, { st: 'ok', cat: 'Inventada' }, cats, peds)).toEqual({ kind: 'confirmarConfianza' });
  });
  it('editar un gasto ya registrado hace PATCH', () => {
    expect(planSync({ ...base, st: 'ok' }, { st: 'ok', desc: 'Nuevo texto' }, cats, peds)).toEqual({ kind: 'patch', body: { descripcion: 'Nuevo texto' } });
  });
  it('asignar un proyecto envía su pedido_id; quitarlo envía null', () => {
    expect(planSync({ ...base, st: 'ok' }, { proj: 'Obra Surco' }, cats, peds)).toEqual({ kind: 'patch', body: { pedido_id: 3 } });
    expect(planSync({ ...base, st: 'ok', proj: 'Obra Surco' }, { proj: '' }, cats, peds)).toEqual({ kind: 'patch', body: { pedido_id: null } });
  });
  it('un proyecto que no existe en el backend se ignora', () => {
    expect(planSync({ ...base, st: 'ok' }, { proj: 'Fantasma' }, cats, peds)).toEqual({ kind: 'none' });
  });
  it('proveedor nuevo: manda el nombre (y el RUC si cambió)', () => {
    expect(planSync(base, { st: 'ok', prov: 'Uber', ruc: '' }, cats, peds)).toEqual({ kind: 'patch', body: { proveedor_nombre: 'Uber' } });
    expect(planSync(base, { st: 'ok', prov: 'Uber', ruc: '20123456789' }, cats, peds))
      .toEqual({ kind: 'patch', body: { proveedor_nombre: 'Uber', proveedor_ruc: '20123456789' } });
  });
  it('solo cambia el RUC: corrige el del proveedor actual; vacío lo borra', () => {
    expect(planSync(base, { st: 'ok', ruc: '20123456789' }, cats, peds))
      .toEqual({ kind: 'patch', body: { proveedor_nombre: 'Cabify', proveedor_ruc: '20123456789' } });
    expect(planSync({ ...base, ruc: '20123456789' }, { st: 'ok', ruc: '' }, cats, peds))
      .toEqual({ kind: 'patch', body: { proveedor_nombre: 'Cabify', proveedor_ruc: null } });
  });
  it('medio de pago: se manda en minúsculas; sin cambios no llama a la API', () => {
    expect(planSync(base, { st: 'ok', pay: 'Efectivo' }, cats, peds)).toEqual({ kind: 'patch', body: { medio_pago: 'efectivo' } });
    expect(planSync({ ...base, st: 'ok' }, { prov: 'Cabify', ruc: '', pay: 'Yape' }, cats, peds)).toEqual({ kind: 'none' });
  });
  it('restaurar un duplicado ya descartado quita la marca (descartar-duplicado)', () => {
    expect(planSync({ ...base, st: 'desc', dupOf: '1' }, { st: 'ok', dupOf: null }, cats, peds)).toEqual({ kind: 'descartarDuplicado' });
  });
});
