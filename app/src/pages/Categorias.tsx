import { useState } from 'react';
import { Icon } from '../components/ui';
import { baseCategories, vendorsForCategory } from '../data/expenses';
import { money } from '../lib/format';
import { useApp } from '../state/AppState';

export default function Categorias() {
  const { co, expenses, edits, setEdits, showToast } = useApp();
  const [newCat, setNewCat] = useState('');
  const base = baseCategories(co.id);
  const extra = edits.categories[co.id] || [];
  const live = expenses.filter((e) => e.st !== 'desc');

  const add = () => {
    const n = newCat.trim();
    if (!n) return;
    if ([...base, ...extra].some((c) => c.toLowerCase() === n.toLowerCase())) {
      showToast('La categoría “' + n + '” ya existe.', 'ph-warning-circle');
      return;
    }
    setNewCat('');
    setEdits((s) => ({ ...s, categories: { ...s.categories, [co.id]: [...(s.categories[co.id] || []), n] } }));
    showToast('Categoría “' + n + '” agregada (demostración).', 'ph-check-circle');
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-4)', maxWidth: 900 }}>
      <p style={{ margin: 0, color: 'var(--color-neutral-800)', maxWidth: '62ch' }}>
        La IA usa estas categorías y los proveedores habituales para clasificar cada gasto de {co.name}. Las inactivas no se sugieren.
      </p>
      <div className="row wrap" style={{ gap: 'var(--space-2)', maxWidth: 520 }}>
        <input className="input" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} style={{ flex: '1 1 220px', width: 'auto' }} />
        <button className="btn btn-primary" onClick={add} disabled={!newCat.trim()}><Icon n="ph-plus" /> Agregar</button>
      </div>
      <div className="panel" style={{ gap: 0, padding: '4px 20px' }}>
        {[...base, ...extra].map((name) => {
          const rs = live.filter((e) => e.cat === name);
          const provs = vendorsForCategory(co.id, name);
          const k = co.id + '|' + name;
          const off = !!edits.categoriesOff[k];
          return (
            <div key={name} data-a="1" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-3) 0', boxShadow: '0 1px 0 var(--line)', opacity: off ? 0.5 : 1 }}>
              <div className="stack minw0" style={{ gap: 4 }}>
                <span className="row wrap" style={{ gap: 'var(--space-2)' }}>
                  <strong style={{ fontSize: 16 }}>{name}</strong>
                  {extra.includes(name) && <span className="tag tag-accent">Nueva · demo</span>}
                </span>
                <span className="muted" style={{ fontSize: 13 }}>{rs.length} gastos · {money(rs.reduce((a, e) => a + e.amt, 0))}</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-800)' }}>
                  <Icon n="ph-sparkle" style={{ color: 'var(--color-accent)' }} /> {provs.length ? 'Sugerida para ' + provs.join(', ') : 'Sin reglas aún: la IA aprenderá de tus correcciones'}
                </span>
              </div>
              <label className="row" style={{ gap: 'var(--space-2)', fontSize: 14, cursor: 'pointer', minHeight: 44 }}>
                <input type="checkbox" className="check" checked={!off}
                  onChange={() => setEdits((s) => ({ ...s, categoriesOff: { ...s.categoriesOff, [k]: !off } }))} />
                <span>Activa</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
