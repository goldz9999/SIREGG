import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearToken, getToken, setToken, setUnauthorizedHandler } from '../api/client';
import * as endpoints from '../api/endpoints';
import { initialsOf, mapCompany } from '../api/mappers';
import type { ApiUsuario } from '../api/types';
import type { Company } from '../data/types';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  initials: string;
  esSuperAdmin: boolean;
  lastCompanyId: number | null;
}

interface AuthState {
  status: 'loading' | 'out' | 'in';
  user: SessionUser | null;
  companies: Company[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const SESSION_KEY = 'siregg-session';

const readCached = (): ApiUsuario | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
};
const writeCached = (u: ApiUsuario | null) => {
  try { u ? localStorage.setItem(SESSION_KEY, JSON.stringify(u)) : localStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ }
};

const toUser = (u: ApiUsuario): SessionUser => {
  const name = u.nombre || u.email || 'Usuario';
  return { id: u.id, name, email: u.email || '', initials: initialsOf(name), esSuperAdmin: u.es_super_admin, lastCompanyId: u.ultima_empresa_id };
};

async function loadCompanies(u: ApiUsuario): Promise<Company[]> {
  const empresas = await endpoints.empresasMias();
  return empresas
    .filter((e) => e.activa !== false)
    .map((e) => mapCompany(e, u.es_super_admin ? 'propietario' : u.empresas.find((x) => x.empresa_id === e.id)?.rol ?? 'empleado'));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>(getToken() ? 'loading' : 'out');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  const reset = useCallback(() => {
    clearToken(); writeCached(null);
    setUser(null); setCompanies([]); setStatus('out');
  }, []);

  const enter = useCallback(async (u: ApiUsuario) => {
    const list = await loadCompanies(u);
    writeCached(u);
    setUser(toUser(u)); setCompanies(list); setStatus('in');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(reset);
    return () => setUnauthorizedHandler(null);
  }, [reset]);

  // Sesión previa: valida el token y refresca roles/empresas desde /auth/me.
  useEffect(() => {
    if (!getToken()) return;
    const cached = readCached();
    endpoints.me()
      .then((fresh) => enter({ ...(cached ?? {}), ...fresh } as ApiUsuario))
      .catch(reset);
  }, [enter, reset]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await endpoints.login(email, password);
    setToken(res.access_token);
    try {
      await enter(res.usuario);
    } catch (e) {
      reset();
      throw e;
    }
  }, [enter, reset]);

  const value = useMemo<AuthState>(() => ({ status, user, companies, login, logout: reset }), [status, user, companies, login, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
