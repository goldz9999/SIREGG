import { useState } from 'react';
import * as endpoints from '../api/endpoints';
import type { ApiCategoria } from '../api/types';
import { Icon } from '../components/ui';
import { money } from '../lib/format';
import { useApp } from '../state/AppState';

const CAN_MANAGE = ['Propietario', 'Administrador', 'Contador'];

export default function Categorias() {
  const { co, expenses, categories, proveedores, reload, showToast } = useApp();
  const [newCat, setNewCat] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = CAN_MANAGE.includes(co.role);
  const live = expenses.filter((e) => e.st !== 'desc');
  const empresaId = Number(co.id);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      reload();
      showToast(ok, 'ph-check-circle');
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo completar la acción.', 'ph-warning-circle');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const n = newCat.trim();
    if (!n) return;
    if (categories.some((c) => c.nombre.toLowerCase() === n.toLowerCase())) {
      showToast('La categoría “' + n + '” ya existe.', 'ph-warning-circle');
      return;
    }
    if (await run(() => endpoints.crearCategoria(empresaId, n), 'Categoría “' + n + '” agregada.')) setNewCat('');
  };

  const rename = async () => {
    if (!editing) return;
    const n = editing.name.trim();
    if (!n) return;
    if (await run(() => endpoints.renombrarCategoria(editing.id, empresaId, n), 'Categoría renombrada.')) setEditing(null);
  };

  const remove = (c: ApiCategoria) => {
    if (!window.confirm('¿Eliminar la categoría “' + c.nombre + '”?')) return;
    run(() => endpoints.eliminarCategoria(c.id, empresaId), 'Categoría “' + c.nombre + '” eliminada.');
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-4)', maxWidth: 900 }}>
      <p style={{ margin: 0, color: 'var(--color-neutral-800)', maxWidth: '62ch' }}>
        La IA usa estas categorías y los proveedores habituales para clasificar cada gasto de {co.name}.
      </p>
      {canManage && (
        <div className="row wrap" style={{ gap: 'var(--space-2)', maxWidth: 520 }}>
          <input className="input" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }} style={{ flex: '1 1 220px', width: 'auto' }} />
          <button className="btn btn-primary" onClick={add} disabled={!newCat.trim() || busy}><Icon n="ph-plus" /> Agregar</button>
        </div>
      )}
      <div className="panel" style={{ gap: 0, padding: '4px 20px' }}>
        {categories.map((c) => {
          const rs = live.filter((e) => e.cat === c.nombre);
          const provs = proveedores.filter((p) => p.categoria_id_sugerida === c.id).map((p) => p.nombre);
          const isEditing = editing?.id === c.id;
          return (
            <div key={c.id} data-a="1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-3) 0', boxShadow: '0 1px 0 var(--line)' }}>
              <div className="stack minw0" style={{ gap: 4 }}>
                {isEditing ? (
                  <input className="input" autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditing(null); }} style={{ maxWidth: 320 }} />
                ) : (
                  <strong style={{ fontSize: 16 }}>{c.nombre}</strong>
                )}
                <span className="muted" style={{ fontSize: 13 }}>{rs.length} gastos · {money(rs.reduce((a, e) => a + e.amt, 0))}</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-800)' }}>
                  <Icon n="ph-sparkle" style={{ color: 'var(--color-accent)' }} /> {provs.length ? 'Sugerida para ' + provs.join(', ') : 'Sin reglas aún: la IA aprenderá de tus correcciones'}
                </span>
              </div>
              {canManage && (
                <span className="row" style={{ gap: 4 }}>
                  {isEditing ? (
                    <>
                      <button className="btn btn-primary" onClick={rename} disabled={busy}>Guardar</button>
                      <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-ghost" onClick={() => setEditing({ id: c.id, name: c.nombre })}>Renombrar</button>
                      <button className="btn btn-ghost" style={{ color: 'var(--color-accent-2-700)' }} onClick={() => remove(c)}>Eliminar</button>
                    </>
                  )}
                </span>
              )}
            </div>
          );
        })}
        {!categories.length && <div className="muted" style={{ padding: 'var(--space-4) 0' }}>Esta organización aún no tiene categorías.</div>}
      </div>
    </div>
  );
}
