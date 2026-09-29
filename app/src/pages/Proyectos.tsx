import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NewProjectDialog from '../components/NewProjectDialog';
import { Icon } from '../components/ui';
import { catBreak, projectKind } from '../data/expenses';
import type { Expense } from '../data/types';
import { fd, money } from '../lib/format';
import { useApp } from '../state/AppState';
import { useProjects } from '../state/projects';

export default function Proyectos() {
  const { co, expenses } = useApp();
  const projects = useProjects();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const byProject = useMemo(() => {
    const m: Record<string, Expense[]> = {};
    expenses.filter((e) => e.proj && e.st !== 'desc').forEach((e) => (m[e.proj] = m[e.proj] || []).push(e));
    return m;
  }, [expenses]);

  if (openId && projects.list.includes(openId)) {
    const rs = (byProject[openId] || []).slice().sort((a, b) => +b.date - +a.date);
    const cost = rs.reduce((a, e) => a + e.amt, 0);
    const kpis = [['Costo acumulado', money(cost)], ['Gastos asociados', String(rs.length)], ['Última operación', rs.length ? fd(rs[0].date) : '—']];
    return (
      <div className="stack" style={{ gap: 'var(--space-6)' }}>
        <div><button className="btn btn-ghost" onClick={() => setOpenId(null)}><Icon n="ph-arrow-left" /> Volver a proyectos</button></div>
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          <span className="muted" style={{ fontSize: 13 }}>{projectKind(openId)}</span>
          <h2 style={{ fontSize: 'clamp(24px,2.6vw,30px)', margin: 0, fontWeight: 600, letterSpacing: '-.025em' }}>{openId}</h2>
        </div>
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
        <span className="muted" style={{ fontSize: 14 }}>{projects.list.length} proyectos y pedidos en {co.name}</span>
        <span className="grow" />
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon n="ph-plus" /> Nuevo proyecto o pedido</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: 20 }}>
        {projects.list.map((name) => {
          const rs = byProject[name] || [];
          const cost = rs.reduce((a, e) => a + e.amt, 0);
          const last = rs.length ? rs.reduce((a, e) => (e.date > a ? e.date : a), rs[0].date) : null;
          return (
            <button key={name} onClick={() => setOpenId(name)} className="card lift" style={{ border: 0, gap: 'var(--space-3)', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
              <span className="card-kicker">{projectKind(name)}</span>
              <span className="card-title" style={{ fontSize: 20 }}>{name}</span>
              <span className="kpi-value" style={{ fontSize: 30 }}>{money(cost)}</span>
              <span className="row" style={{ height: 8, width: '100%' }}>
                {catBreak(rs).map((s) => <span key={s.name} title={s.tip} style={{ width: s.w, height: '100%', background: s.color }} />)}
              </span>
              <span className="card-meta">{rs.length} gastos · última operación {last ? fd(last) : '—'}</span>
            </button>
          );
        })}
      </div>
      {!projects.list.length && <div className="muted">Esta organización aún no tiene proyectos con gastos.</div>}
      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
    </>
  );
}
