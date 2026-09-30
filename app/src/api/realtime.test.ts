import { describe, expect, it } from 'vitest';
import { socketDestino } from './realtime';

describe('socketDestino', () => {
  it('backend en la raíz del dominio', () => {
    expect(socketDestino('http://localhost:3000')).toEqual({ origin: 'http://localhost:3000', path: '/socket.io' });
  });
  it('backend bajo /api (un solo dominio)', () => {
    expect(socketDestino('https://sisreg.sublitex.pe/api')).toEqual({ origin: 'https://sisreg.sublitex.pe', path: '/api/socket.io' });
    expect(socketDestino('https://sisreg.sublitex.pe/api/')).toEqual({ origin: 'https://sisreg.sublitex.pe', path: '/api/socket.io' });
  });
});
