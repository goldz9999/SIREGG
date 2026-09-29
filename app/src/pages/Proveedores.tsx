import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchInput } from '../components/ui';
import { fd } from '../lib/format';
import { useViewport } from '../hooks/useViewport';
import { useApp } from '../state/AppState';

const parseDay = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function Proveedores() {
  const { proveedores } = useApp();
  const navigate = useNavigate();
  const { isMobile } = useViewport();
  const [q, setQ] = useState('');

  const qq = q.trim().toLowerCase();
  const provs = proveedores.filter((p) => !qq || (p.nombre + ' ' + (p.ruc || '')).toLowerCase().includes(qq));
  const history = (name: string) => navigate('/gastos?q=' + encodeURIComponent(name));
  const last = (iso: string | null) => { const d = parseDay(iso); return d ? fd(d) : '—'; };

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <SearchInput value={q} onChange={setQ} placeholder="Buscar proveedor o RUC…" style={{ maxWidth: 360 }} />
      {!isMobile ? (
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 720 }}>
            <thead>
              <tr><th>Proveedor</th><th>RUC</th><th style={{ textAlign: 'right' }}>Gastos</th><th>Última operación</th><th>Clasificación habitual</th><th /></tr>
            </thead>
            <tbody>
              {provs.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td className="num" style={{ color: 'var(--color-neutral-800)' }}>{p.ruc || 'Sin RUC'}</td>
                  <td style={{ textAlign: 'right' }}>{p.veces_usado}</td>
                  <td>{last(p.ultimo_uso)}</td>
                  <td>{p.categoria_sugerida_nombre ? <span className="tag tag-outline">{p.categoria_sugerida_nombre}</span> : <span className="muted">Aún sin regla</span>}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-ghost" onClick={() => history(p.nombre)}>Historial</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          {provs.map((p) => (
            <button key={p.id} className="m-card" style={{ gap: 4 }} onClick={() => history(p.nombre)}>
              <strong>{p.nombre}</strong>
              <span className="muted" style={{ fontSize: 13 }}>RUC {p.ruc || 'Sin RUC'} · {p.veces_usado} gastos · {p.categoria_sugerida_nombre || 'Sin regla'}</span>
            </button>
          ))}
        </div>
      )}
      {!provs.length && <div className="muted">No hay proveedores registrados todavía.</div>}
    </div>
  );
}
