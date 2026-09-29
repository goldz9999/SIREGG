import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { Icon, Seg } from '../components/ui';
import { useApp } from '../state/AppState';
import { useAuth } from '../state/Auth';

const CAN_RENAME = ['Propietario', 'Administrador'];

export function ConfigEmpresa() {
  const { co, showToast } = useApp();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const canEdit = CAN_RENAME.includes(co.role);
  const [name, setName] = useState(co.name);
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== '' && name.trim() !== co.name;
  const links: [string, string, string][] = [['Categorías', 'ph-tag', 'categorias'], ['Proyectos y pedidos', 'ph-folders', 'proyectos'], ['Miembros', 'ph-users', 'usuarios']];

  const save = async () => {
    if (!changed || busy) return;
    setBusy(true);
    try {
      await endpoints.renombrarEmpresa(Number(co.id), name.trim());
      await refresh();
      showToast('Nombre de la organización actualizado.', 'ph-check-circle');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar el nombre.', 'ph-warning-circle');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Organización</h2>
        <div className="row wrap" style={{ gap: 'var(--space-4)' }}>
          <span className="avatar" style={{ width: 64, height: 64, fontSize: 22, background: co.color }}>{co.initials}</span>
          <div className="stack" style={{ gap: 2 }}>
            <strong>{co.name}</strong>
            <span className="muted" style={{ fontSize: 13 }}>Tu rol: {co.role}</span>
          </div>
        </div>
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="cfg-name">Nombre comercial</label>
          <input id="cfg-name" className="input" value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
          {!canEdit && <span className="muted" style={{ fontSize: 12 }}>Solo el propietario o un administrador puede cambiar el nombre.</span>}
        </div>
        {canEdit && (
          <div><button className="btn btn-primary" onClick={save} disabled={!changed || busy}><Icon n="ph-floppy-disk" /> {busy ? 'Guardando…' : 'Guardar cambios'}</button></div>
        )}
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Espacio de trabajo</h2>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          {links.map(([label, icon, p]) => <button key={p} className="btn btn-ghost" onClick={() => navigate('/' + p)}><Icon n={icon} /> {label}</button>)}
        </div>
      </div>
    </div>
  );
}

export function ConfigPersonal() {
  const { theme, setTheme, user, companies, logout } = useApp();

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Perfil</h2>
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          <span className="icon-tile" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', fontSize: 22, fontWeight: 700 }}>{user.initials}</span>
          <div className="stack">
            <strong>{user.name}</strong>
            <span className="muted" style={{ fontSize: 13 }}>{user.email} · Miembro de {companies.length} {companies.length === 1 ? 'organización' : 'organizaciones'}</span>
          </div>
        </div>
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Apariencia</h2>
        <Seg name="cfg-theme" value={theme} onChange={setTheme}
          options={[{ value: 'light', label: 'Claro', icon: 'ph-sun' }, { value: 'dark', label: 'Oscuro', icon: 'ph-moon' }, { value: 'auto', label: 'Automático', icon: 'ph-desktop' }]} />
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Sesión</h2>
        <div><button className="btn btn-secondary" onClick={logout}><Icon n="ph-sign-out" /> Cerrar sesión</button></div>
      </div>
    </div>
  );
}
