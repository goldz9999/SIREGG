import { KIND, GROUP_CLS } from '../data/expenses';
import type { Expense } from '../data/types';
import { fd, money } from '../lib/format';
import { Dialog, Icon } from './ui';

const WAVE = Array.from({ length: 40 }, (_, i) => (20 + Math.abs(Math.sin(i * 1.7) * 70 + Math.cos(i * 0.6) * 10)).toFixed(0) + '%');

/**
 * Preview of one receipt, payment proof or evidence file. The demo has no
 * real files, so documents are drawn from the expense data.
 */
export default function FilePreview({ expense: e, index, onClose, onGoToExpense }: {
  expense: Expense; index: number; onClose: () => void; onGoToExpense?: () => void;
}) {
  const f = e.ev[index];
  if (!f) return null;
  const [group] = KIND[f.k];
  const dateL = fd(e.date) + ' 2026';
  const amtL = money(e.amt);
  const paper = { background: 'var(--color-bg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column' as const, gap: 6, textAlign: 'center' as const };

  return (
    <Dialog onClose={onClose} width={520}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div className="row" style={{ gap: 'var(--space-2)' }}><span className={GROUP_CLS[group]}>{group}</span><strong>{f.k}</strong></div>
        <button className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={onClose}><Icon n="ph-x" /></button>
      </div>

      {group === 'Comprobante' && (
        <div style={{ ...paper, fontSize: 14 }}>
          <strong style={{ fontSize: 17 }}>{e.prov}</strong>
          <span>RUC {e.ruc || '—'}</span>
          <span style={{ letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 12, marginTop: 'var(--space-2)' }}>{f.k === 'Factura' ? 'Factura electrónica' : 'Boleta de venta electrónica'}</span>
          <span>{(f.k === 'Factura' ? 'F001-' : 'B001-') + e.op.slice(0, 6)} · {dateL}</span>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 'var(--space-3)', textAlign: 'left' }}><span>{e.desc}</span><span className="num">{amtL}</span></div>
          <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, borderTop: '1px dashed var(--color-neutral-500)', paddingTop: 6 }}><span>TOTAL</span><span className="num">{amtL}</span></div>
        </div>
      )}
      {group === 'Pago' && (
        <div style={{ ...paper, alignItems: 'center' }}>
          <Icon n="ph-check-circle" style={{ fontSize: 36, color: 'var(--color-accent)' }} />
          <span>Pago enviado por {f.k}</span>
          <span className="kpi-value" style={{ fontSize: 40 }}>{amtL}</span>
          <span>a {e.prov}</span>
          <span className="muted" style={{ fontSize: 13 }}>{dateL} · Operación {e.op}</span>
        </div>
      )}
      {f.k === 'Foto' && (
        <div style={{ height: 220, display: 'grid', placeItems: 'center', background: 'var(--color-neutral-200)', textAlign: 'center', padding: 'var(--space-4)' }}>
          <span className="stack" style={{ alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-neutral-800)' }}>
            <Icon n="ph-camera" style={{ fontSize: 40 }} />Fotografía enviada por Telegram. La imagen real no está disponible en esta demostración.
          </span>
        </div>
      )}
      {f.k === 'Audio' && (
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <div className="row" style={{ gap: 3, height: 48 }}>
            <Icon n="ph-play-circle" style={{ fontSize: 32, color: 'var(--color-accent)', marginRight: 'var(--space-2)' }} />
            {WAVE.map((h, i) => <span key={i} style={{ flex: 1, height: h, background: 'var(--color-neutral-500)' }} />)}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>Transcripción IA</div>
          <p style={{ margin: 0, fontStyle: 'italic' }}>
            “Gasté {e.amt.toFixed(2).replace('.', ' con ')} soles en {e.prov}, {e.desc.toLowerCase()}, pagué con {e.pay.toLowerCase()}.”
          </p>
        </div>
      )}

      <div className="muted" style={{ fontSize: 13 }}>{f.file} · recibido por {e.channel}</div>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
        {onGoToExpense && <button className="btn btn-primary" onClick={onGoToExpense}>Ver gasto relacionado</button>}
      </div>
    </Dialog>
  );
}
