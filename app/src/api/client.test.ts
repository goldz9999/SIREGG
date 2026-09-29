import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, clearToken, getToken, setToken, setUnauthorizedHandler } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => { clearToken(); setUnauthorizedHandler(null); });
afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('agrega Authorization y omite parámetros undefined', async () => {
    setToken('abc');
    const f = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', f);
    await api('/gastos', { query: { empresa_id: 3, limite: 50, desde: undefined } });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3000/gastos?empresa_id=3&limite=50');
    expect(init.headers.Authorization).toBe('Bearer abc');
  });

  it('serializa el body como JSON', async () => {
    const f = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal('fetch', f);
    await api('/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } });
    const [, init] = f.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"email":"a","password":"b"}');
  });

  it('401 limpia el token, avisa y lanza ApiError', async () => {
    setToken('abc');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { message: 'Credenciales inválidas' })));
    await expect(api('/gastos')).rejects.toMatchObject({ status: 401, message: 'Credenciales inválidas' });
    expect(getToken()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('une los mensajes de validación de Nest (array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { message: ['monto debe ser número', 'fecha inválida'] })));
    await expect(api('/gastos/1', { method: 'PATCH', body: {} })).rejects.toMatchObject({
      status: 400,
      message: 'monto debe ser número, fecha inválida',
    });
  });

  it('backend caído: ApiError legible con status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = (await api('/gastos').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toBe('No se pudo conectar con el servidor.');
  });
});
