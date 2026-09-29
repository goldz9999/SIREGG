import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import type { ApiPedido, EstadoPedido } from '../api/types';
import NewProjectDialog from '../components/NewProjectDialog';
import { Icon, Select } from '../components/ui';
import { catBreak } from '../data/expenses';
import type { Expense } from '../data/types';
import { fd, money } from '../lib/format';
import { useApp } from '../state/AppState';

const ESTADO: Record<EstadoPedido, string> = { activo: 'Activo', finalizado: 'Finalizado', cancelado: 'Cancelado' };
const CAN_MANAGE = ['Propietario', 'Administrador', 'Supervisor'];

const budgetOf = (p: ApiPedido) => (p.presupuesto == null ? null : Number(p.presupuesto));

export default function Proyectos() {
  const { co, expenses, pedidos, reload, showToast } = useApp();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage = CAN_MANAGE.includes(co.role);

  const byProject = useMemo(() => {
    const m: Record<string, Expense[]> = {};
    expenses.filter((e) => e.proj && e.st !== 'desc').forEach((e) => (m[e.proj] = m[e.proj] || []).push(e));
    return m;
  }, [expenses]);

  const open = openId != null ? pedidos.find((p) => p.id === openId) : undefined;

  const setEstado = async (p: ApiPedido, estado: EstadoPedido) => {
    try {
      await endpoints.actualizarPedido(p.id, Number(co.id), { estado });
      reload();
      showToast(p.nombre + ': ' + ESTADO[estado].toLowerCase() + '.', 'ph-folders');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo cambiar el estado.', 'ph-warning-circle');
    }
  };

  if (open) {
    const rs = (byProject[open.nombre] || []).slice().sort((a, b) => +b.date - +a.date);
    const budget = budgetOf(open);
    const kpis = [
      ['Costo acumulado', money(open.total_gastado)],
      ['Gastos asociados', String(open.cantidad_gastos)],
      ['Presupuesto', budget != null ? money(budget) : '—'],
      ['Última operación', rs.length ? fd(rs[0].date) : '—'],
    ];
    return (
      <div className="stack" style={{ gap: 'var(--space-6)' }}>
        <div><button className="btn btn-ghost" onClick={() => setOpenId(null)}><Icon n="ph-arrow-left" /> Volver a proyectos</button></div>
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <span className="muted" style={{ fontSize: 13 }}>{ESTADO[open.estado]}{open.cliente ? ' · ' + open.cliente : ''}</span>
          <h2 style={{ fontSize: 'clamp(24px,2.6vw,30px)', margin: 0, fontWeight: 600, letterSpacing: '-.025em' }}>{open.nombre}</h2>
        </div>
        {canManage && (
          <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Estado</span>
            <Select label="Estado" value={open.estado} options={(Object.keys(ESTADO) as EstadoPedido[]).map((v) => ({ v, l: ESTADO[v] }))}
              onChange={(v) => setEstado(open, v as EstadoPedido)} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20 }}>
          {kpis.map(([l, v]) => (
            <div key={l} data-a="1" className="panel" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 13 }}>{l}</span><span className="kpi-value" style={{ fontSize: 32 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 20, alignItems: 'start' }}>
          <div data-a="1" className="panel">
            <h3 className="panel-title">Categorías de gasto</h3>
            {catBreak(rs).map((c) => (
              <div key={c.name} className="stack" style={{ gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}><span>{c.name}</span><span className="num">{c.amt} · {c.pct}</span></div>
                <div style={{ height: 6, background: 'var(--color-neutral-100)' }}><div data-grow="x" style={{ height: '100%', width: c.pct, background: c.color, transformOrigin: 'left' }} /></div>
              </div>
            ))}
            {!rs.length && <span className="muted" style={{ fontSize: 14 }}>Aún no hay gastos asignados.</span>}
          </div>
          <div data-a="1" className="panel">
            <h3 className="panel-title">Historial de operaciones</h3>
            {rs.map((e) => (
              <button key={e.id} data-a="1" onClick={() => navigate('/gastos/' + e.id)} className="list-btn hover-n100"
                style={{ gap: 'var(--space-3)', padding: 'var(--space-2)', margin: '0 calc(var(--space-2) * -1)', borderRadius: 'var(--radius-md)', minHeight: 48 }}>
                <span className="muted" style={{ width: 48, flex: 'none', fontSize: 13 }}>{fd(e.date)}</span>
                <span className="stack grow minw0" style={{ lineHeight: 1.3 }}><span style={{ fontSize: 15 }}>{e.desc}</span><span className="muted" style={{ fontSize: 13 }}>{e.prov} · {e.user}</span></span>
                <span className="num" style={{ fontWeight: 600 }}>{money(e.amt)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="row wrap" style={{ gap: 12 }}>
        <span className="muted" style={{ fontSize: 14 }}>{pedidos.length} proyectos y pedidos en {co.name}</span>
        <span className="grow" />
        {canManage && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon n="ph-plus" /> Nuevo proyecto o pedido</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: 20 }}>
        {pedidos.map((p) => {
          const rs = byProject[p.nombre] || [];
          const last = rs.length ? rs.reduce((a, e) => (e.date > a ? e.date : a), rs[0].date) : null;
          const budget = budgetOf(p);
          const used = budget ? Math.min(100, (p.total_gastado / budget) * 100) : 0;
          return (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="card lift" style={{ border: 0, gap: 'var(--space-3)', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
              <span className="card-kicker">{ESTADO[p.estado]}</span>
              <span className="card-title" style={{ fontSize: 20 }}>{p.nombre}</span>
              {p.cliente && <span className="muted" style={{ fontSize: 13 }}>{p.cliente}</span>}
              <span className="kpi-value" style={{ fontSize: 30 }}>{money(p.total_gastado)}</span>
              {budget ? (
                <span className="row" style={{ height: 8, width: '100%', background: 'var(--color-neutral-100)' }} title={'Presupuesto ' + money(budget)}>
                  <span style={{ width: used + '%', height: '100%', background: used >= 100 ? 'var(--color-accent-2)' : 'var(--color-accent)' }} />
                </span>
              ) : null}
              <span className="card-meta">{p.cantidad_gastos} gastos · última operación {last ? fd(last) : '—'}</span>
            </button>
          );
        })}
      </div>
      {!pedidos.length && <div className="muted">Esta organización aún no tiene proyectos o pedidos.</div>}
      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </>
  );
}
