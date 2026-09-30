import { io, type Socket } from 'socket.io-client';
import { BASE, getToken } from './client';

export interface CambioGasto { empresaId: number; gastoId: number; tipo: 'creado' | 'actualizado' | 'eliminado' }

/**
 * Escucha los avisos del backend (namespace /gastos) cuando se crea, cambia o borra un gasto
 * en alguna de las empresas indicadas. El backend acepta una empresa por conexión, así que se
 * abre un socket por empresa. Devuelve la función que cierra todo.
 */
export function escucharGastos(empresaIds: number[], onCambio: (c: CambioGasto) => void): () => void {
  const token = getToken();
  if (!token) return () => {};
  // Si el backend vive bajo una ruta (p. ej. https://dominio/api), Socket.IO debe usar
  // esa ruta (/api/socket.io); el canal sigue siendo /gastos.
  const { origin, path } = socketDestino(BASE);
  const sockets: Socket[] = empresaIds.map((empresaId) =>
    io(origin + '/gastos', { path, auth: { token, empresa_id: empresaId }, transports: ['websocket', 'polling'] }),
  );
  sockets.forEach((s) => s.on('gasto:cambio', onCambio));
  return () => sockets.forEach((s) => { s.off('gasto:cambio', onCambio); s.disconnect(); });
}

/** Origen y ruta de Socket.IO para una URL base del backend. */
export function socketDestino(base: string): { origin: string; path: string } {
  const u = new URL(base);
  return { origin: u.origin, path: u.pathname.replace(/\/+$/, '') + '/socket.io' };
}
