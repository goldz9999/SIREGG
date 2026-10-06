import { useState } from 'react';
import { Icon, Seg } from '../components/ui';
import type { Expense } from '../data/types';
import { fd, money } from '../lib/format';
import { useApp } from '../state/AppState';

type Range = '7' | '30' | 'all';
type Dim = 'period' | 'cat' | 'prov' | 'user' | 'proj' | 'type' | 'pay';

const DIMS: [Dim, string][] = [['period', 'Período'], ['cat', 'Categoría'], ['prov', 'Proveedor'], ['user', 'Usuario'], ['proj', 'Proyecto'], ['type', 'Personal / empresarial'], ['pay', 'Medio de pago']];

const csvCell = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';

/** Descarga los gastos del período como CSV (se abre directo en Excel). */
function downloadCsv(rows: Expense[], name: string) {
  const head = ['Fecha', 'Descripción', 'Proveedor', 'Categoría', 'Tipo', 'Proyecto', 'Medio de pago', 'Monto', 'Estado', 'Registró'];
  const body = rows.map((e) => [
    e.date.getFullYear() + '-' + String(e.date.getMonth() + 1).padStart(2, '0') + '-' + String(e.date.getDate()).padStart(2, '0'),
    e.desc, e.prov, e.cat, e.type, e.proj, e.pay, e.amt.toFixed(2), e.st, e.user,
  ]);
  const csv = "\uFEFF" + [head, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const { co, expenses, pedidos } = useApp();
  const [range, setRange] = useState<Range>('30');
  const [dimPick, setDim] = useState<Dim>('cat');

  const today = new Date();
  const R = range === 'all'
    ? expenses.filter((e) => e.st !== 'desc')
    : expenses.filter((e) => {
        const days = range === '7' ? 7 : 30;
        const cut = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
        return e.st !== 'desc' && e.date >= cut;
      });
  const tot = R.reduce((a, e) => a + e.amt, 0);
  const dims = DIMS.filter((d) => d[0] !== 'proj' || pedidos.length > 0 || R.some((e) => e.proj));
  const dim = dims.some((d) => d[0] === dimPick) ? dimPick : 'cat';

  let bars: { h: string; lbl: string; tip: string }[] = [];
  let rows: { name: string; amt: string; pct: string; w: string; color: string }[] = [];
  if (dim === 'period') {
    const m: Record<number, number> = {};
    R.forEach((e) => { m[+e.date] = (m[+e.date] || 0) + e.amt; });
    const ks = Object.keys(m).map(Number).sort((a, b) => a - b);
    const mx = Math.max(1, ...Object.values(m));
    bars = ks.map((k, i) => ({ h: (m[k] / mx) * 100 + '%', lbl: ks.length > 16 && i % 3 ? '' : String(new Date(k).getDate()), tip: fd(new Date(k)) + ' · ' + money(m[k]) }));
  } else {
    const m: Record<string, number> = {};
    R.forEach((e) => {
      const k = dim === 'proj' ? e.proj || 'Sin proyecto' : e[dim as keyof Pick<Expense, 'cat' | 'prov' | 'user' | 'type' | 'pay'>];
      m[k] = (m[k] || 0) + e.amt;
    });
    rows = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, a], i) => ({
      name, amt: money(a), pct: ((a / tot) * 100).toFixed(0) + '%', w: (a / tot) * 100 + '%', color: i === 0 ? 'var(--color-accent)' : 'var(--color-neutral-500)',
    }));
  }
  const kpis = [['Total del período', money(tot)], ['Gastos', String(R.length)], ['Promedio por gasto', money(R.length ? tot / R.length : 0)]];

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }}>
      <div className="row wrap" style={{ gap: 'var(--space-3)' }}>
        <Seg name="rrange" value={range} onChange={setRange} options={[{ value: '7', label: 'Últimos 7 días' }, { value: '30', label: 'Últimos 30 días' }, { value: 'all', label: 'Todo el historial' }]} />
        <span className="grow" />
        <button className="btn btn-secondary" disabled={!R.length}
          onClick={() => downloadCsv(R, 'gastos-' + co.short.toLowerCase().replace(/s+/g, '-') + '-' + range + '.csv')}>
          <Icon n="ph-file-csv" /> Exportar CSV
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 20 }}>
        {kpis.map(([l, v]) => (
          <div key={l} data-a="1" className="panel" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>{l}</span>
            <span className="kpi-value" style={{ fontSize: 'clamp(28px,3vw,38px)' }}>{v}</span>
          </div>
        ))}
      </div>
      <div data-a="1" className="panel" style={{ gap: 16 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {dims.map(([v, label]) => (
            <button key={v} className={'chip lg' + (dim === v ? ' on' : '')} aria-pressed={dim === v} onClick={() => setDim(v)}>{label}</button>
          ))}
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Gastos por {dims.find((d) => d[0] === dim)![1].toLowerCase()}</h2>
        {dim === 'period' && R.length > 0 && (
          <>
            <div className="row" style={{ alignItems: 'flex-end', gap: 4, height: 200 }}>
              {bars.map((b, i) => (
                <div key={i} title={b.tip} className="stack" style={{ flex: 1, justifyContent: 'flex-end', height: '100%' }}>
                  <div data-grow="y" style={{ height: b.h, background: 'var(--color-accent)', borderRadius: '2px 2px 0 0', transformOrigin: 'bottom' }} />
                </div>
              ))}
            </div>
            <div className="row muted" style={{ gap: 4, fontSize: 11 }}>
              {bars.map((b, i) => <span key={i} style={{ flex: 1, textAlign: 'center' }}>{b.lbl}</span>)}
            </div>
          </>
        )}
        {dim !== 'period' && R.length > 0 && (
          <div className="stack" style={{ gap: 'var(--space-3)', maxWidth: 760 }}>
            {rows.map((c) => (
              <div key={c.name} className="stack" style={{ gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)', fontSize: 15 }}>
                  <span>{c.name}</span><span className="num" style={{ color: 'var(--color-neutral-800)' }}>{c.amt} · {c.pct}</span>
                </div>
                <div style={{ height: 8, background: 'var(--color-neutral-100)' }}>
                  <div data-grow="x" style={{ height: '100%', width: c.w, background: c.color, transformOrigin: 'left' }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {!R.length && <div className="muted">Sin gastos en este período.</div>}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Calculado sobre los gastos cargados de {co.name}; excluye duplicados confirmados.</p>
    </div>
  );
}
