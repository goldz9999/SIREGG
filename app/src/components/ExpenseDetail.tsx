import { Fragment, useEffect, useState, type CSSProperties, type MutableRefObject } from 'react';
import { getGasto } from '../api/endpoints';
import { mapGasto } from '../api/mappers';
import type { Evidence } from '../data/types';
import { compararDuplicado, esComprobante, esPago } from '../data/duplicados';
import { GROUP_CLS, KIND, PAYS, STAT } from '../data/expenses';
import type { Expense, ExpenseType, Status } from '../data/types';
import { currencySymbol, fd, money, uniq } from '../lib/format';
import { useApp } from '../state/AppState';
import FilePreview from './FilePreview';
import NewProjectDialog from './NewProjectDialog';
import { Icon, Select } from './ui';

const NO_PROJECT = 'Sin proyecto';

interface Draft { desc: string; amt: string; cat: string; type: ExpenseType; proj: string; prov: string; ruc: string; pay: string }

const NO_PAY = 'Sin medio de pago';

const CAN_CREATE_PROJECT = ['Propietario', 'Administrador', 'Supervisor'];

interface Action { label: string; icon: string; cls: string; run: () => void; color?: string }

type Banner = [icon: string, title: string, text: string, bg: string, color: string];

const bannerFor = (e: Expense): Banner | undefined => ({
  proc: ['ph-circle-notch', 'Procesando con IA', 'Extrayendo monto, proveedor y categoría del mensaje recibido.', 'var(--color-neutral-100)', 'var(--color-neutral-700)'],
  pend: ['ph-sparkle', 'Revisa la clasificación sugerida', 'La IA completó los datos. Confirma o corrige solo lo que no coincida.', 'var(--color-accent-100)', 'var(--color-accent)'],
  info: ['ph-warning-circle', 'Requiere información', 'Falta el RUC del proveedor para registrar este gasto empresarial.', 'var(--color-accent-2-100)', 'var(--color-accent-2)'],
  dup: ['ph-copy', 'Posible duplicado', 'Parece repetir el gasto ' + (e.dupOf || 'registrado antes') + '. Decide si conservar ambos.', 'var(--color-accent-2-100)', 'var(--color-accent-2)'],
  err: ['ph-x-circle', 'Error de procesamiento', 'No se pudo leer el comprobante. Reintenta, pide otra foto por Telegram o completa los datos.', 'var(--color-accent-2-100)', 'var(--color-accent-2)'],
  desc: ['ph-trash', 'Duplicado confirmado', 'Marcado como duplicado' + (e.dupOf ? ' del gasto ' + e.dupOf : '') + '. No se incluye en totales. Si no lo era, restáuralo.', 'var(--color-neutral-100)', 'var(--color-neutral-700)'],
} as Partial<Record<Status, Banner>>)[e.st];

/**
 * Expense detail with the AI review flow: each status offers its own actions
 * (confirm, correct, complete the RUC, resolve a duplicate, retry a failed read).
 * Mount it with `key={expense.id}` so edit state resets between expenses.
 */
export default function ExpenseDetail({ expense: base, done, onDone, onResolved, onBack, primaryRef }: {
  expense: Expense;
  /** True right after this expense was confirmed in the current view. */
  done: boolean;
  onDone: () => void;
  /** Called after the expense leaves the review queue (confirmed or discarded). */
  onResolved: () => void;
  onBack?: () => void;
  primaryRef?: MutableRefObject<(() => void) | null>;
}) {
  const { co, companies, personal, user, expenses, duplicados, patchExpense, deleteExpense, showToast, categories, pedidos } = useApp();
  // Los archivos se piden con el gasto completo: trae la hora de cada comprobante y pago,
  // con la que se sabe qué foto es de la factura y cuál del pago.
  const [evFull, setEvFull] = useState<Evidence[] | null>(null);
  useEffect(() => {
    let alive = true;
    const empresaId = base.empresaId ?? Number(co.id);
    if (!Number.isInteger(empresaId)) return;
    getGasto(Number(base.id), empresaId)
      .then((g) => { if (alive) setEvFull(mapGasto(g).ev); })
      .catch(() => { /* se queda con los archivos de la lista */ });
    return () => { alive = false; };
  }, [base.id, base.empresaId, co.id, base.ev.length]);
  const e: Expense = evFull ? { ...base, ev: evFull } : base;
  const [origEv, setOrigEv] = useState<Evidence[] | null>(null);
  useEffect(() => {
    if (!base.dupOf) return;
    let alive = true;
    getGasto(Number(base.dupOf), base.empresaId ?? Number(co.id))
      .then((g) => { if (alive) setOrigEv(mapGasto(g).ev); })
      .catch(() => { /* usa los archivos de la lista */ });
    return () => { alive = false; };
  }, [base.dupOf, base.empresaId, co.id]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  // Vista ampliada de un archivo del gasto original (comparación de duplicados).
  const [origPreview, setOrigPreview] = useState<number | null>(null);
  const [newProj, setNewProj] = useState(false);

  // Categorías de la empresa del gasto (en "Gastos personales" se cargan las de todas).
  const cats = uniq([...categories.filter((c) => e.empresaId == null || c.empresa_id === e.empresaId).map((c) => c.nombre), e.cat]);
  // "Personal" solo si quien registró el gasto puede tener gastos personales (el backend lo valida;
  // aquí solo se sabe del propio usuario).
  const typeOpts: ExpenseType[] = e.type === 'Personal' || e.userId !== user.id || user.canPersonal ? ['Empresarial', 'Personal'] : ['Empresarial'];
  const payOpts = uniq([...(e.pay ? [] : [NO_PAY]), ...PAYS, ...(e.pay ? [e.pay] : [])]);
  const orgName = personal && e.empresaId != null ? companies.find((c) => c.id === String(e.empresaId))?.name : undefined;
  const projOpts = uniq([NO_PROJECT, ...pedidos.map((p) => p.nombre), ...(e.proj ? [e.proj] : [])]);
  const canCreateProject = CAN_CREATE_PROJECT.includes(co.role);
  const isErr = e.st === 'err';

  const startEdit = () => setDraft({ desc: e.desc, amt: String(e.amt), cat: e.cat, type: e.type, proj: e.proj || NO_PROJECT, prov: e.prov, ruc: e.ruc, pay: e.pay || NO_PAY });
  const confirm = () => {
    const p: Partial<Expense> = { st: 'ok' };
    if (draft) {
      const a = parseFloat(String(draft.amt).replace(/[^0-9.]/g, ''));
      if (!a) { showToast('Ingresa un monto válido.', 'ph-warning-circle'); return; }
      const ruc = draft.ruc.trim();
      if (ruc && !/^[0-9]{11}$/.test(ruc)) { showToast('El RUC debe tener 11 dígitos.', 'ph-warning-circle'); return; }
      if (ruc && !draft.prov.trim()) { showToast('Indica el proveedor al que pertenece el RUC.', 'ph-warning-circle'); return; }
      Object.assign(p, {
        desc: draft.desc, amt: a, cat: draft.cat, type: draft.type, proj: draft.proj === NO_PROJECT ? '' : draft.proj,
        prov: draft.prov.trim(), ruc, ...(draft.pay !== NO_PAY ? { pay: draft.pay } : {}),
      });
    }
    patchExpense(e.id, p);
    setDraft(null);
    onDone();
    onResolved();
    showToast('Gasto ' + e.id + ' registrado.', 'ph-check-circle');
  };

  const conservarAmbos = () => {
    patchExpense(e.id, { st: 'ok', dupOf: null }); onDone(); onResolved();
    showToast('Se conservaron ambos gastos.', 'ph-check-circle');
  };
  const descartarEste = () => {
    patchExpense(e.id, { st: 'desc' }); onResolved();
    showToast('Gasto ' + e.id + ' marcado como duplicado.', 'ph-trash');
  };
  const restaurar = () => {
    patchExpense(e.id, { st: 'ok', dupOf: null }); onResolved();
    showToast('Gasto ' + e.id + ' restaurado: vuelve a sumar en los totales.', 'ph-check-circle');
  };

  const act = (label: string, icon: string, cls: string, run: () => void, color?: string): Action => ({ label, icon, cls, run, color });
  let actions: Action[] = [];
  if (draft) actions = [act('Guardar y confirmar', 'ph-check', 'btn btn-primary', confirm), act('Cancelar', 'ph-x', 'btn btn-ghost', () => setDraft(null))];
  else if (e.st === 'pend') actions = [act('Confirmar registro', 'ph-check', 'btn btn-primary', confirm), act('Corregir datos', 'ph-pencil-simple', 'btn btn-secondary', startEdit)];
  else if (e.st === 'info') actions = [act('Completar datos', 'ph-pencil-simple', 'btn btn-primary', startEdit)];
  else if (e.st === 'dup') actions = [
    act('Conservar ambos', 'ph-copy', 'btn btn-primary', conservarAmbos),
    act('Descartar este gasto', 'ph-trash', 'btn btn-secondary', descartarEste, 'var(--color-accent-2-700)'),
  ];
  else if (isErr) actions = [act('Reintentar lectura', 'ph-arrow-clockwise', 'btn btn-primary', () => patchExpense(e.id, { st: 'proc' })), act('Completar manualmente', 'ph-pencil-simple', 'btn btn-secondary', startEdit)];
  else if (e.st === 'ok') actions = [act('Editar', 'ph-pencil-simple', 'btn btn-secondary', startEdit)];
  else if (e.st === 'desc') actions = [act('No era duplicado', 'ph-arrow-counter-clockwise', 'btn btn-secondary', restaurar)];
  if (e.ev.length && !draft) actions.push(act('Ver comprobantes', 'ph-files', 'btn btn-ghost', () => setPreview(0)));
  if (primaryRef) primaryRef.current = actions.length ? actions[0].run : null;

  let banner = bannerFor(e);
  if (done && e.st === 'ok') banner = ['ph-check-circle', 'Registrado', 'Cambio guardado.', 'var(--color-accent-100)', 'var(--color-accent)'];

  const origBase = e.dupOf ? expenses.find((x) => x.id === e.dupOf) ?? duplicados.find((x) => x.id === e.dupOf) : undefined;
  const orig: Expense | undefined = origBase && origEv ? { ...origBase, ev: origEv } : origBase;
  const cmp = (e.st === 'dup' || e.st === 'desc') && orig ? compararDuplicado(e, orig) : null;
  // Fotos por sección (con su índice en ev para abrir la vista previa). Si el gasto no tiene
  // foto de comprobante, sus fotos sueltas se muestran en esa fila.
  const fotos = (x: Expense, pred: (f: Evidence) => boolean) => x.ev.map((f, j) => ({ f, j })).filter(({ f }) => f.url && pred(f));
  const fotosComprobante = (x: Expense) => {
    const c = fotos(x, esComprobante);
    return c.length ? c : fotos(x, (f) => f.k === 'Foto');
  };
  const hayPago = !!orig && (e.ev.some(esPago) || orig.ev.some(esPago));
  const [stLabel, stCls] = STAT[e.st];

  const fields: [string, string][] = [
    ['Descripción', e.desc || '—'], ['Proveedor', e.prov || '—'], ['RUC', e.ruc || '—'], ['Fecha', fd(e.date) + ' ' + e.date.getFullYear()],
    ['Categoría', e.cat], ['Tipo', e.type], ['Proyecto o pedido', e.proj || '—'], ['Medio de pago', e.pay || '—'], ['Registró', e.user || '—'],
    ...(orgName ? [['Organización', orgName] as [string, string]] : []),
  ];
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const textInput = (label: string, k: keyof Draft, span = 1, extra: { inputMode?: 'numeric' | 'decimal'; maxLength?: number; placeholder?: string } = {}) => (
    <div className="field" key={k} style={{ gridColumn: 'span ' + span }}>
      <label>{label}</label>
      <input className="input" value={draft ? draft[k] : ''} onChange={(ev) => set(k)(ev.target.value)} {...extra} />
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
          {!draft && (
            confirmDelete ? (
              <div className="row wrap" style={{ gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: 13, color: 'var(--color-accent-2-700)', alignSelf: 'center' }}>¿Eliminar permanentemente?</span>
                <button className="btn btn-secondary" style={{ color: 'var(--color-accent-2-700)' }}
                  onClick={() => { deleteExpense(e.id); onResolved(); showToast('Gasto eliminado.', 'ph-trash'); }}>
                  <Icon n="ph-trash" /> Sí, eliminar
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              </div>
            ) : (
              <button className="btn btn-ghost" style={{ marginLeft: 'auto', color: 'var(--color-accent-2-700)' }}
                onClick={() => setConfirmDelete(true)}>
                <Icon n="ph-trash" /> Eliminar
              </button>
            )
          )}
        </div>
      </section>

      {cmp && orig && (
        <div data-a="1" className="panel" style={{ gap: 14 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
            <h3 className="panel-title">Comparación con el gasto existente</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>Toca una foto para verla en grande</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <span className="row wrap" style={{ gap: 6, fontSize: 13 }}>
              <span className={cmp.nivel === 'alta' ? 'tag tag-accent-2' : 'tag tag-neutral'}><Icon n="ph-copy" /> Duplicado detectado · confianza {cmp.nivel}</span>
              <span>{cmp.motivo}</span>
            </span>
            {cmp.coinciden.length > 0 && (
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 13, minWidth: 74 }}>Coinciden</span>
                {cmp.coinciden.map((t) => <span key={t} className="tag dup-ok"><Icon n="ph-check" /> {t}</span>)}
              </div>
            )}
            {cmp.difieren.length > 0 && (
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="muted" style={{ fontSize: 13, minWidth: 74 }}>Difieren</span>
                {cmp.difieren.map((t) => <span key={t} className="tag dup-no">≠ {t}</span>)}
              </div>
            )}
          </div>

          <div className="dup-grid">
            <div className="dup-h" />
            <div className="dup-h dup-nuevo">Nuevo — #{e.id}<span className="muted">{e.channel} · {e.user || '—'}</span></div>
            <div className="dup-h dup-exist">Existente — #{orig.id}<span className="muted">{orig.channel} · {orig.user || '—'}</span></div>

            <div className="dup-sec">Comprobante de compra</div>
            <div className="dup-lbl">Foto</div>
            {[{ x: e, open: setPreview, falta: 'Sin foto del comprobante' }, { x: orig, open: setOrigPreview, falta: 'Sin foto del comprobante' }].map((c, i) => (
              <div key={i} className="dup-foto">
                {fotosComprobante(c.x).length ? fotosComprobante(c.x).map(({ f, j }) => (
                  <button key={j} className="dup-img" onClick={() => c.open(j)} title="Ver en grande">
                    <img src={f.url!} alt={f.k + ' del gasto ' + c.x.id} loading="lazy" />
                    <span className="dup-zoom"><Icon n="ph-arrows-out" /> Ampliar</span>
                  </button>
                )) : <div className="dup-vacio">{c.falta}</div>}
              </div>
            ))}

            {hayPago && (
              <>
                <div className="dup-sec">Pago</div>
                <div className="dup-lbl">Constancia</div>
                {[{ x: e, open: setPreview }, { x: orig, open: setOrigPreview }].map((c, i) => (
                  <div key={i} className="dup-foto">
                    {fotos(c.x, esPago).length ? fotos(c.x, esPago).map(({ f, j }) => (
                      <button key={j} className="dup-img dup-img-pago" onClick={() => c.open(j)} title="Ver en grande">
                        <img src={f.url!} alt={'Pago con ' + f.k + ' del gasto ' + c.x.id} loading="lazy" />
                        <span className="dup-zoom"><Icon n="ph-arrows-out" /> Ampliar</span>
                      </button>
                    )) : <div className="dup-vacio dup-vacio-pago">{c.x.ev.some(esPago) ? 'Sin foto del pago' : 'Sin pago registrado'}</div>}
                  </div>
                ))}
              </>
            )}

            <div className="dup-sec">Datos</div>
            {cmp.filas.map((f) => (
              <Fragment key={f.campo}>
                <div className="dup-lbl">{f.campo}</div>
                {[f.nuevo, f.existente].map((v, i) => (
                  <div key={i} className={'dup-val' + (f.igual === false ? ' diff' : '') + (f.igual === null ? ' neutral' : '')}>
                    <span>{v || '—'}</span>
                    {f.igual !== null && <span className={'dup-ico ' + (f.igual ? 'ok' : 'no')} aria-label={f.igual ? 'Coincide' : 'Difiere'}>{f.igual ? '✓' : '≠'}</span>}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>

          <div className="dup-decide">
            {e.st === 'dup' ? (
              <>
                <div className="stack" style={{ gap: 2 }}>
                  <strong>¿Es el mismo gasto?</strong>
                  <span className="muted" style={{ fontSize: 13 }}>Si lo descartas, el #{e.id} no suma en los totales y queda en Gastos → Duplicados.</span>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn btn-secondary" onClick={conservarAmbos}>No, son distintos — conservar ambos</button>
                  <button className="btn btn-primary" onClick={descartarEste}>Sí, es el mismo — descartar #{e.id}</button>
                </div>
              </>
            ) : (
              <>
                <div className="stack" style={{ gap: 2 }}>
                  <strong>Descartado como duplicado del #{orig.id}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>No suma en los totales. Si no era el mismo gasto, restáuralo.</span>
                </div>
                <button className="btn btn-secondary" onClick={restaurar}><Icon n="ph-arrow-counter-clockwise" /> No era duplicado</button>
              </>
            )}
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
              {textInput('Monto (' + currencySymbol() + ')', 'amt', 1, { inputMode: 'decimal' })}
              {selInput('Medio de pago', 'pay', payOpts)}
              {textInput('Proveedor', 'prov')}
              {textInput('RUC del proveedor', 'ruc', 1, { inputMode: 'numeric', maxLength: 11, placeholder: '11 dígitos' })}
              {selInput('Categoría', 'cat', cats)}
              {selInput('Tipo', 'type', typeOpts)}
              {pedidos.length > 0 && selInput('Proyecto o pedido', 'proj', projOpts, 2)}
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div data-a="1" className="panel">
            <h3 className="panel-title">Comprobantes y evidencias</h3>
            {(['Comprobante', 'Pago', 'Evidencia'] as const).map((grupo) => {
              const items = e.ev.map((f, j) => ({ f, j })).filter(({ f }) => KIND[f.k][0] === grupo);
              if (!items.length) return null;
              return (
                <div key={grupo} className="stack" style={{ gap: 2 }}>
                  <div className="nav-label" style={{ padding: 'var(--space-2) 0 var(--space-1)' }}>
                    {grupo === 'Comprobante' ? 'Comprobante de compra' : grupo === 'Pago' ? 'Pago' : 'Otros archivos'}
                  </div>
                  {items.map(({ f, j }) => {
                    const icon = KIND[f.k][1];
                    const titulo = grupo === 'Comprobante' ? f.k + ' N.º ' + f.file : grupo === 'Pago' ? 'Pago con ' + f.k : f.k;
                    const detalle = grupo === 'Pago' ? 'Operación N.º ' + f.file : grupo === 'Comprobante' ? (f.url ? 'Foto de la ' + f.k.toLowerCase() : 'Sin foto') : f.file;
                    return (
                      <button key={j} data-a="1" onClick={() => setPreview(j)} className="list-btn hover-n100"
                        style={{ gap: 'var(--space-3)', padding: 'var(--space-2)', margin: '0 calc(var(--space-2) * -1)', borderRadius: 'var(--radius-md)', minHeight: 48 }}>
                        {f.url && f.k !== 'Audio'
                          ? <img src={f.url} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flex: 'none', background: 'var(--color-neutral-200)' }} />
                          : <Icon n={icon} style={{ fontSize: 22, color: 'var(--color-accent)' }} />}
                        <span className="stack grow" style={{ lineHeight: 1.3 }}><span style={{ fontSize: 15 }}>{titulo}</span><span className="muted" style={{ fontSize: 12 }}>{detalle}</span></span>
                        <span className={GROUP_CLS[grupo]}>{grupo}</span>
                      </button>
                    );
                  })}
                </div>
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
      {origPreview !== null && orig && (
        <FilePreview expense={orig} index={origPreview} onClose={() => setOrigPreview(null)} />
      )}
      {newProj && <NewProjectDialog forId={e.id} onClose={() => setNewProj(false)} />}
    </div>
  );
}
