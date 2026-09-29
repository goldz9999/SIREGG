import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as endpoints from '../api/endpoints';
import { mapGasto } from '../api/mappers';
import { planSync } from '../api/sync';
import type { ApiCategoria, ApiConteos, ApiResumen } from '../api/types';
import { isPending } from '../data/expenses';
import { PERMS } from '../data/org';
import type { Company, Expense, Member, PageId } from '../data/types';
import { useAuth, type SessionUser } from './Auth';

export type ThemePref = 'light' | 'dark' | 'auto';

interface Toast { text: string; icon: string }

/**
 * Ediciones locales. `expenses` es un overlay optimista de los cambios que sí
 * viajan al backend y de los campos sin endpoint (proyecto, proveedor, RUC, medio de pago).
 * El resto (proyectos, categorías, miembros…) sigue siendo demostración en memoria.
 */
interface DemoEdits {
  expenses: Record<string, Partial<Expense>>;
  projects: Record<string, string[]>;
  categories: Record<string, string[]>;
  categoriesOff: Record<string, boolean>;
  members: Record<string, Partial<Member>>;
  invited: Record<string, Member[]>;
  companyCfg: Record<string, Record<string, string>>;
  companyPrefs: Record<string, Record<string, boolean>>;
  myPrefs: Record<string, boolean>;
}

const EMPTY_EDITS: DemoEdits = {
  expenses: {}, projects: {}, categories: {}, categoriesOff: {}, members: {}, invited: {}, companyCfg: {}, companyPrefs: {}, myPrefs: {},
};

/** Campos que el backend no guarda: sobreviven a una recarga desde la API. */
const LOCAL_ONLY: (keyof Expense)[] = ['proj', 'prov', 'ruc', 'pay'];

function keepLocalOnly(map: Record<string, Partial<Expense>>): Record<string, Partial<Expense>> {
  const out: Record<string, Partial<Expense>> = {};
  for (const [k, v] of Object.entries(map)) {
    const kept: Partial<Expense> = {};
    for (const f of LOCAL_ONLY) if (f in v) (kept as Record<string, unknown>)[f] = v[f];
    if (Object.keys(kept).length) out[k] = kept;
  }
  return out;
}

interface AppState {
  theme: ThemePref;
  dark: boolean;
  setTheme: (t: ThemePref) => void;
  user: SessionUser;
  logout: () => void;
  companies: Company[];
  co: Company;
  allowed: PageId[];
  loading: boolean;
  /** Cambia de empresa; devuelve la página a la que ir (dashboard si el rol no puede ver `page`). */
  switchCompany: (id: string, page: PageId) => PageId;
  expenses: Expense[];
  pendingCount: number;
  resumen: ApiResumen | null;
  counts: ApiConteos | null;
  categories: ApiCategoria[];
  patchExpense: (id: string, p: Partial<Expense>) => void;
  edits: DemoEdits;
  setEdits: (fn: (e: DemoEdits) => DemoEdits) => void;
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const companies = auth.companies;
  const user = auth.user!;
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
  const [edits, setEdits] = useState<DemoEdits>(EMPTY_EDITS);
  const [gastos, setGastos] = useState<Expense[]>([]);
  const [resumen, setResumen] = useState<ApiResumen | null>(null);
  const [counts, setCounts] = useState<ApiConteos | null>(null);
  const [categories, setCategories] = useState<ApiCategoria[]>([]);
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
  useEffect(() => {
    let alive = true;
    const empresaId = Number(coId);
    if (silentRef.current) silentRef.current = false;
    else setLoading(true);
    Promise.all([endpoints.listGastos(empresaId), endpoints.conteos(empresaId), endpoints.resumen(empresaId), endpoints.categorias(empresaId)])
      .then(([g, c, r, cats]) => {
        if (!alive) return;
        setGastos(g.map(mapGasto));
        setCounts(c);
        setResumen(r);
        setCategories(cats);
        setEdits((s) => ({ ...s, expenses: keepLocalOnly(s.expenses) }));
      })
      .catch((e) => {
        if (!alive) return;
        setGastos([]); setCounts(null); setResumen(null); setCategories([]);
        showToast(e instanceof Error ? e.message : 'No se pudieron cargar los datos.', 'ph-warning-circle');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [coId, reloadTick, showToast]);

  const base = companies.find((c) => c.id === coId) ?? companies[0];
  const co = useMemo<Company>(() => ({ ...base, review: counts?.requiereRevision ?? 0 }), [base, counts]);
  const allowed = PERMS[co.role];

  const switchCompany = useCallback((id: string, page: PageId): PageId => {
    const next = companies.find((c) => c.id === id);
    if (!next) return page;
    const target = PERMS[next.role].includes(page) ? page : 'dashboard';
    if (id === coId) return target;
    setCoId(id);
    setLastPage(target);
    setGastos([]); setCounts(null); setResumen(null);
    endpoints.setEmpresaActiva(Number(id)).catch(() => { /* solo recuerda la preferencia */ });
    showToast('Ahora en ' + next.name, 'ph-arrows-left-right');
    return target;
  }, [companies, coId, showToast]);

  const expenses = useMemo(
    () => gastos.map((e) => ({ ...e, ...(edits.expenses[coId + '|' + e.id] || {}) })),
    [gastos, coId, edits.expenses],
  );
  const expensesRef = useRef<Expense[]>([]);
  expensesRef.current = expenses;
  const pendingCount = useMemo(() => expenses.filter((e) => isPending(e.st)).length, [expenses]);

  const patchExpense = useCallback((id: string, p: Partial<Expense>) => {
    const key = coId + '|' + id;
    const cur = expensesRef.current.find((e) => e.id === id);
    setEdits((s) => ({ ...s, expenses: { ...s.expenses, [key]: { ...(s.expenses[key] || {}), ...p } } }));
    if (!cur) return;

    const plan = planSync(cur, p, categories);
    if (plan.kind === 'none') return;
    const n = Number(id);
    const empresaId = Number(coId);
    const call =
      plan.kind === 'patch' ? endpoints.patchGasto(n, empresaId, plan.body)
      : plan.kind === 'confirmarConfianza' ? endpoints.confirmarConfianza(n, empresaId)
      : plan.kind === 'confirmarDuplicado' ? endpoints.confirmarDuplicado(n, empresaId)
      : endpoints.descartarDuplicado(n, empresaId);

    call
      .then(() => { silentRef.current = true; setReloadTick((t) => t + 1); })
      .catch((err) => {
        setEdits((s) => {
          const rest = { ...s.expenses };
          delete rest[key];
          return { ...s, expenses: rest };
        });
        showToast(err instanceof Error ? err.message : 'No se pudo guardar el cambio.', 'ph-warning-circle');
      });
  }, [coId, categories, showToast]);

  const value: AppState = {
    theme, dark, setTheme: setThemeState, user, logout: auth.logout, companies, co, allowed, loading, switchCompany,
    expenses, pendingCount, resumen, counts, categories, patchExpense, edits, setEdits,
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
