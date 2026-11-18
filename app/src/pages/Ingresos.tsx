import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { NuevoIngreso } from '../api/types';
import { Dialog, Icon, SearchInput, Select } from '../components/ui';
import { currencySymbol, fd, money, moneyIn } from '../lib/format';
import { useApp } from '../state/AppState';

const MEDIOS_PAGO = [
  { v: 'transferencia', l: 'Transferencia bancaria' },
  { v: 'yape', l: 'Yape' },
  { v: 'plin', l: 'Plin' },
  { v: 'efectivo', l: 'Efectivo' },
  { v: 'tarjeta', l: 'Tarjeta' },
  { v: 'otro', l: 'Otro' },
];

export default function Ingresos() {
  const { co, personal, ingresos, expenses, ganancia, canSeeFinances, crearIngreso, deleteIngreso, pedidos, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!canSeeFinances) {
    return <Navigate to="/dashboard" replace />;
  }

  const projectOptions = useMemo(() => [
    { v: '', l: 'Todos los proyectos' },
    ...pedidos.map((p) => ({ v: p.nombre, l: p.nombre })),
  ], [pedidos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingresos.filter((ing) => {
      if (filterProject && ing.proj !== filterProject) return false;
      if (!q) return true;
      return (
        ing.desc.toLowerCase().includes(q) ||
        ing.cliente.toLowerCase().includes(q) ||
        ing.op.toLowerCase().includes(q) ||
        ing.proj.toLowerCase().includes(q)
      );
    }).sort((a, b) => +b.date - +a.date);
  }, [ingresos, search, filterProject]);

  const totalFiltrado = useMemo(() => filtered.reduce((acc, i) => acc + i.amt, 0), [filtered]);

  const gastosPeriodo = useMemo(() => {
    return expenses
      .filter((e) => (personal ? true : e.type === 'Empresarial') && e.st !== 'desc')
      .reduce((s, e) => s + e.amt, 0);
  }, [expenses, personal]);

  const gananciaCalculada = useMemo(() => {
    if (ganancia) return ganancia.ganancia;
    return totalFiltrado - gastosPeriodo;
  }, [ganancia, totalFiltrado, gastosPeriodo]);

  const margenCalculado = useMemo(() => {
    if (ganancia) return ganancia.margen;
    return totalFiltrado > 0 ? Math.round(((totalFiltrado - gastosPeriodo) / totalFiltrado) * 1000) / 10 : 0;
  }, [ganancia, totalFiltrado, gastosPeriodo]);

  const handleDelete = async (id: string) => {
    try {
      await deleteIngreso(id);
      setDeletingId(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo eliminar el ingreso.', 'ph-warning-circle');
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      {/* Encabezado */}
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>{co.name} · Finanzas</span>
          <h1 style={{ fontSize: 'clamp(24px,2.6vw,30px)', margin: 0, fontWeight: 600, letterSpacing: '-.025em' }}>
            Ingresos
          </h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Icon n="ph-plus" /> Registrar ingreso
        </button>
      </div>

      {/* Tarjetas KPI de resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="panel" style={{ padding: 18, gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Total de ingresos</span>
          <span className="num" style={{ fontSize: 26, fontWeight: 600, color: 'var(--color-accent)' }}>
            {money(totalFiltrado)}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="panel" style={{ padding: 18, gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>{personal ? 'Total de gastos' : 'Gastos empresariales'}</span>
          <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>
            {money(gastosPeriodo)}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {personal ? 'Excluye duplicados descartados' : 'Excluye personales y duplicados'}
          </span>
        </div>

        <div className="panel" style={{ padding: 18, gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Ganancia estimada</span>
          <span
            className="num"
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: gananciaCalculada >= 0 ? 'var(--color-accent)' : 'var(--color-accent-2)',
            }}
          >
            {money(gananciaCalculada)}
          </span>
          <span className="row" style={{ gap: 6, fontSize: 12 }}>
            <span
              style={{
                fontWeight: 600,
                color: margenCalculado >= 0 ? 'var(--color-accent)' : 'var(--color-accent-2)',
              }}
            >
              Margen: {margenCalculado}%
            </span>
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="row wrap" style={{ gap: 12, alignItems: 'center' }}>
        <SearchInput
          placeholder="Buscar por descripción, cliente u operación..."
          value={search}
          onChange={setSearch}
          style={{ maxWidth: 360, flex: 1 }}
        />
        {pedidos.length > 0 && (
          <Select
            label="Proyecto"
            value={filterProject}
            options={projectOptions}
            onChange={setFilterProject}
            style={{ maxWidth: 220 }}
          />
        )}
      </div>

      {/* Tabla de ingresos */}
      <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '12px 16px' }}>Fecha</th>
                <th style={{ padding: '12px 16px' }}>Descripción</th>
                <th style={{ padding: '12px 16px' }}>Cliente</th>
                <th style={{ padding: '12px 16px' }}>Proyecto</th>
                <th style={{ padding: '12px 16px' }}>Medio de pago</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Monto</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ing) => (
                <tr key={ing.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {fd(ing.date)}
                  </td>
                  <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                    <div className="stack" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 500 }}>{ing.desc}</span>
                      {ing.channel && ing.channel !== '—' && (
                        <span className="muted" style={{ fontSize: 11.5 }}>Canal: {ing.channel}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ing.cliente || <span className="faint">—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {ing.proj ? (
                      <span className="tag tag-neutral" style={{ fontWeight: 500 }}>
                        {ing.proj}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div className="stack" style={{ gap: 2 }}>
                      <span>{ing.pay || '—'}</span>
                      {ing.op && <span className="mono muted" style={{ fontSize: 11.5 }}>Op: {ing.op}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
                      <span className="num" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                        +{money(ing.amt)}
                      </span>
                      {ing.monedaOriginal && ing.monedaOriginal !== co.currency && ing.montoOriginal != null && (
                        <span className="muted" style={{ fontSize: 11 }}>
                          {currencySymbol(ing.monedaOriginal)} {moneyIn(ing.montoOriginal, ing.monedaOriginal)}
                          {ing.tipoCambio ? ` · TC ${ing.tipoCambio}` : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {deletingId === ing.id ? (
                      <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 12, color: 'var(--color-accent-2)' }}
                          onClick={() => handleDelete(ing.id)}
                        >
                          Sí, borrar
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => setDeletingId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        title="Eliminar ingreso"
                        style={{ padding: '6px 8px' }}
                        onClick={() => setDeletingId(ing.id)}
                      >
                        <Icon n="ph-trash" style={{ color: 'var(--color-neutral-600)' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center' }} className="muted">
                    No se encontraron ingresos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal para registrar ingreso */}
      {creating && (
        <NuevoIngresoDialog
          currency={co.currency}
          personal={personal}
          pedidos={pedidos}
          onClose={() => setCreating(false)}
          onSave={async (body) => {
            await crearIngreso(body);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

interface DialogProps {
  currency: 'PEN' | 'USD';
  personal?: boolean;
  pedidos: { id: number; nombre: string }[];
  onClose: () => void;
  onSave: (body: NuevoIngreso) => Promise<void>;
}

function NuevoIngresoDialog({ currency, personal, pedidos, onClose, onSave }: DialogProps) {
  const [desc, setDesc] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [cliente, setClient] = useState('');
  const [medio, setMedio] = useState('transferencia');
  const [operacion, setOperacion] = useState('');
  const [pedidoId, setPedidoId] = useState<string>('');
  const [moneda, setMoneda] = useState<'PEN' | 'USD'>(currency);
  const [tipoCambio, setTipoCambio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const d = desc.trim();
    if (!d) {
      setError('La descripción es obligatoria.');
      return;
    }
    const m = Number(monto.replace(',', '.'));
    if (!Number.isFinite(m) || m <= 0) {
      setError('Ingresa un monto válido mayor a 0.');
      return;
    }

    let finalMonto = m;
    let monedaOriginal: string | undefined = undefined;
    let montoOriginal: number | undefined = undefined;
    let tcNum: number | undefined = undefined;

    if (moneda !== currency) {
      const tc = Number(tipoCambio.replace(',', '.'));
      if (!Number.isFinite(tc) || tc <= 0) {
        setError('Ingresa una tasa de cambio válida para la conversión.');
        return;
      }
      tcNum = tc;
      monedaOriginal = moneda;
      montoOriginal = m;
      finalMonto = currency === 'PEN' ? m * tc : m / tc;
    }

    setBusy(true);
    setError('');
    try {
      await onSave({
        descripcion: d,
        monto: Math.round(finalMonto * 100) / 100,
        fecha,
        cliente: cliente.trim() || undefined,
        medio_pago: medio || undefined,
        numero_operacion: operacion.trim() || undefined,
        pedido_id: pedidoId ? Number(pedidoId) : undefined,
        moneda_original: monedaOriginal,
        monto_original: montoOriginal,
        tipo_cambio: tcNum,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar el ingreso.');
      setBusy(false);
    }
  };

  return (
    <Dialog onClose={onClose} width={480} gap={16}>
      <div className="dialog-title">Registrar nuevo ingreso</div>

      {error && (
        <div className="banner banner-error" style={{ fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="field">
        <label htmlFor="ing-desc">Descripción *</label>
        <input
          id="ing-desc"
          className="input"
          autoFocus
          placeholder={personal ? "Ej: Sueldo mensual, honorarios, cobro independiente" : "Ej: Pago de factura por servicios"}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="ing-monto">Monto *</label>
          <input
            id="ing-monto"
            className="input"
            inputMode="decimal"
            placeholder="0.00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <div className="field" style={{ width: 110 }}>
          <label htmlFor="ing-moneda">Moneda</label>
          <select
            id="ing-moneda"
            className="input"
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as 'PEN' | 'USD')}
          >
            <option value="PEN">PEN (S/)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      {moneda !== currency && (
        <div className="field">
          <label htmlFor="ing-tc">
            Tipo de cambio ({moneda} a {currency}) *
          </label>
          <input
            id="ing-tc"
            className="input"
            inputMode="decimal"
            placeholder="Ej: 3.75"
            value={tipoCambio}
            onChange={(e) => setTipoCambio(e.target.value)}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            El monto se convertirá a la moneda principal ({currency}).
          </span>
        </div>
      )}

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="ing-fecha">Fecha</label>
          <input
            id="ing-fecha"
            type="date"
            className="input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="ing-cliente">{personal ? "Pagador / Cliente" : "Cliente"}</label>
          <input
            id="ing-cliente"
            className="input"
            placeholder={personal ? "Persona o empresa que te pagó" : "Nombre o razón social"}
            value={cliente}
            onChange={(e) => setClient(e.target.value)}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="ing-medio">Medio de pago</label>
          <select
            id="ing-medio"
            className="input"
            value={medio}
            onChange={(e) => setMedio(e.target.value)}
          >
            {MEDIOS_PAGO.map((m) => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="ing-op">N° de operación</label>
          <input
            id="ing-op"
            className="input"
            placeholder="Opcional"
            value={operacion}
            onChange={(e) => setOperacion(e.target.value)}
          />
        </div>
      </div>

      {pedidos.length > 0 && (
        <div className="field">
          <label htmlFor="ing-proj">Proyecto / Pedido (opcional)</label>
          <select
            id="ing-proj"
            className="input"
            value={pedidoId}
            onChange={(e) => setPedidoId(e.target.value)}
          >
            <option value="">Ninguno</option>
            {pedidos.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <div className="dialog-actions" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar ingreso'}
        </button>
      </div>
    </Dialog>
  );
}
