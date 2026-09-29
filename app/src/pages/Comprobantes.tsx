import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FilePreview from '../components/FilePreview';
import { Icon, SearchInput, Seg } from '../components/ui';
import { GROUP_CLS, KIND } from '../data/expenses';
import type { EvidenceGroup } from '../data/types';
import { fd, money } from '../lib/format';
import { useApp } from '../state/AppState';

export default function Comprobantes() {
  const { expenses } = useApp();
  const navigate = useNavigate();
  const [group, setGroup] = useState<EvidenceGroup | ''>('');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<{ id: string; j: number } | null>(null);

  const qq = q.trim().toLowerCase();
  const files = expenses.flatMap((e) => e.ev.map((f, j) => ({ e, f, j })))
    .filter(({ e, f }) => (!group || KIND[f.k][0] === group) && (!qq || (e.prov + ' ' + f.file).toLowerCase().includes(qq)));
  const pv = preview && expenses.find((x) => x.id === preview.id);

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <Seg name="fgroup" value={group} onChange={setGroup} options={[
          { value: '', label: 'Todos', icon: 'ph-files' },
          { value: 'Comprobante', label: 'Comprobantes', icon: 'ph-receipt' },
          { value: 'Pago', label: 'Pagos', icon: 'ph-device-mobile' },
          { value: 'Evidencia', label: 'Evidencias', icon: 'ph-camera' },
        ]} />
        <SearchInput value={q} onChange={setQ} placeholder="Buscar proveedor o archivo…" style={{ flex: '1 1 220px', maxWidth: 320 }} />
      </div>
      <div className="row wrap muted" style={{ gap: 'var(--space-4)', fontSize: 13 }}>
        <span><span className="tag tag-accent">Comprobante</span> factura o boleta con valor tributario</span>
        <span><span className="tag tag-neutral">Pago</span> constancia de Yape, Plin o transferencia</span>
        <span><span className="tag tag-outline">Evidencia</span> foto o audio de respaldo</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
        {files.map(({ e, f, j }) => {
          const [g, icon] = KIND[f.k];
          return (
            <button key={f.file} onClick={() => setPreview({ id: e.id, j })} className="card lift"
              style={{ border: 0, gap: 'var(--space-2)', textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: 'var(--space-3)' }}>
              <span style={{ height: 96, display: 'grid', placeItems: 'center', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                <Icon n={icon} style={{ fontSize: 40, color: g === 'Comprobante' ? 'var(--color-accent)' : 'var(--color-neutral-700)' }} />
              </span>
              <span className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                <span className={GROUP_CLS[g]}>{g}</span><span className="muted" style={{ fontSize: 13 }}>{f.k}</span>
              </span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{e.prov}</span>
              <span className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--color-neutral-800)' }}>
                <span>{fd(e.date)}</span><span className="num">{money(e.amt)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {!files.length && <div className="muted">No hay archivos con estos filtros.</div>}
      {pv && preview && (
        <FilePreview expense={pv} index={preview.j} onClose={() => setPreview(null)} onGoToExpense={() => navigate('/gastos/' + pv.id)} />
      )}
    </div>
  );
}
