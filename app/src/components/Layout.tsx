import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { NAV_GROUPS, PAGES, SETTINGS_GROUPS, SETTINGS_PAGES } from '../data/org';
import type { PageId } from '../data/types';
import { useMotion } from '../hooks/useMotion';
import { useViewport } from '../hooks/useViewport';
import { useApp, type ThemePref } from '../state/AppState';
import { CoAvatar, Icon, Seg, UserPhoto } from './ui';

type Popover = 'company' | 'notif' | 'profile' | null;

const THEME_OPTS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'light', label: 'Claro', icon: 'ph-sun' },
  { value: 'dark', label: 'Oscuro', icon: 'ph-moon' },
  { value: 'auto', label: 'Auto', icon: 'ph-desktop' },
];

export const usePageId = (): PageId => {
  const seg = useLocation().pathname.split('/')[1];
  return (seg in PAGES ? seg : 'dashboard') as PageId;
};

export default function Layout() {
  useMotion();
  const app = useApp();
  const { co, allowed, loading, theme, setTheme } = app;
  const { isMobile, isTablet } = useViewport();
  const navigate = useNavigate();
  const page = usePageId();
  const [open, setOpen] = useState<Popover>(null);
  const [drawer, setDrawer] = useState(false);
  const [coQuery, setCoQuery] = useState('');

  // Pages the active role can't see fall back to the dashboard.
  useEffect(() => {
    if (!allowed.includes(page)) navigate('/dashboard', { replace: true });
  }, [allowed, page, navigate]);

  const { rememberPage } = app;
  useEffect(() => { rememberPage(page); }, [page, rememberPage]);

  // En una página de configuración la barra lateral muestra el panel de configuración;
  // "Volver" regresa a la última página principal y "Configuración" a la última de ajustes.
  const inSettings = SETTINGS_PAGES.includes(page);
  const lastMain = useRef<PageId>('dashboard');
  const lastSettings = useRef<PageId>('personal');
  if (inSettings) lastSettings.current = page;
  else lastMain.current = page;
  // Cambian de panel sin cerrar el cajón en móvil, para que se vea la otra barra.
  const swapPanel = (id: PageId) => { setOpen(null); navigate('/' + id); };
  const openSettings = () => swapPanel(allowed.includes(lastSettings.current) ? lastSettings.current : 'personal');

  const go = (id: PageId) => { setDrawer(false); setOpen(null); navigate('/' + id); };
  const closeAll = () => { setOpen(null); setDrawer(false); };
  const toggle = (k: Exclude<Popover, null>) => { setOpen((o) => (o === k ? null : k)); setCoQuery(''); };
  const switchTo = (id: string) => {
    setOpen(null); setDrawer(false); setCoQuery('');
    if (id === co.id) return;
    const target = app.switchCompany(id, page);
    navigate('/' + target);
  };

  const q = coQuery.trim().toLowerCase();
  const match = (c: { name: string }) => !q || c.name.toLowerCase().includes(q);
  const coList = app.companies.filter((c) => c.kind === 'Empresa' && match(c));
  const personalList = app.companies.filter((c) => c.kind === 'Personal' && match(c));
  const coEmpty = coList.length === 0 && personalList.length === 0;
  const coOption = (c: typeof co) => (
    <button key={c.id} role="option" aria-selected={c.id === co.id} className={'co-opt' + (c.id === co.id ? ' on' : '')} onClick={() => switchTo(c.id)}>
      <CoAvatar co={c} size={28} fontSize={12} />
      <span className="stack grow" style={{ lineHeight: 1.2 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
        <span className="muted" style={{ fontSize: 12 }}>{c.kind === 'Personal' ? 'Tus gastos marcados como personales' : c.role}</span>
      </span>
      {c.id === co.id && <Icon n="ph-check" style={{ color: 'var(--color-accent)', fontSize: 18 }} />}
    </button>
  );
  // Avisos calculados con los conteos reales de la empresa activa.
  const cnt = app.counts;
  const notifs: { icon: string; c: 'a' | 'a2'; text: string }[] = [
    ...(cnt && cnt.requiereRevision ? [{ icon: 'ph-sparkle', c: 'a' as const, text: cnt.requiereRevision + (cnt.requiereRevision === 1 ? ' gasto pendiente de revisión' : ' gastos pendientes de revisión') }] : []),
    ...(cnt && cnt.posibleDuplicado ? [{ icon: 'ph-copy', c: 'a2' as const, text: cnt.posibleDuplicado + (cnt.posibleDuplicado === 1 ? ' posible duplicado' : ' posibles duplicados') }] : []),
    ...(cnt && cnt.sinComprobante ? [{ icon: 'ph-receipt', c: 'a' as const, text: cnt.sinComprobante + (cnt.sinComprobante === 1 ? ' gasto sin comprobante' : ' gastos sin comprobante') }] : []),
  ];
  const scrimOn = !!open || (isMobile && drawer);
  const navButton = (id: PageId) => {
    const p = PAGES[id];
    const badge = id === 'revision' && app.pendingCount ? String(app.pendingCount) : '';
    return (
      <button key={id} className={'nav-item' + (id === page ? ' on' : '')} aria-current={id === page ? 'page' : undefined} onClick={() => go(id)}>
        <Icon n={p.icon} style={{ fontSize: 18 }} />
        <span className="grow">{p.label}</span>
        {badge && <span className="tag tag-accent-2" style={{ fontSize: 11 }}>{badge}</span>}
      </button>
    );
  };
  const navGroups = (groups: { label: string; ids: PageId[] }[]) => groups.map((g) => {
    const items = g.ids.filter((id) => allowed.includes(id));
    if (!items.length) return null;
    return (
      <div key={g.label} className="stack" style={{ gap: 2 }}>
        <div className="nav-label">{g.label}</div>
        {items.map(navButton)}
      </div>
    );
  });


  return (
    <div className="shell">
      {scrimOn && <div className="scrim" onClick={closeAll} style={{ background: isMobile && drawer ? 'rgba(0,0,0,.4)' : 'transparent' }} />}

      <aside className={'side' + (isMobile ? ' mobile' : '') + (isMobile && !drawer ? ' closed' : '')}>
        <div className="brand">
          <div className="row" style={{ gap: 10 }}>
            <span className="brand-mark">S</span>
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>siregg</span>
          </div>
          {isMobile && <button className="btn btn-ghost btn-icon" aria-label="Cerrar menú" onClick={closeAll}><Icon n="ph-x" /></button>}
        </div>

        <div style={{ position: 'relative', zIndex: 45 }}>
          <button className="co-btn" onClick={() => toggle('company')} aria-expanded={open === 'company'} aria-haspopup="listbox">
            <CoAvatar co={co} size={36} fontSize={14} />
            <span className="stack grow minw0" style={{ lineHeight: 1.2 }}>
              <span className="ellipsis" style={{ fontWeight: 600, fontSize: 15 }}>{co.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{co.role} · {co.kind}</span>
            </span>
            <Icon n="ph-caret-up-down" style={{ fontSize: 18, color: 'var(--color-neutral-700)' }} />
          </button>
          {open === 'company' && (
            <div data-pop="1" role="listbox" className="pop" style={{ left: 0, right: 0, top: 'calc(100% + 6px)', padding: 'var(--space-2)', gap: 2 }}>
              <input className="input" placeholder="Buscar organización…" value={coQuery} onChange={(e) => setCoQuery(e.target.value)} style={{ marginBottom: 'var(--space-1)' }} autoFocus />
              {coList.length > 0 && <div className="nav-label" style={{ padding: 'var(--space-1) var(--space-2)' }}>Organizaciones</div>}
              {coList.map(coOption)}
              {personalList.length > 0 && <div className="nav-label" style={{ padding: 'var(--space-2) var(--space-2) var(--space-1)' }}>Personal</div>}
              {personalList.map(coOption)}
              {coEmpty && <div className="muted" style={{ padding: 'var(--space-2)', fontSize: 14 }}>Sin coincidencias.</div>}
            </div>
          )}
        </div>

        {inSettings ? (
          <nav key="settings" className="side-panel" aria-label="Configuración">
            <div className="stack" style={{ gap: 6 }}>
              <button className="side-back" onClick={() => swapPanel(lastMain.current)}><Icon n="ph-arrow-left" /> Volver</button>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', padding: '0 var(--space-2)' }}>Configuración</div>
            </div>
            {navGroups(SETTINGS_GROUPS)}
          </nav>
        ) : (
          <>
            <nav key="main" className="stack" style={{ gap: 'var(--space-4)' }}>{navGroups(NAV_GROUPS)}</nav>
            <div className="side-foot">
              <button className="nav-item" style={{ width: '100%' }} onClick={openSettings}>
                <Icon n="ph-gear-six" style={{ fontSize: 18 }} />
                <span className="grow">Configuración</span>
                <Icon n="ph-caret-right" style={{ fontSize: 14, color: 'var(--color-neutral-700)' }} />
              </button>
            </div>
          </>
        )}
      </aside>

      <div className="stack grow minw0">
        {/* The header is its own stacking context, so it rises above the scrim while one of its popovers is open. */}
        <header className="topbar" style={{ zIndex: open === 'notif' || open === 'profile' ? 35 : undefined }}>
          {isMobile && (
            <>
              <button className="btn btn-ghost btn-icon" aria-label="Abrir menú" onClick={() => setDrawer(true)}><Icon n="ph-list" style={{ fontSize: 22 }} /></button>
              <button onClick={() => setDrawer(true)} className="row" style={{ gap: 6, border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', minHeight: 44, minWidth: 0 }}>
                <CoAvatar co={co} size={26} fontSize={11} />
                <span className="ellipsis" style={{ fontWeight: 600, fontSize: 14, maxWidth: '36vw' }}>{co.short}</span>
              </button>
            </>
          )}
          {!isMobile && (
            <div className="search grow minw0" style={{ maxWidth: 520 }}>
              <Icon n="ph-magnifying-glass" />
              <input className="input" placeholder="Buscar gastos, proveedores, RUC…"
                onKeyDown={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (e.key === 'Enter' && v) navigate('/gastos?q=' + encodeURIComponent(v));
                }} />
            </div>
          )}
          <div className="grow" />
          {isMobile && <button className="btn btn-ghost btn-icon" aria-label="Buscar" onClick={() => go('gastos')}><Icon n="ph-magnifying-glass" style={{ fontSize: 20 }} /></button>}

          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-icon" aria-label="Notificaciones" onClick={() => toggle('notif')} style={{ position: 'relative' }}>
              <Icon n="ph-bell" style={{ fontSize: 20 }} />
              {notifs.length > 0 && <span className="badge-dot">{notifs.length}</span>}
            </button>
            {open === 'notif' && (
              <div data-pop="1" className="pop" style={{ right: 0, top: 'calc(100% + 6px)', width: 'min(340px, 86vw)', padding: 'var(--space-3)', gap: 'var(--space-2)' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong>Notificaciones</strong><span className="muted" style={{ fontSize: 12 }}>{co.short}</span>
                </div>
                {notifs.map((n, i) => (
                  <div key={i} className="row" style={{ gap: 'var(--space-2)', padding: 'var(--space-2) 0', fontSize: 14, alignItems: 'flex-start' }}>
                    <Icon n={n.icon} style={{ fontSize: 18, color: n.c === 'a2' ? 'var(--color-accent-2)' : 'var(--color-accent)' }} />
                    <div className="stack" style={{ gap: 2 }}><span>{n.text}</span></div>
                  </div>
                ))}
                {!notifs.length && <div className="muted" style={{ fontSize: 14 }}>Sin avisos pendientes.</div>}
              </div>
            )}
          </div>

          {!isTablet && (
            <Seg name="theme" value={theme} onChange={setTheme} optStyle={{ padding: '6px 9px' }}
              options={THEME_OPTS.map((o) => ({ value: o.value, icon: o.icon, title: o.label }))} />
          )}

          <div style={{ position: 'relative' }}>
            <button className="me-avatar" aria-label="Perfil" onClick={() => toggle('profile')} style={{ overflow: 'hidden', padding: app.user.avatarUrl ? 0 : undefined }}><UserPhoto user={app.user} /></button>
            {open === 'profile' && (
              <div data-pop="1" className="pop" style={{ right: 0, top: 'calc(100% + 6px)', width: 260, padding: 'var(--space-3)', gap: 'var(--space-2)' }}>
                <div className="stack" style={{ lineHeight: 1.3 }}><strong>{app.user.name}</strong><span className="muted" style={{ fontSize: 13 }}>{app.user.email}</span></div>
                <div className="nav-label" style={{ padding: 0, marginTop: 'var(--space-2)' }}>Tema</div>
                <Seg name="theme-p" value={theme} onChange={setTheme} style={{ width: '100%' }} optStyle={{ flex: 1, justifyContent: 'center' }}
                  options={THEME_OPTS.map((o) => ({ value: o.value, label: o.label }))} />
                <button className="btn btn-ghost" onClick={() => go('personal')} style={{ justifyContent: 'flex-start', marginTop: 'var(--space-2)' }}><Icon n="ph-gear" /> Configuración personal</button>
                <button className="btn btn-ghost" style={{ justifyContent: 'flex-start' }}
                  onClick={() => { setOpen(null); app.logout(); }}>
                  <Icon n="ph-sign-out" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="main">
          <PageHeader page={page} />
          {loading ? <LoadingState name={co.name} /> : <Outlet key={co.id} />}
        </main>
      </div>

      {app.toast && (
        <div data-toast="1" role="status" className="toast" style={{ left: isMobile ? 'var(--space-4)' : 'auto' }}>
          <Icon n={app.toast.icon} style={{ color: 'var(--color-accent)', fontSize: 20 }} />
          <span className="grow">{app.toast.text}</span>
          <button className="btn btn-ghost btn-icon" aria-label="Cerrar" onClick={app.hideToast}><Icon n="ph-x" /></button>
        </div>
      )}
    </div>
  );
}

function PageHeader({ page }: { page: PageId }) {
  const { co, loading } = useApp();
  const navigate = useNavigate();
  const app = useApp();
  const isDash = page === 'dashboard' && !loading;
  const scope = app.personal ? 'Tus gastos personales en todas tus organizaciones' : 'Todos los gastos de la organización';
  let actions: ReactNode = null;
  if (isDash) {
    const goReports = () => app.allowed.includes('reportes') ? navigate('/reportes') : app.showToast('Tu rol no tiene acceso a Reportes en ' + co.short, 'ph-lock');
    actions = (
      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={goReports}><Icon n="ph-chart-bar" /> Reportes</button>
        <button className="btn btn-secondary" onClick={() => navigate('/revision')}><Icon n="ph-sparkle" /> Revisar pendientes</button>
        <button className="btn btn-primary" onClick={() => showRegisterInfo(app.showToast)}><Icon n="ph-plus" /> Registrar gasto</button>
      </div>
    );
  }
  return (
    <div className="row wrap" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div className="stack minw0" style={{ gap: 6 }}>
        <div className="row wrap muted" style={{ gap: 10, fontSize: 13 }}>
          <span>{co.name} · <span style={{ textTransform: 'capitalize' }}>{new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}</span></span>
          {isDash && (
            <span className="row" style={{ gap: 6 }}>
              <span className="dot" style={{ width: 6, height: 6, background: 'var(--color-accent)', boxShadow: '0 0 10px var(--color-accent)' }} />{scope}
            </span>
          )}
        </div>
        <h1 className="page-title">{PAGES[page].label}</h1>
      </div>
      {actions}
    </div>
  );
}

export const showRegisterInfo = (toast: (t: string, i?: string) => void) =>
  toast('Los gastos se registran enviando foto, audio o texto por Telegram.', 'ph-telegram-logo');

function LoadingState({ name }: { name: string }) {
  return (
    <div aria-busy="true" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="muted" style={{ fontSize: 14 }}><Icon n="ph-circle-notch" /> Cargando {name}…</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'var(--space-4)' }}>
        <div className="skeleton" style={{ height: 110 }} /><div className="skeleton" style={{ height: 110 }} /><div className="skeleton" style={{ height: 110 }} />
      </div>
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}
