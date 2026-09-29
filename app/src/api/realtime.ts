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
  const sockets: Socket[] = empresaIds.map((empresaId) =>
    io(BASE + '/gastos', { auth: { token, empresa_id: empresaId }, transports: ['websocket', 'polling'] }),
  );
  sockets.forEach((s) => s.on('gasto:cambio', onCambio));
  return () => sockets.forEach((s) => { s.off('gasto:cambio', onCambio); s.disconnect(); });
}
