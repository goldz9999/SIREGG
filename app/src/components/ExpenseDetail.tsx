import { useState, type CSSProperties, type MutableRefObject } from 'react';
import { GROUP_CLS, KIND, STAT } from '../data/expenses';
import type { Expense, ExpenseType, Status } from '../data/types';
import { fd, money, uniq } from '../lib/format';
import { useApp } from '../state/AppState';
import FilePreview from './FilePreview';
import NewProjectDialog from './NewProjectDialog';
import { Icon, Select } from './ui';

const NO_PROJECT = 'Sin proyecto';

interface Draft { desc: string; amt: string; cat: string; type: ExpenseType; proj: string }

const CAN_CREATE_PROJECT = ['Propietario', 'Administrador', 'Supervisor'];

interface Action { label: string; icon: string; cls: string; run: () => void; color?: string }

type Banner = [icon: string, title: string, text: string, bg: string, color: string];

const bannerFor = (e: Expense): Banner | undefined => ({
  proc: ['ph-circle-notch', 'Procesando con IA', 'Extrayendo monto, proveedor y categoría del mensaje recibido.', 'var(--color-neutral-100)', 'var(--color-neutral-700)'],
  pend: ['ph-sparkle', 'Revisa la clasificación sugerida', 'La IA completó los datos. Confirma o corrige solo lo que no coincida.', 'var(--color-accent-100)', 'var(--color-accent)'],
  info: ['ph-warning-circle', 'Requiere información', 'Falta el RUC del proveedor para registrar este gasto empresarial.', 'var(--color-accent-2-100)', 'var(--color-accent-2)'],
  dup: ['ph-copy', 'Posible duplicado', 'Parece repetir el gasto ' + (e.dupOf || 'registrado antes') + '. Decide si conservar ambos.', 'var(--color-accent-2-100)', 'var(--color-accent-2)'],
  err: ['ph-x-circle', 'Error de procesamiento', 'No se pudo leer el comprobante. Reintenta, pide otra foto por Telegram o completa los datos.', 'var(--color-accent-2-100)', 'var(--color-accent-2)'],
  desc: ['ph-trash', 'Duplicado confirmado', 'Marcado como duplicado. No se incluye en totales.', 'var(--color-neutral-100)', 'var(--color-neutral-700)'],
} as Partial<Record<Status, Banner>>)[e.st];

/**
 * Expense detail with the AI review flow: each status offers its own actions
 * (confirm, correct, complete the RUC, resolve a duplicate, retry a failed read).
 * Mount it with `key={expense.id}` so edit state resets between expenses.
 */
export default function ExpenseDetail({ expense: e, done, onDone, onResolved, onBack, primaryRef }: {
  expense: Expense;
  /** True right after this expense was confirmed in the current view. */
  done: boolean;
  onDone: () => void;
  /** Called after the expense leaves the review queue (confirmed or discarded). */
  onResolved: () => void;
  onBack?: () => void;
  primaryRef?: MutableRefObject<(() => void) | null>;
}) {
  const { co, expenses, patchExpense, showToast, categories, pedidos } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [newProj, setNewProj] = useState(false);

  const cats = uniq([...categories.map((c) => c.nombre), e.cat]);
  const projOpts = uniq([NO_PROJECT, ...pedidos.map((p) => p.nombre), ...(e.proj ? [e.proj] : [])]);
  const canCreateProject = CAN_CREATE_PROJECT.includes(co.role);
  const isErr = e.st === 'err';

  const startEdit = () => setDraft({ desc: e.desc, amt: String(e.amt), cat: e.cat, type: e.type, proj: e.proj || NO_PROJECT });
  const confirm = () => {
    const p: Partial<Expense> = { st: 'ok' };
    if (draft) {
      const a = parseFloat(String(draft.amt).replace(/[^0-9.]/g, ''));
      if (!a) { showToast('Ingresa un monto válido.', 'ph-warning-circle'); return; }
      Object.assign(p, { desc: draft.desc, amt: a, cat: draft.cat, type: draft.type, proj: draft.proj === NO_PROJECT ? '' : draft.proj });
    }
    patchExpense(e.id, p);
    setDraft(null);
    onDone();
    onResolved();
    showToast('Gasto ' + e.id + ' registrado.', 'ph-check-circle');
  };

  const act = (label: string, icon: string, cls: string, run: () => void, color?: string): Action => ({ label, icon, cls, run, color });
  let actions: Action[] = [];
  if (draft) actions = [act('Guardar y confirmar', 'ph-check', 'btn btn-primary', confirm), act('Cancelar', 'ph-x', 'btn btn-ghost', () => setDraft(null))];
  else if (e.st === 'pend') actions = [act('Confirmar registro', 'ph-check', 'btn btn-primary', confirm), act('Corregir datos', 'ph-pencil-simple', 'btn btn-secondary', startEdit)];
  else if (e.st === 'info') actions = [act('Completar datos', 'ph-pencil-simple', 'btn btn-primary', startEdit)];
  else if (e.st === 'dup') actions = [
    act('Conservar ambos', 'ph-copy', 'btn btn-primary', () => {
      patchExpense(e.id, { st: 'ok', dupOf: null }); onDone(); onResolved();
      showToast('Se conservaron ambos gastos.', 'ph-check-circle');
    }),
    act('Descartar este gasto', 'ph-trash', 'btn btn-secondary', () => {
      patchExpense(e.id, { st: 'desc' }); onResolved();
      showToast('Gasto ' + e.id + ' marcado como duplicado.', 'ph-trash');
    }, 'var(--color-accent-2-700)'),
  ];
  else if (isErr) actions = [act('Reintentar lectura', 'ph-arrow-clockwise', 'btn btn-primary', () => patchExpense(e.id, { st: 'proc' })), act('Completar manualmente', 'ph-pencil-simple', 'btn btn-secondary', startEdit)];
  else if (e.st === 'ok') actions = [act('Editar', 'ph-pencil-simple', 'btn btn-secondary', startEdit)];
  if (e.ev.length && !draft) actions.push(act('Ver comprobantes', 'ph-files', 'btn btn-ghost', () => setPreview(0)));
  if (primaryRef) primaryRef.current = actions.length ? actions[0].run : null;

  let banner = bannerFor(e);
  if (done && e.st === 'ok') banner = ['ph-check-circle', 'Registrado', 'Cambio guardado.', 'var(--color-accent-100)', 'var(--color-accent)'];

  const orig = e.dupOf ? expenses.find((x) => x.id === e.dupOf) : undefined;
  const dupRows = (x: Expense) => [['ID', x.id], ['Fecha', fd(x.date)], ['Proveedor', x.prov], ['Monto', money(x.amt)], ['Medio', x.pay], ['Registró', x.user]];
  const [stLabel, stCls] = STAT[e.st];

  const fields: [string, string][] = [['Descripción', e.desc || '—'], ['Proveedor', e.prov || '—'], ['Fecha', fd(e.date) + ' ' + e.date.getFullYear()], ['Categoría', e.cat], ['Tipo', e.type], ['Proyecto o pedido', e.proj || '—'], ['Medio de pago', e.pay || '—'], ['Registró', e.user || '—']];
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const textInput = (label: string, k: keyof Draft, span = 1) => (
    <div className="field" key={k} style={{ gridColumn: 'span ' + span }}>
      <label>{label}</label>
      <input className="input" value={draft ? draft[k] : ''} onChange={(ev) => set(k)(ev.target.value)}
        />
    </div>
  );
  const selInput = (label: string, k: keyof Draft, opts: string[], span = 1) => (
    <div className="field" key={k} style={{ gridColumn: 'span ' + span }}>
      <label>{label}</label>
      <Select value={draft ? draft[k] : ''} onChange={set(k)} options={opts.map((v) => ({ v }))} />
    </div>
  );

  const when = e.createdAt ? new Date(e.createdAt).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : fd(e.date);
  const log = [
    { t: when, x: 'Recibido por ' + e.channel + (e.user ? ' de ' + e.user : '') },
    ...(isErr ? [] : [{ t: when, x: 'Datos extraídos y clasificados por IA' }]),
    ...(e.st === 'ok' ? [{ t: '', x: 'Registro confirmado' }] : []),
  ];

  return (
    <div data-detail="1" className="stack minw0" style={{ gap: 20 }}>
      {onBack && <div><button className="btn btn-ghost" onClick={onBack}><Icon n="ph-arrow-left" /> Volver a gastos</button></div>}

      <section data-a="1" className="panel" style={{ gap: 18, padding: 22 }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div className="stack minw0" style={{ gap: 8, flex: '1 1 320px' }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className={stCls}>{stLabel}</span>
              <span className="mono muted" style={{ fontSize: 12 }}>{e.id} · {e.channel}</span>
            </div>
            <h2 style={{ fontSize: 'clamp(22px,2.4vw,28px)', margin: 0, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.15, textWrap: 'pretty' } as CSSProperties}>{e.desc}</h2>
            <div className="muted" style={{ fontSize: 14 }}>{e.prov} · {fd(e.date)} · Registrado por {e.user}</div>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end', gap: 4 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Monto</span>
            <span className="num nowrap" style={{ fontSize: 'clamp(32px,3.6vw,44px)', fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1 }}>{money(e.amt)}</span>
            <span className="muted" style={{ fontSize: 12.5 }}>{e.pay || 'Sin medio de pago'}</span>
          </div>
        </div>
        {banner && (
          <div role="status" className="row" style={{ gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: banner[3], borderRadius: 12 }}>
            <Icon n={banner[0]} style={{ fontSize: 20, color: banner[4] }} />
            <div className="stack" style={{ gap: 2 }}><strong style={{ fontSize: 14 }}>{banner[1]}</strong><span style={{ fontSize: 13.5 }}>{banner[2]}</span></div>
          </div>
        )}
        <div className="row wrap" style={{ gap: 8, paddingTop: 16, boxShadow: '0 -1px 0 var(--line)' }}>
          {actions.map((a) => <button key={a.label} className={a.cls} onClick={a.run} style={{ color: a.color }}><Icon n={a.icon} /> {a.label}</button>)}
        </div>
      </section>

      {e.st === 'dup' && orig && (
        <div data-a="1" className="panel" style={{ gap: 12 }}>
          <h3 className="panel-title">Comparación con el gasto existente</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'var(--space-4)', maxWidth: 760 }}>
            {[{ title: 'Nuevo — ' + e.channel, bg: 'var(--color-accent-2-100)', x: e }, { title: 'Existente — registrado', bg: 'var(--color-surface)', x: orig }].map((c) => (
              <div key={c.title} className="stack" style={{ gap: 6, padding: 'var(--space-3)', background: c.bg, borderRadius: 'var(--radius-md)' }}>
                <div className="muted" style={{ fontSize: 13 }}>{c.title}</div>
                {dupRows(c.x).map(([l, v]) => (
                  <div key={l} className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)', fontSize: 14 }}>
                    <span className="muted">{l}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: 20, alignItems: 'start' }}>
        <div data-a="1" className="panel" style={{ gap: 14 }}>
          <h3 className="panel-title">Datos del gasto</h3>
          {!draft && e.st === 'ok' && (pedidos.length > 0 || canCreateProject) && (
            <div className="stack" style={{ gap: 8, padding: 14, borderRadius: 12, background: 'var(--fill)', border: '1px solid var(--line)' }}>
              <span className="row" style={{ gap: 8, fontSize: 13, fontWeight: 500 }}><Icon n="ph-folders" style={{ fontSize: 16, color: 'var(--color-accent)' }} />Proyecto o pedido</span>
              <div className="row wrap" style={{ gap: 8 }}>
                <Select label="Proyecto o pedido" value={e.proj || NO_PROJECT} options={projOpts.map((v) => ({ v }))} style={{ flex: '1 1 200px', minWidth: 0, width: 'auto' }}
                  onChange={(v) => {
                    patchExpense(e.id, { proj: v === NO_PROJECT ? '' : v });
                    showToast(v === NO_PROJECT ? 'Gasto sin proyecto asignado.' : 'Asignado a ' + v + '.', 'ph-folders');
                  }} />
                {canCreateProject && <button className="btn btn-secondary" onClick={() => setNewProj(true)}><Icon n="ph-plus" /> Nuevo</button>}
              </div>
              <span className="muted" style={{ fontSize: 12.5 }}>Asigna el gasto para sumarlo al costo del proyecto o pedido.</span>
            </div>
          )}
          {!draft ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--space-3) var(--space-4)' }}>
              {fields.map(([l, v]) => (
                <div key={l} className="stack" style={{ gap: 2 }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>{l}</span>
                  <span style={{ fontSize: 15, color: v === 'Falta' ? 'var(--color-accent-2-700)' : undefined }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--space-3)' }}>
              {textInput('Descripción', 'desc', 2)}
              {textInput('Monto (S/)', 'amt')}
              {selInput('Categoría', 'cat', cats)}
              {selInput('Tipo', 'type', ['Empresarial', 'Personal'])}
              {pedidos.length > 0 && selInput('Proyecto o pedido', 'proj', projOpts, 2)}
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div data-a="1" className="panel">
            <h3 className="panel-title">Comprobantes y evidencias</h3>
            {e.ev.map((f, j) => {
              const [group, icon] = KIND[f.k];
              return (
                <button key={f.file} data-a="1" onClick={() => setPreview(j)} className="list-btn hover-n100"
                  style={{ gap: 'var(--space-3)', padding: 'var(--space-2)', margin: '0 calc(var(--space-2) * -1)', borderRadius: 'var(--radius-md)', minHeight: 48 }}>
                  <Icon n={icon} style={{ fontSize: 22, color: 'var(--color-accent)' }} />
                  <span className="stack grow" style={{ lineHeight: 1.3 }}><span style={{ fontSize: 15 }}>{f.k}</span><span className="muted" style={{ fontSize: 12 }}>{f.file}</span></span>
                  <span className={GROUP_CLS[group]}>{group}</span>
                </button>
              );
            })}
            {!e.ev.length && <span className="muted" style={{ fontSize: 14 }}>Registrado por mensaje de texto, sin archivos adjuntos.</span>}
          </div>
          <div data-a="1" className="panel">
            <h3 className="panel-title">Lectura automática</h3>
            <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)', fontSize: 14 }}>
              <span>Confianza de la IA</span>
              <span className={e.conf === 'alta' ? 'tag tag-outline' : e.conf ? 'tag tag-accent-2' : 'tag tag-neutral'}>{e.conf ? e.conf[0].toUpperCase() + e.conf.slice(1) : 'Sin dato'}</span>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>{e.conf === 'alta' ? 'Los datos se registraron sin necesidad de revisión.' : e.conf ? 'Confianza media o baja: conviene revisar los datos.' : 'Este gasto no trae una medida de confianza.'}</span>
          </div>
          <div data-a="1" className="panel">
            <h3 className="panel-title">Historial</h3>
            {log.map((l, i) => (
              <div key={i} className="row" style={{ gap: 'var(--space-3)', fontSize: 14, alignItems: 'flex-start' }}>
                <span className="muted" style={{ width: 110, flex: 'none' }}>{l.t}</span><span>{l.x}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {preview !== null && (
        <FilePreview expense={e} index={preview} onClose={() => setPreview(null)} />
      )}
      {newProj && <NewProjectDialog forId={e.id} onClose={() => setNewProj(false)} />}
    </div>
  );
}
