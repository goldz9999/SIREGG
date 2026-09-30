import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDashboard, CHART_H } from '../data/dashboard';
import { money } from '../lib/format';
import { useViewport } from '../hooks/useViewport';
import { useApp } from '../state/AppState';
import { CountUp, Icon, TitleIcon } from '../components/ui';

export default function Dashboard() {
  const { co, pendingCount, resumen, expenses } = useApp();
  const navigate = useNavigate();
  const { isWide } = useViewport();
  const d = useMemo(() => buildDashboard(co, resumen, expenses), [co, resumen, expenses]);
  const [hi, setHi] = useState<number | null>(null);

  const sel = hi ?? 13;
  const dotX = (sel / 13) * 100 + '%';
  const dotY = (d.pts[sel][1] / CHART_H) * 100 + '%';
  const total = co.review || 0;
  const resolved = Math.max(0, total - pendingCount);
  const pct = (total ? (resolved / total) * 100 : 100) + '%';
  const md = d.monthDelta;

  const goReview = (kind?: string) => navigate('/revision' + (kind ? '?f=' + (kind === 'proc' ? 'pend' : kind) : ''));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isWide ? 'minmax(0,2fr) minmax(320px,1fr)' : 'minmax(0,1fr)', gap: 20 }}>
        <section data-a="1" className="panel" style={{ position: 'relative', overflow: 'hidden', gap: 14, padding: 24 }}>
          <div style={{ position: 'absolute', inset: '-50% 45% 45% -15%', background: 'radial-gradient(closest-side,color-mix(in srgb,var(--color-accent) 22%,transparent),transparent)', pointerEvents: 'none' }} />
          <div className="row wrap" style={{ position: 'relative', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div className="stack" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>Gasto de {d.monthName}</span>
              <span className="num" style={{ fontSize: 'clamp(38px,4.6vw,52px)', fontWeight: 600, letterSpacing: '-.04em', lineHeight: 1 }}><CountUp value={d.month} /></span>
              <span className="row" style={{ gap: 8, fontSize: 13 }}>
                <span style={{ padding: '3px 8px', borderRadius: 7, fontWeight: 500, background: md.up > 0 ? 'var(--color-accent-2-100)' : 'var(--color-accent-100)', color: md.dColor }}>{md.delta}</span>
                <span className="muted">{md.vs}</span>
              </span>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end', gap: 2, minWidth: 140 }}>
              <span className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>{money(d.vals[sel])}</span>
              <span className="muted" style={{ fontSize: 12.5 }}>{d.dayLabels[sel]}{sel === 13 ? ' · hoy' : ''}</span>
            </div>
          </div>
          <div style={{ position: 'relative', height: 200 }}>
            <svg data-reveal="1" viewBox="0 0 600 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="dga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-accent)" stopOpacity=".32" /><stop offset="1" stopColor="var(--color-violet)" stopOpacity="0" /></linearGradient>
                <linearGradient id="dgl" x1="0" x2="1"><stop offset="0" stopColor="var(--color-violet)" /><stop offset="1" stopColor="var(--color-accent)" /></linearGradient>
              </defs>
              <path d="M0 50H600M0 100H600M0 150H600" stroke="var(--line)" strokeDasharray="3 6" />
              <path d={d.area} fill="url(#dga)" />
              <path d={d.line} fill="none" stroke="url(#dgl)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: dotX, width: 1, background: 'var(--line)', transition: 'left .3s cubic-bezier(.2,.8,.2,1)' }} />
            <div style={{ position: 'absolute', left: dotX, top: dotY, width: 12, height: 12, margin: '-6px 0 0 -6px', borderRadius: '50%', background: 'var(--color-raised)', border: '2.5px solid var(--color-accent)', boxShadow: '0 0 0 6px color-mix(in srgb,var(--color-accent) 20%,transparent)', transition: 'left .3s cubic-bezier(.2,.8,.2,1),top .3s cubic-bezier(.2,.8,.2,1)' }} />
            <div onMouseLeave={() => setHi(null)} style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              {d.vals.map((_, i) => <div key={i} onMouseEnter={() => setHi(i)} style={{ flex: 1, cursor: 'crosshair' }} />)}
            </div>
          </div>
          <div className="row mono faint" style={{ justifyContent: 'space-between', fontSize: 11 }}>
            {d.xLabels.map((x) => <span key={x}>{x}</span>)}
          </div>
        </section>

        <section data-a="1" className="panel" style={{ gap: 14, padding: 22 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="row" style={{ gap: 10, fontSize: 15, fontWeight: 600 }}><TitleIcon n="ph-sparkle" />Revisión IA</span>
            <span className="mono muted" style={{ fontSize: 12 }}>{resolved} de {total} revisados</span>
          </div>
          <div className="bar-track" style={{ height: 6, borderRadius: 3 }}><div data-grow="x" className="grad-bar" style={{ width: pct, height: '100%', borderRadius: 3 }} /></div>
          <div className="stack" style={{ gap: 6 }}>
            {d.review.map((r, i) => (
              <button key={i} onClick={() => goReview(r.kind)} className="list-btn nudge" style={{ gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--fill)', border: '1px solid var(--line)', minHeight: 52 }}>
                <span className="dot" style={{ width: 8, height: 8, background: r.color, boxShadow: '0 0 10px ' + r.color }} />
                <span className="stack grow minw0" style={{ lineHeight: 1.3 }}>
                  <span className="ellipsis" style={{ fontWeight: 500, fontSize: 14 }}>{r.title}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{r.status}</span>
                </span>
                <Icon n="ph-caret-right" style={{ color: 'var(--color-neutral-500)' }} />
              </button>
            ))}
            {!d.review.length && (
              <div className="row muted" style={{ gap: 10, padding: '14px 0', fontSize: 14 }}>
                <Icon n="ph-check-circle" style={{ fontSize: 22, color: 'var(--color-accent)' }} /> Todo revisado. Sin duplicados.
              </div>
            )}
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 'auto', width: '100%' }} onClick={() => goReview()}>Abrir bandeja de revisión <Icon n="ph-arrow-right" /></button>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
        {d.kpis.map((k) => (
          <div key={k.label} data-a="1" className="panel lift" style={{ gap: 6, padding: '18px 18px 12px' }}>
            <span className="muted" style={{ fontSize: 13 }}>{k.label}</span>
            <span className="num" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.03em' }}><CountUp value={k.raw} /></span>
            <span className="row" style={{ gap: 6, fontSize: 12.5 }}><span style={{ color: k.dColor, fontWeight: 500 }}>{k.delta}</span><span className="muted">{k.vs}</span></span>
            <svg data-reveal="1" viewBox="0 0 100 28" preserveAspectRatio="none" style={{ width: '100%', height: 34, overflow: 'visible' }}>
              <path d={k.spark} fill="none" stroke={k.sc} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isWide ? 'minmax(0,1fr) minmax(0,1.25fr)' : 'minmax(0,1fr)', gap: 20 }}>
        <section data-a="1" className="panel" style={{ gap: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 className="panel-title">Por categoría</h2><span className="muted" style={{ fontSize: 12.5 }}>{d.monthLabel}</span>
          </div>
          <div className="row wrap" style={{ gap: 20 }}>
            <div style={{ position: 'relative', width: 150, height: 150, flex: 'none' }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--fill-strong)" strokeWidth="11" />
                {d.cats.map((c) => <circle key={c.name} cx="50" cy="50" r="40" fill="none" stroke={c.color} strokeWidth="11" strokeDasharray={c.dash} strokeDashoffset={c.off} />)}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <span className="stack"><span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>{d.cats.length}</span><span className="muted" style={{ fontSize: 11.5 }}>categorías</span></span>
              </div>
            </div>
            <div className="stack grow" style={{ minWidth: 200, gap: 9 }}>
              {d.cats.map((c) => (
                <div key={c.name} className="row" style={{ gap: 10, fontSize: 13.5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: c.color, flex: 'none' }} />
                  <span className="grow">{c.name}</span>
                  <span className="num" style={{ color: 'var(--color-neutral-800)' }}>{c.amt}</span>
                  <span className="mono muted" style={{ width: 36, textAlign: 'right', fontSize: 12 }}>{c.pct}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 8, paddingTop: 14, boxShadow: '0 -1px 0 var(--line)' }}>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
              <span>Empresarial <strong style={{ fontWeight: 600 }}>{d.bizPct}</strong></span><span className="muted">Personal {d.perPct}</span>
            </div>
            <div className="row bar-track" style={{ height: 8, borderRadius: 4 }}><div data-grow="x" className="grad-bar" style={{ width: d.bizPct, height: '100%' }} /></div>
          </div>
        </section>

        <section data-a="1" className="panel" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <h2 className="panel-title">Gastos recientes</h2>
            <button className="btn btn-ghost" onClick={() => navigate('/gastos')}>Ver todos</button>
          </div>
          {d.recent.map((t, i) => (
            <button key={i} onClick={() => navigate('/gastos')} className="list-btn hover-fill" style={{ gap: 12, padding: 10, margin: '0 -10px', borderRadius: 12, minHeight: 52 }}>
              <span className="icon-tile" style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--fill-strong)' }}><Icon n={t.icon} style={{ fontSize: 18, color: 'var(--color-neutral-800)' }} /></span>
              <span className="stack grow minw0" style={{ lineHeight: 1.3 }}>
                <span className="ellipsis" style={{ fontSize: 14, fontWeight: 500 }}>{t.desc}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{t.prov} · {t.date}</span>
              </span>
              <span className="num" style={{ fontWeight: 600, fontSize: 14 }}>{t.amt}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
