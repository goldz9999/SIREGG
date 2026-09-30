export const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN_KEY = 'siregg-token';

let memToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  if (memToken) return memToken;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string) {
  memToken = t;
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* solo en memoria */ }
}
export function clearToken() {
  memToken = null;
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* nada que limpiar */ }
}
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

type Query = Record<string, string | number | boolean | undefined>;
interface Options { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown; query?: Query }

async function messageOf(res: Response, fallback: string): Promise<string> {
  try {
    const m = (await res.json())?.message;
    return Array.isArray(m) ? m.join(', ') : typeof m === 'string' ? m : fallback;
  } catch {
    return fallback;
  }
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  const isForm = opts.body instanceof FormData;
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers,
      body: isForm ? (opts.body as FormData) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }

  if (res.status === 401) {
    const msg = await messageOf(res, 'Sesión expirada');
    clearToken();
    onUnauthorized?.();
    throw new ApiError(401, msg);
  }
  if (!res.ok) throw new ApiError(res.status, await messageOf(res, 'Error ' + res.status));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
