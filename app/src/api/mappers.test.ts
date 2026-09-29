import { describe, expect, it } from 'vitest';
import { initialsOf, mapCompany, mapGasto, mapMember, mapRole, toRolEmpresa } from './mappers';
import type { ApiGasto, ApiUsuarioLista } from './types';

const gasto = (over: Partial<ApiGasto> = {}): ApiGasto => ({
  id: 12, pedido_id: null, creado_en: '2026-09-28T14:05:00Z', usuario_id: 1, usuario_nombre: 'Lucía Ramírez', empresa_id: 1, es_personal: false,
  descripcion: 'Cemento', monto: '1240.50', fecha: '2026-09-28', confianza: 'alta',
  pendiente_revision: false, posible_duplicado_de: null,
  categorias: { nombre: 'Materiales' }, proveedores: { nombre: 'Sodimac', ruc: '20100070970' }, pedidos: null,
  comprobantes: [{ id: 1, numero: 'F001-23', tipo: 'factura' }],
  pagos: [{ id: 1, medio: 'yape', numero_operacion: '998877' }],
  evidencias: [{ id: 1, tipo: 'imagen', origen: 'telegram', storage_path: 'a.webp', url: 'https://x/a.webp' }],
  ...over,
});

describe('mapGasto', () => {
  it('convierte un gasto completo', () => {
    const e = mapGasto(gasto());
    expect(e).toMatchObject({
      id: '12', desc: 'Cemento', prov: 'Sodimac', cat: 'Materiales', type: 'Empresarial',
      amt: 1240.5, st: 'ok', user: 'Lucía Ramírez', pay: 'Yape', op: '998877', dupOf: null, proj: '', conf: 'alta', createdAt: '2026-09-28T14:05:00Z', ruc: '20100070970', empresaId: 1,
    });
    expect(e.date.getFullYear()).toBe(2026);
    expect(e.date.getMonth()).toBe(8);
    expect(e.date.getDate()).toBe(28);
    expect(e.ev.map((x) => x.k)).toEqual(['Factura', 'Yape', 'Foto']);
    expect(e.ev[2].url).toBe('https://x/a.webp');
  });

  it('la factura y el pago muestran la foto del gasto (factura = primera, pago = última)', () => {
    const e = mapGasto(gasto({ evidencias: [
      { id: 1, tipo: 'imagen', origen: 'telegram', storage_path: 'f.webp', url: 'https://x/factura.webp' },
      { id: 2, tipo: 'imagen', origen: 'telegram', storage_path: 'y.webp', url: 'https://x/yape.webp' },
    ] }));
    expect(e.ev.find((x) => x.k === 'Factura')?.url).toBe('https://x/factura.webp');
    expect(e.ev.find((x) => x.k === 'Yape')?.url).toBe('https://x/yape.webp');
    expect(mapGasto(gasto({ evidencias: [] })).ev.find((x) => x.k === 'Factura')?.url).toBeNull();
  });

  it('estados: pendiente, duplicado pendiente, duplicado confirmado', () => {
    expect(mapGasto(gasto({ pendiente_revision: true })).st).toBe('pend');
    const dup = mapGasto(gasto({ pendiente_revision: true, posible_duplicado_de: 9 }));
    expect(dup.st).toBe('dup');
    expect(dup.dupOf).toBe('9');
    expect(mapGasto(gasto({ pendiente_revision: false, posible_duplicado_de: 9 })).st).toBe('desc');
  });

  it('gasto personal y relaciones vacías no rompen el mapeo', () => {
    const e = mapGasto(gasto({
      es_personal: true, descripcion: null, categorias: null, proveedores: null, usuario_nombre: null,
      comprobantes: [], pagos: [], evidencias: [], monto: 'abc',
    }));
    expect(e).toMatchObject({ type: 'Personal', desc: '', prov: '', cat: 'Sin categoría', user: '', pay: '', op: '', amt: 0, ev: [] });
  });

  it('boleta y medios de pago sin equivalente visual', () => {
    const e = mapGasto(gasto({
      comprobantes: [{ id: 2, numero: null, tipo: 'boleta' }],
      pagos: [{ id: 2, medio: 'efectivo', numero_operacion: null }],
      evidencias: [{ id: 3, tipo: 'audio', origen: 'web', storage_path: 'a.ogg' }],
    }));
    expect(e.ev.map((x) => x.k)).toEqual(['Boleta', 'Audio']);
    expect(e.pay).toBe('Efectivo');
  });
});

describe('empresas y roles', () => {
  it('mapRole traduce los cinco roles', () => {
    expect(mapRole('propietario')).toBe('Propietario');
    expect(mapRole('administrador')).toBe('Administrador');
    expect(mapRole('supervisor')).toBe('Supervisor');
    expect(mapRole('contador')).toBe('Contador');
    expect(mapRole('empleado')).toBe('Empleado');
  });

  it('mapCompany arma nombre corto, iniciales y color estable', () => {
    const c = mapCompany({ id: 3, nombre: 'Constructora Andina S.A.C.', activa: true, logo_url: null }, 'contador');
    expect(c).toMatchObject({ id: '3', name: 'Constructora Andina S.A.C.', short: 'Constructora Andina', initials: 'CA', role: 'Contador', kind: 'Empresa', review: 0 });
    expect(mapCompany({ id: 3, nombre: 'X', activa: true, logo_url: null }, 'empleado').color).toBe(c.color);
  });

  it('initialsOf tolera espacios y nombres vacíos', () => {
    expect(initialsOf('  lucía   ramírez ')).toBe('LR');
    expect(initialsOf('')).toBe('?');
  });

  it('toRolEmpresa traduce los roles de la UI (Titular cae a empleado)', () => {
    expect(toRolEmpresa('Propietario')).toBe('propietario');
    expect(toRolEmpresa('Administrador')).toBe('administrador');
    expect(toRolEmpresa('Supervisor')).toBe('supervisor');
    expect(toRolEmpresa('Contador')).toBe('contador');
    expect(toRolEmpresa('Empleado')).toBe('empleado');
    expect(toRolEmpresa('Titular')).toBe('empleado');
  });
});

describe('mapMember', () => {
  const u = (over: Partial<ApiUsuarioLista> = {}): ApiUsuarioLista => ({
    id: 4, nombre: 'Ana Quispe', email: 'ana@x.pe', rol: 'empleado', activo: true, tiene_password: true, puede_registrar_personal: false, puede_gestionar_telegram: false,
    empresas: [{ empresa_id: 7, rol: 'contador' }], ...over,
  });

  it('con contraseña y activo: aceptada y activa, con el rol de la empresa pedida', () => {
    expect(mapMember(u(), 7, 99)).toEqual({ id: 4, name: 'Ana Quispe', email: 'ana@x.pe', role: 'Contador', inv: 'Aceptada', acc: 'Activa', me: false, personal: false, telegram: false, empresaIds: [7] });
  });
  it('sin contraseña: pendiente y sin cuenta', () => {
    expect(mapMember(u({ tiene_password: false }), 7, 99)).toMatchObject({ inv: 'Pendiente', acc: '—' });
  });
  it('desactivado: aceptada y suspendida', () => {
    expect(mapMember(u({ activo: false }), 7, 99)).toMatchObject({ inv: 'Aceptada', acc: 'Suspendida' });
  });
  it('lleva el permiso de gastos personales', () => {
    expect(mapMember(u({ puede_registrar_personal: true }), 7, 99).personal).toBe(true);
  });
  it('marca al usuario actual', () => {
    expect(mapMember(u(), 7, 4).me).toBe(true);
  });
  it('si no aparece la empresa cae a Empleado, y sin correo usa un id estable', () => {
    const m = mapMember(u({ email: null, nombre: null, empresas: [] }), 7, 99);
    expect(m).toMatchObject({ role: 'Empleado', email: 'usuario-4', name: 'usuario-4' });
  });
  it('mapCompany lleva RUC, dirección, moneda y logotipo', () => {
    const c = mapCompany({ id: 1, nombre: 'Demo', activa: true, logo_url: 'https://x/logo.png', ruc: '20123456789', direccion: 'Av. Lima 1', moneda: 'USD' }, 'propietario');
    expect(c).toMatchObject({ ruc: '20123456789', address: 'Av. Lima 1', currency: 'USD', logoUrl: 'https://x/logo.png', role: 'Propietario' });
    expect(mapCompany({ id: 1, nombre: 'Demo', activa: true, logo_url: null }, 'empleado')).toMatchObject({ ruc: '', address: '', currency: 'PEN', logoUrl: null });
  });
});
