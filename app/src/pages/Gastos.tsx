import { useEffect, useMemo, useState } from 'react';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import ExpenseDetail from '../components/ExpenseDetail';
import { showRegisterInfo } from '../components/Layout';
import { Icon, SearchInput, Seg, Select } from '../components/ui';
import { ALERT_STATUSES, isPending, PAYS, STAT } from '../data/expenses';
import { compararDuplicado } from '../data/duplicados';
import type { Expense, Status } from '../data/types';
import { fd, money, uniq } from '../lib/format';
import { useViewport } from '../hooks/useViewport';
import { useApp } from '../state/AppState';

type SortKey = 'date' | 'prov' | 'amt';
const EMPTY_FILTERS = { st: '', cat: '', type: '', pay: '' };
const PER_PAGE = 10;

export default function Gastos() {
  const { expenses, duplicados } = useApp();
  const navigate = useNavigate();
  const detailId = useMatch('/gastos/:id')?.params.id;
  const [doneId, setDoneId] = useState<string | null>(null);
  const e = detailId ? expenses.find((x) => x.id === detailId) ?? duplicados.find((x) => x.id === detailId) : undefined;

  // The list stays mounted under the detail so its search, filters and page survive "Volver".
  return (
    <>
      {e && (
        <ExpenseDetail key={e.id} expense={e} done={doneId === e.id} onDone={() => setDoneId(e.id)} onResolved={() => {}}
          onBack={() => { setDoneId(null); navigate('/gastos'); }} />
      )}
      <div hidden={!!e}><GastosList /></div>
    </>
  );
}

function GastosList() {
  const app = useApp();
  const { expenses, duplicados, pendingCount } = app;
  // Duplicados: los posibles (por revisar) y los ya descartados (no suman en totales).
  const dupRows = useMemo(() => [...expenses.filter((e) => e.st === 'dup'), ...duplicados], [expenses, duplicados]);
  // Por qué se detectó cada duplicado y con qué gasto coincide.
  const deteccion = useMemo(() => {
    const todos = [...expenses, ...duplicados];
    const m = new Map<string, { motivo: string; nivel: 'alta' | 'media'; origId: string; origUser: string }>();
    for (const e of dupRows) {
      if (!e.dupOf) continue;
      const o = todos.find((x) => x.id === e.dupOf);
      const c = o ? compararDuplicado(e, o) : null;
      const base = c ? c.motivo.replace(/ que el gasto #.*$/, '') : 'Coincide';
      m.set(e.id, { motivo: base, nivel: c?.nivel ?? 'media', origId: e.dupOf, origUser: o?.user ?? '' });
    }
    return m;
  }, [expenses, duplicados, dupRows]);
  const deteccionDe = (e: Expense) => {
    const d = deteccion.get(e.id);
    if (!d) return <span className="ellipsis" style={{ display: 'block' }}>{e.desc}</span>;
    const confirmado = e.st === 'desc';
    return (
      <span className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
        <span className={confirmado ? 'tag tag-neutral' : 'tag tag-accent-2'} style={{ fontWeight: 600 }}>
          <Icon n="ph-copy" /> {confirmado ? 'Duplicado descartado' : 'Duplicado detectado · confianza ' + d.nivel}
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-800)', whiteSpace: 'normal', textAlign: 'left' }}>
          {d.motivo} que el{' '}
          <span role="link" tabIndex={0} style={{ color: 'var(--color-accent)', fontWeight: 600, cursor: 'pointer' }}
            onClick={(ev) => { ev.stopPropagation(); navigate('/gastos/' + d.origId); }}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); navigate('/gastos/' + d.origId); } }}>
            gasto #{d.origId}{d.origUser ? ' de ' + d.origUser : ''} ↗
          </span>
          {confirmado ? ' · no suma en totales' : ''}
        </span>
      </span>
    );
  };
  const navigate = useNavigate();
  const { isMobile } = useViewport();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [f, setF] = useState(EMPTY_FILTERS);
  const [tab, setTab] = useState<'all' | 'rev' | 'dup'>('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: number }>({ k: 'date', dir: -1 });
  const [page, setPage] = useState(0);

  // A search from the top bar or a provider's "Historial" arrives as ?q=.
  useEffect(() => {
    const incoming = params.get('q');
    if (incoming !== null) {
      setQ(incoming); setF(EMPTY_FILTERS); setTab('all'); setPage(0);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = tab === 'dup' ? dupRows : expenses;
    const r = base.filter((e) =>
      (tab !== 'rev' || isPending(e.st)) &&
      (!qq || (e.desc + ' ' + e.prov + ' ' + e.ruc + ' ' + e.id).toLowerCase().includes(qq)) &&
      (!f.st || e.st === f.st) && (!f.cat || e.cat === f.cat) && (!f.type || e.type === f.type) && (!f.pay || e.pay === f.pay));
    const { k, dir } = sort;
    return r.slice().sort((a, b) => {
      const x = k === 'amt' ? a.amt - b.amt : k === 'prov' ? a.prov.localeCompare(b.prov) : +a.date - +b.date || +b.id - +a.id;
      return x * dir;
    });
  }, [expenses, dupRows, q, f, tab, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const pg = Math.min(page, pages - 1);
  const visible = rows.slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE);
  const hasFilters = !!(q || f.st || f.cat || f.type || f.pay);
  const setFilter = (k: keyof typeof EMPTY_FILTERS) => (v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(0); };
  const sortBy = (k: SortKey) => setSort((s) => ({ k, dir: s.k === k ? -s.dir : k === 'prov' ? 1 : -1 }));
  const open = (id: string) => navigate('/gastos/' + id);

  const filters = [
    { label: 'Estado', value: f.st, set: setFilter('st'), all: 'Todos los estados', opts: (Object.keys(STAT) as Status[]).map((v) => ({ v, l: STAT[v][0] })) },
    { label: 'Categoría', value: f.cat, set: setFilter('cat'), all: 'Todas las categorías', opts: uniq(expenses.map((e) => e.cat)).sort().map((v) => ({ v })) },
    { label: 'Tipo', value: f.type, set: setFilter('type'), all: 'Personal y empresarial', opts: [{ v: 'Empresarial' }, { v: 'Personal' }] },
    { label: 'Medio de pago', value: f.pay, set: setFilter('pay'), all: 'Todos los medios', opts: PAYS.map((v) => ({ v })) },
  ];
  const cols: { label: string; k?: SortKey; align?: 'right' }[] = [
    { label: 'Fecha', k: 'date' }, { label: tab === 'dup' ? 'Detección' : 'Descripción' }, { label: 'Proveedor', k: 'prov' }, { label: 'Categoría' }, { label: 'Tipo' },
    { label: 'Proyecto' }, { label: 'Medio de pago' }, { label: 'Monto', k: 'amt', align: 'right' }, { label: 'Estado' },
  ];
  const rowBg = (e: Expense) => (ALERT_STATUSES.includes(e.st) ? 'var(--color-accent-2-100)' : undefined);
  const rowStyle = (e: Expense) => ({
    background: rowBg(e),
    ...(tab === 'dup' && e.st === 'dup' ? { boxShadow: 'inset 3px 0 0 var(--color-accent-2)' } : {}),
    ...(e.st === 'desc' ? { opacity: 0.75 } : {}),
  });

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <Seg name="gtab" value={tab} onChange={(v) => { setTab(v); setPage(0); }}
          options={[
            { value: 'all', label: 'Todos (' + expenses.length + ')' },
            { value: 'rev', label: 'Por revisar (' + pendingCount + ')' },
            { value: 'dup', label: 'Duplicados (' + dupRows.length + ')' },
          ]} />
        <span className="grow" />
        <button className="btn btn-primary" onClick={() => showRegisterInfo(app.showToast)}><Icon n="ph-plus-circle" /> Registrar gasto</button>
      </div>
      {tab === 'dup' && (
        <span className="muted" style={{ fontSize: 13 }}>
          Posibles duplicados por revisar y los que ya marcaste como duplicado. Los descartados no suman en los totales; ábrelos para comparar las fotos o restaurarlos.
        </span>
      )}
      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Buscar descripción, proveedor, RUC…" style={{ flex: '1 1 240px', maxWidth: 360 }} />
        {filters.map((x) => (
          <Select key={x.label} label={x.label} value={x.value} onChange={x.set} options={[{ v: '', l: x.all }, ...x.opts]}
            style={{ width: 'auto', flex: '0 1 170px', minWidth: 130 }} />
        ))}
        {hasFilters && <button className="btn btn-ghost" onClick={() => { setQ(''); setF(EMPTY_FILTERS); setPage(0); }}><Icon n="ph-x" /> Limpiar</button>}
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{rows.length} gastos</div>

      {!isMobile && rows.length > 0 && (
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.label} style={{ textAlign: c.align || 'left', whiteSpace: 'nowrap' }} aria-sort={c.k && sort.k === c.k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                    {c.k ? (
                      <button className="th-btn" style={{ cursor: 'pointer' }} onClick={() => sortBy(c.k!)}>
                        <span>{c.label}</span><span style={{ color: 'var(--color-accent)' }}>{sort.k === c.k ? (sort.dir > 0 ? '↑' : '↓') : ''}</span>
                      </button>
                    ) : <span className="th-btn">{c.label}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => open(e.id)} style={rowStyle(e)}>
                  <td className="nowrap">{fd(e.date)}</td>
                  <td style={{ maxWidth: tab === 'dup' ? 340 : 240 }}>{tab === 'dup' ? deteccionDe(e) : <span className="ellipsis" style={{ display: 'block' }}>{e.desc}</span>}</td>
                  <td className="nowrap">{e.prov}</td>
                  <td>{e.cat}</td>
                  <td>{e.type}</td>
                  <td style={{ maxWidth: 180 }}><span className="ellipsis" style={{ display: 'block', color: 'var(--color-neutral-800)' }}>{e.proj || '—'}</span></td>
                  <td>{e.pay}</td>
                  <td className="num nowrap" style={{ textAlign: 'right', fontWeight: 600, textDecoration: e.st === 'desc' ? 'line-through' : undefined }}>{money(e.amt)}</td>
                  <td><span className={STAT[e.st][1]}>{STAT[e.st][0]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isMobile && (
        <div className="stack" style={{ gap: 'var(--space-1)' }}>
          {visible.map((e) => (
            <button key={e.id} className="m-card" onClick={() => open(e.id)} style={rowStyle(e)}>
              <span className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-2)', width: '100%', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{e.desc}</span>
                <span className="num nowrap" style={{ fontWeight: 600 }}>{money(e.amt)}</span>
              </span>
              <span className="muted" style={{ fontSize: 13 }}>{e.prov} · {fd(e.date)} · {e.pay}</span>
              {tab === 'dup' ? deteccionDe(e) : <span className={STAT[e.st][1]}>{STAT[e.st][0]}</span>}
            </button>
          ))}
        </div>
      )}
      {!rows.length && (
        <div className="stack" style={{ padding: 'var(--space-6) 0', gap: 'var(--space-2)' }}>
          <strong style={{ fontSize: 18 }}>No hay gastos que coincidan.</strong>
          <span className="muted">Prueba con otra búsqueda o limpia los filtros.</span>
        </div>
      )}
      <div className="row" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <span className="muted" style={{ fontSize: 13 }}>{rows.length ? `${pg * PER_PAGE + 1}–${Math.min(rows.length, pg * PER_PAGE + PER_PAGE)} de ${rows.length}` : ''}</span>
        <button className="btn btn-secondary btn-icon" aria-label="Página anterior" disabled={pg === 0} onClick={() => setPage(pg - 1)}><Icon n="ph-caret-left" /></button>
        <button className="btn btn-secondary btn-icon" aria-label="Página siguiente" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}><Icon n="ph-caret-right" /></button>
      </div>
    </div>
  );
}
