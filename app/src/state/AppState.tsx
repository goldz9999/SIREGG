import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { findCompany, PERMS } from '../data/org';
import { generateExpenses, isPending } from '../data/expenses';
import type { Company, Expense, Member, PageId } from '../data/types';

export type ThemePref = 'light' | 'dark' | 'auto';

interface Toast { text: string; icon: string }

/**
 * Demo-only edits, kept in memory for the session and keyed by company so no
 * tenant's changes leak into another. Nothing here reaches a server.
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

interface AppState {
  theme: ThemePref;
  dark: boolean;
  setTheme: (t: ThemePref) => void;
  co: Company;
  allowed: PageId[];
  loading: boolean;
  /** Switches tenant; resolves the page to land on (falls back to dashboard if the role can't see `page`). */
  switchCompany: (id: string, page: PageId) => PageId;
  expenses: Expense[];
  pendingCount: number;
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
  const stored = useRef(readStored()).current;
  const [theme, setThemeState] = useState<ThemePref>(stored.theme || 'light');
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [coId, setCoId] = useState(stored.coId || 'demo');
  const [lastPage, setLastPage] = useState<PageId>(stored.page || 'dashboard');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [edits, setEdits] = useState<DemoEdits>(EMPTY_EDITS);
  const toastTimer = useRef<number>();
  const loadTimer = useRef<number>();

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

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(loadTimer.current); }, []);

  const showToast = useCallback((text: string, icon = 'ph-info') => {
    clearTimeout(toastTimer.current);
    setToast({ text, icon });
    toastTimer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  const co = findCompany(coId);
  const allowed = PERMS[co.role];

  const switchCompany = useCallback((id: string, page: PageId): PageId => {
    const next = findCompany(id);
    const target = PERMS[next.role].includes(page) ? page : 'dashboard';
    if (id === coId) return target;
    setCoId(id);
    setLastPage(target);
    // Show a loading state rather than the previous tenant's data.
    setLoading(true);
    clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => {
      setLoading(false);
      showToast('Ahora en ' + next.name + ' (demostración)', 'ph-arrows-left-right');
    }, 700);
    return target;
  }, [coId, showToast]);

  const expenses = useMemo(
    () => generateExpenses(co.id, co.review).map((e) => ({ ...e, ...(edits.expenses[co.id + '|' + e.id] || {}) })),
    [co.id, co.review, edits.expenses],
  );
  const pendingCount = useMemo(() => expenses.filter((e) => isPending(e.st)).length, [expenses]);

  const patchExpense = useCallback((id: string, p: Partial<Expense>) => {
    setEdits((s) => {
      const k = coId + '|' + id;
      return { ...s, expenses: { ...s.expenses, [k]: { ...(s.expenses[k] || {}), ...p } } };
    });
  }, [coId]);

  const value: AppState = {
    theme, dark, setTheme: setThemeState, co, allowed, loading, switchCompany,
    expenses, pendingCount, patchExpense, edits, setEdits,
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
