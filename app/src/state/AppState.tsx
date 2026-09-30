import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as endpoints from '../api/endpoints';
import { mapGasto, PERSONAL, PERSONAL_ID } from '../api/mappers';
import { planSync } from '../api/sync';
import { escucharGastos } from '../api/realtime';
import type { ApiCategoria, ApiConteos, ApiPedido, ApiProveedor, ApiResumen } from '../api/types';
import { isPending } from '../data/expenses';
import { PERMS } from '../data/org';
import type { Company, Expense, PageId } from '../data/types';
import { setCurrency } from '../lib/format';
import { useAuth, type SessionUser } from './Auth';

export type ThemePref = 'light' | 'dark' | 'auto';

interface Toast { text: string; icon: string }

interface AppState {
  theme: ThemePref;
  dark: boolean;
  setTheme: (t: ThemePref) => void;
  user: SessionUser;
  logout: () => void;
  /** Empresas del usuario más el espacio "Gastos personales" (al final, solo si puede registrarlos). */
  companies: Company[];
  co: Company;
  /** True en el espacio "Gastos personales". */
  personal: boolean;
  allowed: PageId[];
  loading: boolean;
  /** Cambia de empresa; devuelve la página a la que ir (dashboard si el rol no puede ver `page`). */
  switchCompany: (id: string, page: PageId) => PageId;
  expenses: Expense[];
  /** Duplicados ya descartados: no suman en totales ni salen en "Todos". */
  duplicados: Expense[];
  pendingCount: number;
  resumen: ApiResumen | null;
  counts: ApiConteos | null;
  categories: ApiCategoria[];
  pedidos: ApiPedido[];
  proveedores: ApiProveedor[];
  patchExpense: (id: string, p: Partial<Expense>) => void;
  /** Vuelve a pedir los datos de la empresa activa, sin mostrar el estado de carga. */
  reload: () => void;
  toast: Toast | null;
  showToast: (text: string, icon?: string) => void;
  hideToast: () => void;
  lastPage: PageId;
  rememberPage: (p: PageId) => void;
}

const Ctx = createContext<AppState | null>(null);
const STORE_KEY = 'siregg-ui';

function readStored(): { theme?: ThemePref; coId?: string; page?: PageId } {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Pone el tema guardado en <html> antes del primer render: el login también usa las variables del tema. */
export function aplicarTemaInicial() {
  const theme = readStored().theme || 'light';
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('theme-dark', dark);
  document.documentElement.classList.toggle('theme-light', !dark);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const user = auth.user!;
  const companies = useMemo(() => (user.canPersonal ? [...auth.companies, PERSONAL] : auth.companies), [auth.companies, user.canPersonal]);
  const stored = useRef(readStored()).current;
  const [theme, setThemeState] = useState<ThemePref>(stored.theme || 'light');
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [coId, setCoId] = useState(() => {
    if (stored.coId && companies.some((c) => c.id === stored.coId)) return stored.coId;
    const last = user.lastCompanyId;
    if (last != null && companies.some((c) => c.id === String(last))) return String(last);
    return companies[0].id;
  });
  const [lastPage, setLastPage] = useState<PageId>(stored.page || 'dashboard');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [gastos, setGastos] = useState<Expense[]>([]);
  const [dupsBase, setDupsBase] = useState<Expense[]>([]);
  // Cambios pendientes de confirmar por el servidor (optimista); se limpia en cada recarga.
  const [overlay, setOverlay] = useState<Record<string, Partial<Expense>>>({});
  const [resumen, setResumen] = useState<ApiResumen | null>(null);
  const [counts, setCounts] = useState<ApiConteos | null>(null);
  const [categories, setCategories] = useState<ApiCategoria[]>([]);
  const [pedidos, setPedidos] = useState<ApiPedido[]>([]);
  const [proveedores, setProveedores] = useState<ApiProveedor[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const silentRef = useRef(false);
  const toastTimer = useRef<number>();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSysDark(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const dark = theme === 'dark' || (theme === 'auto' && sysDark);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-dark', dark);
    root.classList.toggle('theme-light', !dark);
  }, [dark]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ theme, coId, page: lastPage }));
    } catch {
      /* storage unavailable: preferences just won't persist */
    }
  }, [theme, coId, lastPage]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((text: string, icon = 'ph-info') => {
    clearTimeout(toastTimer.current);
    setToast({ text, icon });
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  // Carga de la empresa activa. Un cambio de empresa muestra el estado de carga;
  // una recarga tras guardar (silentRef) no desmonta la pantalla.
  // En "Gastos personales" se piden mis gastos personales de todas mis empresas y las
  // categorías de cada una (el detalle del gasto ofrece las de la empresa del gasto).
  const empresaIds = useMemo(() => auth.companies.map((c) => Number(c.id)), [auth.companies]);
  useEffect(() => {
    let alive = true;
    const empresaId = Number(coId);
    if (silentRef.current) silentRef.current = false;
    else setLoading(true);
    const load = coId === PERSONAL_ID
      ? Promise.all([
        endpoints.listGastosPersonales(), endpoints.conteosPersonal(), endpoints.resumenPersonal(),
        Promise.all(empresaIds.map((id) => endpoints.categorias(id))).then((l) => l.flat()),
        Promise.resolve([] as ApiPedido[]), Promise.resolve([] as ApiProveedor[]),
        endpoints.listDuplicadosPersonales().catch(() => []),
      ] as const)
      : Promise.all([
        endpoints.listGastos(empresaId), endpoints.conteos(empresaId), endpoints.resumen(empresaId),
        endpoints.categorias(empresaId), endpoints.listPedidos(empresaId), endpoints.listProveedores(empresaId),
        endpoints.listDuplicados(empresaId).catch(() => []),
      ] as const);
    load
      .then(([g, c, r, cats, peds, provs, dups]) => {
        if (!alive) return;
        setGastos(g.map(mapGasto));
        setDupsBase(dups.map(mapGasto));
        setCounts(c);
        setResumen(r);
        setCategories(cats);
        setPedidos(peds);
        setProveedores(provs);
        setOverlay({});
      })
      .catch((e) => {
        if (!alive) return;
        setGastos([]); setDupsBase([]); setCounts(null); setResumen(null); setCategories([]); setPedidos([]); setProveedores([]);
        showToast(e instanceof Error ? e.message : 'No se pudieron cargar los datos.', 'ph-warning-circle');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [coId, empresaIds, reloadTick, showToast]);

  const reload = useCallback(() => { silentRef.current = true; setReloadTick((t) => t + 1); }, []);

  // Tiempo real: el backend avisa por socket cuando entra o cambia un gasto (p. ej. una
  // factura enviada por Telegram) y se recarga sin mostrar el estado de carga. Varios avisos
  // seguidos (factura + foto + pago) se juntan en una sola recarga.
  const lastLoad = useRef(Date.now());
  useEffect(() => { lastLoad.current = Date.now(); }, [reloadTick, coId]);
  useEffect(() => {
    const ids = coId === PERSONAL_ID ? empresaIds : [Number(coId)];
    let timer: number | undefined;
    const stop = escucharGastos(ids, (c) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        reload();
        if (c.tipo === 'creado') showToast('Llegó un gasto nuevo.', 'ph-receipt');
      }, 600);
    });
    // Respaldo si el socket no conecta (proxy, red): al volver a la pestaña se refresca.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 20000) reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(timer); stop(); document.removeEventListener('visibilitychange', onVisible); };
  }, [coId, empresaIds, reload, showToast]);

  const base = companies.find((c) => c.id === coId) ?? companies[0];
  const co = useMemo<Company>(() => ({ ...base, review: counts?.requiereRevision ?? 0 }), [base, counts]);
  const personal = co.id === PERSONAL_ID;
  // Bot de Telegram: por rol (propietario) o por permiso que dio el propietario.
  const allowed = useMemo<PageId[]>(
    () => (!personal && user.canTelegram && !PERMS[co.role].includes('telegram') ? [...PERMS[co.role], 'telegram'] : PERMS[co.role]),
    [co.role, personal, user.canTelegram],
  );
  // Se fija durante el render para que los montos ya salgan con la moneda correcta.
  setCurrency(co.currency);

  const switchCompany = useCallback((id: string, page: PageId): PageId => {
    const next = companies.find((c) => c.id === id);
    if (!next) return page;
    const target = PERMS[next.role].includes(page) ? page : 'dashboard';
    if (id === coId) return target;
    setCoId(id);
    setLastPage(target);
    setGastos([]); setDupsBase([]); setCounts(null); setResumen(null); setCategories([]); setPedidos([]); setProveedores([]);
    if (id !== PERSONAL_ID) endpoints.setEmpresaActiva(Number(id)).catch(() => { /* solo recuerda la preferencia */ });
    showToast('Ahora en ' + next.name, 'ph-arrows-left-right');
    return target;
  }, [companies, coId, showToast]);

  const expenses = useMemo(
    () => gastos.map((e) => ({ ...e, ...(overlay[e.id] || {}) })),
    [gastos, overlay],
  );
  const duplicados = useMemo(
    () => dupsBase.map((e) => ({ ...e, ...(overlay[e.id] || {}) })),
    [dupsBase, overlay],
  );
  const expensesRef = useRef<Expense[]>([]);
  expensesRef.current = [...expenses, ...duplicados];
  const pendingCount = useMemo(() => expenses.filter((e) => isPending(e.st)).length, [expenses]);

  const patchExpense = useCallback((id: string, p: Partial<Expense>) => {
    const cur = expensesRef.current.find((e) => e.id === id);
    if (!cur) return;
    // Las acciones van contra la empresa del gasto (en el espacio personal se mezclan varias).
    const empresaId = cur.empresaId ?? Number(coId);
    if (!Number.isInteger(empresaId)) return;
    const cats = categories.filter((c) => c.empresa_id === empresaId);
    const plan = planSync(cur, p, cats, pedidos.map((x) => ({ id: x.id, nombre: x.nombre })));
    if (plan.kind === 'none') return;
    setOverlay((s) => ({ ...s, [id]: { ...(s[id] || {}), ...p } }));
    const n = Number(id);

    const run = async () => {
      if (plan.kind === 'patch') { await endpoints.patchGasto(n, empresaId, plan.body); return; }
      if (plan.kind === 'confirmarConfianza') { await endpoints.confirmarConfianza(n, empresaId); return; }
      if (plan.kind === 'confirmarDuplicado') await endpoints.confirmarDuplicado(n, empresaId);
      else await endpoints.descartarDuplicado(n, empresaId);
      // Datos corregidos junto con la decisión sobre el duplicado: se guardan después.
      if (plan.body) await endpoints.patchGasto(n, empresaId, plan.body);
    };

    run()
      .then(() => reload())
      .catch((err) => {
        setOverlay((s) => {
          const rest = { ...s };
          delete rest[id];
          return rest;
        });
        showToast(err instanceof Error ? err.message : 'No se pudo guardar el cambio.', 'ph-warning-circle');
      });
  }, [coId, categories, pedidos, reload, showToast]);

  const value: AppState = {
    theme, dark, setTheme: setThemeState, user, logout: auth.logout, companies, co, personal, allowed, loading, switchCompany,
    expenses, duplicados, pendingCount, resumen, counts, categories, pedidos, proveedores, patchExpense, reload,
    toast, showToast, hideToast: () => setToast(null),
    lastPage, rememberPage: setLastPage,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
