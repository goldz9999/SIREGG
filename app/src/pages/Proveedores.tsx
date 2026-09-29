import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '../components/ui';
import { fd, money } from '../lib/format';
import { useViewport } from '../hooks/useViewport';
import { useApp } from '../state/AppState';

interface Provider { name: string; ruc: string; n: number; total: number; last: Date; cats: Record<string, number> }

export default function Proveedores() {
  const { expenses } = useApp();
  const navigate = useNavigate();
  const { isMobile } = useViewport();
  const [q, setQ] = useState('');

  const all = useMemo(() => {
    const pm: Record<string, Provider> = {};
    expenses.filter((e) => e.st !== 'desc').forEach((e) => {
      const p = pm[e.prov] || (pm[e.prov] = { name: e.prov, ruc: e.ruc, n: 0, total: 0, last: e.date, cats: {} });
      p.n++; p.total += e.amt;
      if (e.date > p.last) p.last = e.date;
      if (e.ruc) p.ruc = e.ruc;
      p.cats[e.cat] = (p.cats[e.cat] || 0) + 1;
    });
    return Object.values(pm).sort((a, b) => b.total - a.total).map((p) => ({
      ...p, cat: Object.entries(p.cats).sort((a, b) => b[1] - a[1])[0][0],
    }));
  }, [expenses]);

  const qq = q.trim().toLowerCase();
  const provs = all.filter((p) => !qq || (p.name + ' ' + p.ruc).toLowerCase().includes(qq));
  const history = (name: string) => navigate('/gastos?q=' + encodeURIComponent(name));

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <SearchInput value={q} onChange={setQ} placeholder="Buscar proveedor o RUC…" style={{ maxWidth: 360 }} />
      {!isMobile ? (
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr><th>Proveedor</th><th>RUC</th><th style={{ textAlign: 'right' }}>Gastos</th><th style={{ textAlign: 'right' }}>Total de compras</th><th>Última operación</th><th>Clasificación habitual</th><th /></tr>
            </thead>
            <tbody>
              {provs.map((p) => (
                <tr key={p.name}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="num" style={{ color: 'var(--color-neutral-800)' }}>{p.ruc || 'Sin RUC'}</td>
                  <td style={{ textAlign: 'right' }}>{p.n}</td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>{money(p.total)}</td>
                  <td>{fd(p.last)}</td>
                  <td><span className="tag tag-outline">{p.cat}</span></td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-ghost" onClick={() => history(p.name)}>Historial</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          {provs.map((p) => (
            <button key={p.name} className="m-card" style={{ gap: 4 }} onClick={() => history(p.name)}>
              <span className="row" style={{ justifyContent: 'space-between', width: '100%', gap: 'var(--space-2)' }}>
                <strong>{p.name}</strong><span className="num" style={{ fontWeight: 600 }}>{money(p.total)}</span>
              </span>
              <span className="muted" style={{ fontSize: 13 }}>RUC {p.ruc || 'Sin RUC'} · {p.n} gastos · {p.cat}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
