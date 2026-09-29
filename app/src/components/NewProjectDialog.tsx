import { useState } from 'react';
import { useApp } from '../state/AppState';
import { useProjects } from '../state/projects';
import { Dialog, Icon, Seg } from './ui';

type Kind = 'Proyecto' | 'Pedido';

/** Creates a project or order; with `forId`, also assigns that expense to it. */
export default function NewProjectDialog({ forId, onClose }: { forId?: string; onClose: () => void }) {
  const { patchExpense, showToast } = useApp();
  const projects = useProjects();
  const [kind, setKind] = useState<Kind>('Proyecto');
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const create = () => {
    if (!trimmed) return;
    const full = kind === 'Pedido' && !/^pedido/i.test(trimmed) ? 'Pedido — ' + trimmed : trimmed;
    projects.add(full);
    if (forId) patchExpense(forId, { proj: full });
    onClose();
    showToast(full + ' creado' + (forId ? ' y asignado a ' + forId : '') + ' (demostración).', 'ph-folder-plus');
  };

  return (
    <Dialog onClose={onClose} gap={16}>
      <div className="dialog-title">Nuevo proyecto o pedido</div>
      <Seg name="npkind" value={kind} onChange={setKind} style={{ alignSelf: 'flex-start' }} optStyle={{ padding: '7px 16px' }}
        options={[{ value: 'Proyecto', label: 'Proyecto', icon: 'ph-folder' }, { value: 'Pedido', label: 'Pedido', icon: 'ph-package' }]} />
      <div className="field">
        <label htmlFor="np-name">{kind === 'Pedido' ? 'Cliente o número de pedido' : 'Nombre del proyecto'}</label>
        <input id="np-name" className="input" autoFocus placeholder={kind === 'Pedido' ? '#1043 — Cliente Sur' : 'Ampliación almacén Lurín'}
          value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
      </div>
      {forId && <span style={{ fontSize: 13, color: 'var(--color-neutral-800)' }}><Icon n="ph-link" style={{ color: 'var(--color-accent)' }} /> Se asignará a {forId} al crearlo.</span>}
      <span className="muted" style={{ fontSize: 13 }}>Demostración: no se guarda en ningún servidor.</span>
      <div className="dialog-actions" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!trimmed} onClick={create}>Crear</button>
      </div>
    </Dialog>
  );
}
