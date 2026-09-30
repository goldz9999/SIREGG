import { useState } from 'react';
import * as endpoints from '../api/endpoints';
import { useApp } from '../state/AppState';
import { Dialog, Icon } from './ui';

/** Crea un proyecto o pedido; con `forId`, además asigna ese gasto a él. */
export default function NewProjectDialog({ forId, onClose }: { forId?: string; onClose: () => void }) {
  const { co, reload, showToast } = useApp();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  const create = async () => {
    if (!trimmed || busy) return;
    const presupuesto = budget.trim() ? Number(budget.replace(',', '.')) : undefined;
    if (presupuesto !== undefined && (!Number.isFinite(presupuesto) || presupuesto < 0)) {
      showToast('El presupuesto debe ser un número válido.', 'ph-warning-circle');
      return;
    }
    setBusy(true);
    try {
      const empresaId = Number(co.id);
      const ped = await endpoints.crearPedido(empresaId, { nombre: trimmed, cliente: client.trim() || undefined, presupuesto });
      if (forId) await endpoints.patchGasto(Number(forId), empresaId, { pedido_id: ped.id });
      reload();
      onClose();
      showToast(trimmed + ' creado' + (forId ? ' y asignado al gasto ' + forId : '') + '.', 'ph-folder-plus');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo crear el proyecto.', 'ph-warning-circle');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog onClose={onClose} gap={16}>
      <div className="dialog-title">Nuevo proyecto o pedido</div>
      <div className="field">
        <label htmlFor="np-name">Nombre</label>
        <input id="np-name" className="input" autoFocus placeholder="Ampliación almacén Lurín" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="np-client">Cliente (opcional)</label>
        <input id="np-client" className="input" value={client} onChange={(e) => setClient(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="np-budget">Presupuesto en S/ (opcional)</label>
        <input id="np-budget" className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
      </div>
      {forId && <span style={{ fontSize: 13, color: 'var(--color-neutral-800)' }}><Icon n="ph-link" style={{ color: 'var(--color-accent)' }} /> Se asignará al gasto {forId} al crearlo.</span>}
      <div className="dialog-actions" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!trimmed || busy} onClick={create}>{busy ? 'Creando…' : 'Crear'}</button>
      </div>
    </Dialog>
  );
}
