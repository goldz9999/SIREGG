import { KIND, GROUP_CLS } from '../data/expenses';
import type { Expense } from '../data/types';
import { fd, money } from '../lib/format';
import { Dialog, Icon } from './ui';

/** Vista previa de un comprobante, constancia de pago o evidencia, con los datos y archivos reales del gasto. */
export default function FilePreview({ expense: e, index, onClose, onGoToExpense }: {
  expense: Expense; index: number; onClose: () => void; onGoToExpense?: () => void;
}) {
  const f = e.ev[index];
  if (!f) return null;
  const [group] = KIND[f.k];
  const dateL = fd(e.date) + ' ' + e.date.getFullYear();
  const amtL = money(e.amt);
  const rows: [string, string][] =
    group === 'Comprobante'
      ? [['Tipo', f.k + ' (comprobante de compra)'], ['Número', f.file], ['Proveedor', e.prov || '—'], ['Fecha', dateL], ['Descripción', e.desc || '—'], ['Monto', amtL]]
      : group === 'Pago'
        ? [['Medio de pago', f.k], ['Operación', f.file], ['Pagado a', e.prov || '—'], ['Fecha', dateL], ['Monto', amtL]]
        : [];

  return (
    <Dialog onClose={onClose} width={f.url && f.k !== 'Audio' ? 760 : 520}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}><span className={GROUP_CLS[group]}>{group}</span><strong>{group === 'Pago' ? 'Pago con ' + f.k : group === 'Comprobante' ? f.k + ' N.º ' + f.file : f.k}</strong></div>
        <button className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={onClose}><Icon n="ph-x" /></button>
      </div>

      {rows.length > 0 && (
        <div className="stack" style={{ gap: 6, padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
          {rows.map(([l, v]) => (
            <div key={l} className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)', fontSize: 14 }}>
              <span className="muted">{l}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {f.k !== 'Audio' && (
        f.url
          ? (/\.pdf(\?|$)/i.test(f.url)
            ? (
              <div className="stack" style={{ gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-4)', background: 'var(--color-neutral-200)', borderRadius: 'var(--radius-md)' }}>
                <Icon n="ph-file-pdf" style={{ fontSize: 48, color: 'var(--color-accent-2)' }} />
                <a href={f.url} target="_blank" rel="noreferrer" className="btn btn-secondary">Abrir PDF</a>
              </div>
            )
            : (
              <a href={f.url} target="_blank" rel="noreferrer" title="Abrir la imagen en tamaño completo">
                <img src={f.url} alt={f.k + ' de ' + (e.prov || 'el gasto')} style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', background: 'var(--color-neutral-200)', borderRadius: 'var(--radius-md)', display: 'block' }} />
              </a>
            )
          )
          : f.k === 'Foto' && <div className="muted" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>La imagen no está disponible.</div>
      )}
      {f.k === 'Audio' && (
        f.url
          ? <audio controls src={f.url} style={{ width: '100%' }} />
          : <div className="muted" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>El audio no está disponible.</div>
      )}

      <div className="muted" style={{ fontSize: 13 }}>{f.file} · {e.channel}</div>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        {onGoToExpense && <button className="btn btn-primary" onClick={onGoToExpense}>Ver gasto relacionado</button>}
      </div>
    </Dialog>
  );
}
