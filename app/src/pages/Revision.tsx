import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ExpenseDetail from '../components/ExpenseDetail';
import { Icon, TitleIcon } from '../components/ui';
import { ALERT_STATUSES, isPending, STAT } from '../data/expenses';
import type { Status } from '../data/types';
import { fd, money } from '../lib/format';
import { useViewport } from '../hooks/useViewport';
import { useApp } from '../state/AppState';

type Filter = 'all' | 'dup' | 'info' | 'pend' | 'err';
const FILTERS: Record<Filter, Status[] | null> = { all: null, dup: ['dup'], info: ['info'], pend: ['pend', 'proc'], err: ['err'] };
const CHIPS: [Filter, string][] = [['all', 'Todos'], ['dup', 'Duplicados'], ['info', 'Requieren info'], ['pend', 'Pendientes'], ['err', 'Errores']];
const inFilter = (f: Filter, st: Status) => !FILTERS[f] || FILTERS[f]!.includes(st);

export default function Revision() {
  const { co, expenses } = useApp();
  const navigate = useNavigate();
  const { w, isMobile } = useViewport();
  const [params] = useSearchParams();
  const initial = params.get('f') as Filter | null;
  const [filter, setFilter] = useState<Filter>(initial && initial in FILTERS ? initial : 'all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const primary = useRef<(() => void) | null>(null);
  const advanceTimer = useRef<number>();

  const pendAll = expenses.filter((e) => isPending(e.st));
  const queue = pendAll.filter((e) => inFilter(filter, e.st));
  // Keep showing an expense that was just resolved until the tray moves on.
  const keep = detailId && (queue.some((q) => q.id === detailId) || doneId === detailId);
  const curId = keep ? detailId : queue[0]?.id;
  const current = curId ? expenses.find((e) => e.id === curId) : undefined;
  const total = co.review || 0;
  const resolved = Math.max(0, total - pendAll.length);
  const empty = !queue.length && !keep;
  const wide = w >= 1100;

  const open = (id: string) => { setDetailId(id); setDoneId(null); };
  const pickFilter = (f: Filter) => { setFilter(f); setDetailId(null); setDoneId(null); };

  // After resolving, move to the next pending expense in this filter.
  const advance = (id: string) => {
    clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      const next = expensesRef.current.find((x) => isPending(x.st) && x.id !== id && inFilter(filterRef.current, x.st));
      if (next) open(next.id);
      else { setDetailId(null); setDoneId(null); }
    }, 900);
  };
  const expensesRef = useRef(expenses);
  const filterRef = useRef(filter);
  expensesRef.current = expenses;
  filterRef.current = filter;
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  // Keyboard: J / → next, K / ← previous, Enter runs the primary action.
  const nav = useRef({ ids: [] as string[], cur: curId });
  nav.current = { ids: queue.map((q) => q.id), cur: curId };
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (document.querySelector('.dialog-backdrop')) return;
      const t = (ev.target as HTMLElement).tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t)) return;
      const { ids, cur } = nav.current;
      if (!ids.length) return;
      const i = ids.indexOf(cur || '');
      if (ev.key === 'j' || ev.key === 'ArrowRight') { open(ids[Math.min(ids.length - 1, i + 1)]); ev.preventDefault(); }
      else if (ev.key === 'k' || ev.key === 'ArrowLeft') { open(ids[Math.max(0, i - 1)]); ev.preventDefault(); }
      else if (ev.key === 'Enter' && t !== 'BUTTON' && primary.current) { primary.current(); ev.preventDefault(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const twoCol = !isMobile && wide && !empty;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: twoCol ? '340px minmax(0,1fr)' : 'minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
      <aside data-a="1" className="panel" style={{ position: wide ? 'sticky' : 'static', top: 76, gap: 14, padding: 16, maxHeight: wide ? 'calc(100vh - 96px)' : 440, minWidth: 0 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <span className="row" style={{ gap: 10, fontSize: 15, fontWeight: 600 }}><TitleIcon n="ph-tray" size={28} />Bandeja</span>
          <span className="mono muted" style={{ fontSize: 12 }}>{resolved} de {total} revisados</span>
        </div>
        <div className="bar-track" style={{ height: 6, borderRadius: 3 }}>
          <div className="grad-bar" style={{ height: '100%', width: (total ? (resolved / total) * 100 : 100) + '%', borderRadius: 3, transition: 'width .6s cubic-bezier(.2,.8,.2,1)' }} />
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {CHIPS.map(([v, label]) => (
            <button key={v} className={'chip' + (filter === v ? ' on' : '')} aria-pressed={filter === v} onClick={() => pickFilter(v)}>
              {label} · {pendAll.filter((e) => inFilter(v, e.st)).length}
            </button>
          ))}
        </div>
        <div className="stack" style={{ gap: 6, overflowY: 'auto', minHeight: 0, flex: 1, margin: '0 -6px', padding: '2px 6px 4px' }}>
          {queue.map((q) => {
            const cur = q.id === curId;
            const alert = ALERT_STATUSES.includes(q.st);
            const dot = alert ? 'var(--color-accent-2)' : q.st === 'proc' ? 'var(--color-neutral-500)' : 'var(--color-accent)';
            return (
              <button key={q.id} onClick={() => open(q.id)} aria-current={cur || undefined} className={cur ? '' : 'hover-strong'}
                style={{ display: 'grid', gridTemplateColumns: '8px minmax(0,1fr) auto', gap: '4px 12px', alignItems: 'center', padding: 12, border: 0, borderRadius: 12, background: cur ? 'var(--color-accent-100)' : 'transparent', boxShadow: cur ? 'inset 0 0 0 1.5px var(--color-accent)' : 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <span className="dot" style={{ width: 8, height: 8, background: dot, boxShadow: '0 0 8px ' + dot }} />
                <span className="ellipsis" style={{ fontWeight: 600, fontSize: 14 }}>{q.prov}</span>
                <span className="num nowrap" style={{ fontWeight: 600, fontSize: 14 }}>{money(q.amt)}</span>
                <span />
                <span className="ellipsis" style={{ fontSize: 12.5, color: alert ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)' }}>{STAT[q.st][0]}</span>
                <span className="muted nowrap" style={{ fontSize: 12.5, textAlign: 'right' }}>{fd(q.date)}</span>
              </button>
            );
          })}
          {empty && (
            <div className="stack" style={{ alignItems: 'flex-start', gap: 10, padding: '20px 6px' }}>
              <Icon n="ph-confetti" style={{ fontSize: 40, color: 'var(--color-accent)' }} />
              <strong style={{ fontSize: 18 }}>Todo revisado</strong>
              <span className="muted" style={{ fontSize: 14 }}>No quedan gastos en esta bandeja para {co.name}.</span>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Volver al dashboard</button>
            </div>
          )}
        </div>
        {!isMobile && <div className="muted" style={{ fontSize: 12, paddingTop: 10, boxShadow: '0 -1px 0 var(--line)' }}>Atajos: J / K para moverte · Enter para la acción principal</div>}
      </aside>

      {current && (
        <ExpenseDetail key={current.id} expense={current} done={doneId === current.id} primaryRef={primary}
          onDone={() => setDoneId(current.id)} onResolved={() => advance(current.id)} />
      )}
    </div>
  );
}
