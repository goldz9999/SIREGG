import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, clearToken, getToken, setToken, setUnauthorizedHandler } from '../api/client';
import * as endpoints from '../api/endpoints';
import { initialsOf, mapCompany } from '../api/mappers';
import type { ApiPerfil, ApiUsuario } from '../api/types';
import type { Company } from '../data/types';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  initials: string;
  esSuperAdmin: boolean;
  lastCompanyId: number | null;
  /** Puede registrar gastos personales (el propietario siempre; el resto si el propietario lo permite). */
  canPersonal: boolean;
  /** Puede gestionar las cuentas autorizadas del bot de Telegram. */
  canTelegram: boolean;
  avatarUrl: string | null;
}

interface AuthState {
  status: 'loading' | 'out' | 'in';
  user: SessionUser | null;
  companies: Company[];
  /** Por qué no se pudo restaurar la sesión (servidor caído, etc.). El token se conserva. */
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Vuelve a pedir las empresas (p. ej. tras renombrar una). */
  refresh: () => Promise<void>;
  /** Aplica a la sesión el perfil que devolvió el backend (nombre, correo, foto). */
  applyProfile: (p: ApiPerfil) => void;
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
  return { id: u.id, name, email: u.email || '', initials: initialsOf(name), esSuperAdmin: u.es_super_admin, lastCompanyId: u.ultima_empresa_id, canPersonal: !!u.puede_registrar_personal, canTelegram: !!u.puede_gestionar_telegram, avatarUrl: u.avatar_url ?? null };
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
  const [error, setError] = useState('');
  const apiUser = useRef<ApiUsuario | null>(null);

  const reset = useCallback(() => {
    clearToken(); writeCached(null);
    setUser(null); setCompanies([]); setError(''); setStatus('out');
  }, []);

  const enter = useCallback(async (u: ApiUsuario) => {
    const list = await loadCompanies(u);
    apiUser.current = u;
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
      .catch((e) => {
        // 401: el cliente ya cerró la sesión. Cualquier otro error (servidor caído, 500)
        // NO borra el token: se muestra el motivo y recargar la página reintenta.
        if (e instanceof ApiError && e.status === 401) return;
        setError(e instanceof Error ? e.message : 'No se pudo restaurar la sesión.');
        setStatus('out');
      });
  }, [enter]);

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

  const refresh = useCallback(async () => {
    if (apiUser.current) setCompanies(await loadCompanies(apiUser.current));
  }, []);

  const applyProfile = useCallback((p: ApiPerfil) => {
    if (!apiUser.current) return;
    const u: ApiUsuario = { ...apiUser.current, nombre: p.nombre, email: p.email, avatar_url: p.avatar_url };
    apiUser.current = u;
    writeCached(u);
    setUser(toUser(u));
  }, []);

  const value = useMemo<AuthState>(() => ({ status, user, companies, error, login, logout: reset, refresh, applyProfile }), [status, user, companies, error, login, reset, refresh, applyProfile]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
