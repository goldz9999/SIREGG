import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { mapGasto } from '../api/mappers';
import { getExpenseItems, groupItemsByPriority } from '../data/items';
import { CoAvatar, Icon } from './ui';
import type { Expense } from '../data/types';
import { currencySymbol, fd, money, moneyIn } from '../lib/format';
import { useApp } from '../state/AppState';

interface BoletaProps {
  expense?: Expense;
  onClose?: () => void;
  asModal?: boolean;
}

export default function Boleta({ expense: expenseProp, onClose, asModal }: BoletaProps = {}) {
  const params = useParams<{ id: string }>();
  const id = expenseProp ? expenseProp.id : params.id;
  const navigate = useNavigate();
  const { co, expenses, duplicados } = useApp();
  const [loading, setLoading] = useState(!expenseProp);
  const [error, setError] = useState<string | null>(null);

  // Intentamos obtener el gasto del estado o de la prop primero
  const cached = expenseProp ?? (expenses.find((x) => x.id === id) ?? duplicados.find((x) => x.id === id));
  const [expense, setExpense] = useState<Expense | null>(cached || null);

  useEffect(() => {
    if (expenseProp) {
      setExpense(expenseProp);
      setLoading(false);
      return;
    }
    if (!id) return;
    let alive = true;
    const nId = Number(id);
    if (!Number.isInteger(nId)) {
      setError('ID de gasto inválido');
      setLoading(false);
      return;
    }

    const empresaId = cached?.empresaId ?? (co.id === 'personal' ? undefined : Number(co.id));
    endpoints.getGasto(nId, empresaId)
      .then((apiG) => {
        if (!alive) return;
        setExpense(mapGasto(apiG));
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        if (!cached) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar la información del gasto.');
        }
        setLoading(false);
      });

    return () => { alive = false; };
  }, [id, cached, co.id, expenseProp]);

  if (loading && !expense) {
    return (
      <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
        <span className="muted">Cargando boleta virtual…</span>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <button className="btn btn-ghost" onClick={() => (onClose ? onClose() : navigate('/gastos'))}>
          <Icon n="ph-arrow-left" /> {onClose ? 'Cerrar' : 'Volver a gastos'}
        </button>
        <div className="panel" style={{ padding: 32, textAlign: 'center', gap: 12 }}>
          <Icon n="ph-warning-circle" style={{ fontSize: 32, color: 'var(--color-accent-2)' }} />
          <h3>{error || 'No se encontró el gasto solicitado.'}</h3>
        </div>
      </div>
    );
  }

  const items = getExpenseItems(expense);
  const prioGroup = groupItemsByPriority(items, expense.amt);
  const payments = expense.payments && expense.payments.length > 0 ? expense.payments : null;
  const voucherCode = `B-${String(expense.id).padStart(6, '0')}`;
  const totalItems = items.reduce((s, it) => s + (it.costo != null ? it.costo * (it.cantidad || 1) : 0), 0) || expense.amt;

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 840, margin: '0 auto', width: '100%' }}>
      {/* Barra de acciones (oculta en impresión) */}
      <div className="row wrap boleta-actions" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {asModal ? (
          <button className="btn btn-ghost" onClick={onClose}>
            <Icon n="ph-x" /> Cerrar boleta
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => (onClose ? onClose() : navigate('/gastos/' + expense.id))}>
            <Icon n="ph-arrow-left" /> Volver al detalle
          </button>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Icon n="ph-printer" /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Contenedor imprimible de la boleta */}
      <div
        className="panel boleta-container"
        style={{
          background: 'var(--color-raised)',
          padding: 'clamp(20px, 4vw, 40px)',
          gap: 24,
          borderRadius: 16,
          boxShadow: 'var(--shadow-md)',
          color: 'var(--color-text)',
        }}
      >
        {/* Cabecera de la boleta */}
        <div
          className="row wrap"
          style={{
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            borderBottom: '2px solid var(--line)',
            paddingBottom: 20,
          }}
        >
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <CoAvatar co={co} size={56} fontSize={20} />
            <div className="stack" style={{ gap: 2 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {co.name}
              </h2>
              {co.ruc && (
                <span className="muted" style={{ fontSize: 13 }}>RUC: {co.ruc}</span>
              )}
              {co.address && (
                <span className="muted" style={{ fontSize: 12.5 }}>{co.address}</span>
              )}
            </div>
          </div>

          <div
            className="stack"
            style={{
              alignItems: 'flex-end',
              textAlign: 'right',
              gap: 4,
              minWidth: 200,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: 6,
                background: 'var(--color-accent-100)',
                color: 'var(--color-accent)',
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Comprobante de Gasto
            </span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>
              {voucherCode}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              Fecha: {fd(expense.date)}
            </span>
          </div>
        </div>

        {/* Leyenda obligatoria */}
        <div
          style={{
            padding: '8px 14px',
            background: 'var(--fill)',
            border: '1px dashed var(--line)',
            borderRadius: 8,
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--color-neutral-700)',
            textTransform: 'uppercase',
          }}
        >
          Documento interno · Sin valor tributario
        </div>

        {/* Datos generales */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            padding: '16px',
            background: 'var(--fill)',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          <div className="stack" style={{ gap: 3 }}>
            <span className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', fontWeight: 600 }}>
              Proveedor / Beneficiario
            </span>
            <strong style={{ fontSize: 14 }}>{expense.prov || '—'}</strong>
            {expense.ruc && <span className="muted" style={{ fontSize: 12 }}>RUC: {expense.ruc}</span>}
          </div>

          <div className="stack" style={{ gap: 3 }}>
            <span className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', fontWeight: 600 }}>
              Registrado por
            </span>
            <strong style={{ fontSize: 14 }}>{expense.user || '—'}</strong>
            <span className="muted" style={{ fontSize: 12 }}>Canal: {expense.channel}</span>
          </div>

          <div className="stack" style={{ gap: 3 }}>
            <span className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', fontWeight: 600 }}>
              Clasificación
            </span>
            <span>Categoría: <strong>{expense.cat}</strong></span>
            <span>Tipo: <strong>{expense.type}</strong></span>
            {expense.proj && <span>Proyecto: <strong>{expense.proj}</strong></span>}
          </div>
        </div>

        {/* Detalle ("En qué se usó") */}
        <div className="stack" style={{ gap: 12 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
              En qué se usó
            </h3>
            {prioGroup.hasClassification && (
              <span className="muted" style={{ fontSize: 12.5 }}>
                Agrupado por prioridad de compra
              </span>
            )}
          </div>

          {prioGroup.hasClassification ? (
            <div className="stack" style={{ gap: 14 }}>
              {/* Grupo Prioritario */}
              {prioGroup.prioritarios.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span className="tag tag-accent" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                      Productos Prioritarios
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      ({prioGroup.prioritarios.length} {prioGroup.prioritarios.length === 1 ? 'ítem' : 'ítems'})
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
                    <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--fill)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                          <th style={{ padding: '8px 12px' }}>Descripción / Ítem</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>Cant.</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: 120 }}>Costo</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: 120 }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prioGroup.prioritarios.map((it, idx) => {
                          const cant = it.cantidad || 1;
                          const costoUnit = it.costo ?? expense.amt / (items.length || 1);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{it.producto}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>{cant}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{money(costoUnit)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{money(cant * costoUnit)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot style={{ background: 'var(--fill)', fontWeight: 600, borderTop: '1px solid var(--line)' }}>
                        <tr>
                          <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal prioritario:</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-accent)' }}>
                            {money(prioGroup.subtotalPrioritarios)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Grupo Adicional */}
              {prioGroup.adicionales.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span className="tag tag-neutral" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                      Productos Adicionales
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      ({prioGroup.adicionales.length} {prioGroup.adicionales.length === 1 ? 'ítem' : 'ítems'})
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
                    <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--fill)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                          <th style={{ padding: '8px 12px' }}>Descripción / Ítem</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>Cant.</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: 120 }}>Costo</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: 120 }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prioGroup.adicionales.map((it, idx) => {
                          const cant = it.cantidad || 1;
                          const costoUnit = it.costo ?? expense.amt / (items.length || 1);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{it.producto}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>{cant}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{money(costoUnit)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{money(cant * costoUnit)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot style={{ background: 'var(--fill)', fontWeight: 600, borderTop: '1px solid var(--line)' }}>
                        <tr>
                          <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal adicional:</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {money(prioGroup.subtotalAdicionales)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Sin clasificar (si hubiera en un gasto parcialmente clasificado) */}
              {prioGroup.sinClasificar.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                    <span className="tag" style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase' }}>
                      Sin clasificar
                    </span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      ({prioGroup.sinClasificar.length})
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
                    <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--fill)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                          <th style={{ padding: '8px 12px' }}>Descripción / Ítem</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>Cant.</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: 120 }}>Costo</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: 120 }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prioGroup.sinClasificar.map((it, idx) => {
                          const cant = it.cantidad || 1;
                          const costoUnit = it.costo ?? expense.amt / (items.length || 1);
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{it.producto}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>{cant}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{money(costoUnit)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{money(cant * costoUnit)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot style={{ background: 'var(--fill)', fontWeight: 600, borderTop: '1px solid var(--line)' }}>
                        <tr>
                          <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal:</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {money(prioGroup.subtotalSinClasificar)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Total consolidado */}
              <div
                className="row wrap"
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--fill-strong)',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                }}
              >
                <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
                  <strong style={{ fontSize: 14 }}>Total de los productos:</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    (Prioritario: {money(prioGroup.subtotalPrioritarios)} · Adicional: {money(prioGroup.subtotalAdicionales)})
                  </span>
                </div>
                <span className="num" style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)' }}>
                  {money(totalItems)}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
              <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--fill)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '10px 14px' }}>Descripción / Ítem</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: 90 }}>Cant.</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: 130 }}>Costo</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: 130 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const cant = it.cantidad || 1;
                    const costoUnit = it.costo ?? (expense.amt / (items.length || 1));
                    const totalIt = cant * costoUnit;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontWeight: 500 }}>{it.producto}</span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{cant}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>{money(costoUnit)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                          {money(totalIt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ borderTop: '2px solid var(--line)', background: 'var(--fill)', fontWeight: 600 }}>
                  <tr>
                    <td colSpan={3} style={{ padding: '10px 14px', textAlign: 'right' }}>Total:</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--color-accent)' }}>
                      {money(totalItems)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Sección de Pagos */}
        <div className="stack" style={{ gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Detalle de pagos</h3>
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
            <table className="table" style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--fill)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '10px 14px' }}>Medio de pago</th>
                  <th style={{ padding: '10px 14px' }}>N° de operación</th>
                  <th style={{ padding: '10px 14px' }}>Fecha de pago</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Monto pagado</th>
                </tr>
              </thead>
              <tbody>
                {payments ? (
                  payments.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{p.medio}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {p.numeroOperacion ? <span className="mono">{p.numeroOperacion}</span> : <span className="faint">—</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{p.fecha ? fd(new Date(p.fecha + 'T12:00:00')) : fd(expense.date)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {p.monto != null ? money(p.monto) : money(expense.amt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{expense.pay || 'Sin medio de pago'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {expense.op ? <span className="mono">{expense.op}</span> : <span className="faint">—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{fd(expense.date)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                      {money(expense.amt)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen de totales */}
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, paddingTop: 10 }}>
          <div className="stack" style={{ gap: 6, maxWidth: 360 }}>
            {expense.montoOriginal != null && expense.tipoCambio != null && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--fill)',
                  borderRadius: 10,
                  fontSize: 12.5,
                  border: '1px solid var(--line)',
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Moneda original:</span>
                  <strong>{currencySymbol(expense.monedaOriginal)} {moneyIn(expense.montoOriginal, expense.monedaOriginal)}</strong>
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <span className="muted">Tipo de cambio aplicado:</span>
                  <span className="mono">{expense.tipoCambio} {expense.tipoCambioFuente ? `(${expense.tipoCambioFuente})` : ''}</span>
                </div>
              </div>
            )}
            {expense.comprobanteNumero && (
              <span className="muted" style={{ fontSize: 12 }}>
                Comprobante de origen: {expense.comprobanteTipo || 'Doc'} #{expense.comprobanteNumero}
              </span>
            )}
          </div>

          <div className="stack" style={{ minWidth: 240, gap: 8, textAlign: 'right' }}>
            {expense.subtotal != null && (
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">Subtotal:</span>
                <span>{money(expense.subtotal)}</span>
              </div>
            )}
            {expense.igv != null && (
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">I.G.V. (18%):</span>
                <span>{money(expense.igv)}</span>
              </div>
            )}
            <div
              className="row"
              style={{
                justifyContent: 'space-between',
                fontSize: 18,
                fontWeight: 700,
                borderTop: '2px solid var(--line)',
                paddingTop: 8,
              }}
            >
              <span>Total Gasto:</span>
              <span className="num" style={{ color: 'var(--color-accent)' }}>
                {money(expense.amt)}
              </span>
            </div>
          </div>
        </div>

        {/* Respaldo / Evidencias fotográficas */}
        {expense.ev && expense.ev.length > 0 && (
          <div className="stack" style={{ gap: 12, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Respaldo fotográfico y comprobantes adjuntos
            </h3>
            <div className="row wrap" style={{ gap: 12 }}>
              {expense.ev.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: 'var(--fill)',
                    padding: 6,
                    width: 140,
                    textAlign: 'center',
                  }}
                >
                  {ev.url ? (
                    <img
                      src={ev.url}
                      alt={ev.file}
                      style={{
                        width: '100%',
                        height: 100,
                        objectFit: 'cover',
                        borderRadius: 6,
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 100,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--color-neutral-200)',
                        borderRadius: 6,
                      }}
                    >
                      <Icon n="ph-file-text" style={{ fontSize: 32, color: 'var(--color-neutral-600)' }} />
                    </div>
                  )}
                  <div className="stack" style={{ gap: 1, marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{ev.k}</span>
                    <span className="muted ellipsis" style={{ fontSize: 10 }}>{ev.file}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
