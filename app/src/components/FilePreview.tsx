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
      ? [['Tipo', f.k], ['Número', f.file], ['Proveedor', e.prov || '—'], ['Fecha', dateL], ['Descripción', e.desc || '—'], ['Monto', amtL]]
      : group === 'Pago'
        ? [['Medio', f.k], ['Operación', e.op || '—'], ['Pagado a', e.prov || '—'], ['Fecha', dateL], ['Monto', amtL]]
        : [];

  return (
    <Dialog onClose={onClose} width={520}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}><span className={GROUP_CLS[group]}>{group}</span><strong>{f.k}</strong></div>
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
      {f.k === 'Foto' && (
        f.url
          ? <img src={f.url} alt="Foto del gasto" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', background: 'var(--color-neutral-200)' }} />
          : <div className="muted" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>La imagen no está disponible.</div>
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
