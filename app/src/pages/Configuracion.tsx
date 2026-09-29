import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { CoAvatar, Icon, Seg, Select } from '../components/ui';
import type { Moneda } from '../api/types';
import { useApp } from '../state/AppState';
import { useAuth } from '../state/Auth';

const CAN_EDIT = ['Propietario', 'Administrador'];
const MONEDAS: { value: Moneda; label: string }[] = [{ value: 'PEN', label: 'Soles (S/)' }, { value: 'USD', label: 'Dólares (US$)' }];

export function ConfigEmpresa() {
  const { co, showToast } = useApp();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const canEdit = CAN_EDIT.includes(co.role);
  const saved = { name: co.name, ruc: co.ruc, address: co.address, currency: co.currency };
  const [form, setForm] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ruc = form.ruc.trim();
  const rucOk = ruc === '' || /^[0-9]{11}$/.test(ruc);
  const changed = (Object.keys(saved) as (keyof typeof saved)[]).some((k) => form[k].trim() !== saved[k]);
  const canSave = changed && form.name.trim() !== '' && rucOk && !busy;
  const links: [string, string, string][] = [['Categorías', 'ph-tag', 'categorias'], ['Proyectos y pedidos', 'ph-folders', 'proyectos'], ['Miembros', 'ph-users', 'usuarios']];

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await endpoints.actualizarEmpresa(Number(co.id), {
        nombre: form.name.trim(), ruc: ruc || null, direccion: form.address.trim() || null, moneda: form.currency,
      });
      await refresh();
      showToast('Datos de la organización actualizados.', 'ph-check-circle');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudieron guardar los cambios.', 'ph-warning-circle');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { showToast('El logotipo debe ser PNG, JPG o WebP.', 'ph-warning-circle'); return; }
    if (file.size > 3 * 1024 * 1024) { showToast('El logotipo no puede pesar más de 3 MB.', 'ph-warning-circle'); return; }
    setUploading(true);
    try {
      await endpoints.subirLogo(Number(co.id), file);
      await refresh();
      showToast('Logotipo actualizado.', 'ph-check-circle');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo subir el logotipo.', 'ph-warning-circle');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const field = (id: string, label: string, k: 'name' | 'ruc' | 'address', extra: { placeholder?: string; inputMode?: 'numeric'; maxLength?: number; hint?: string; error?: string } = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" value={form[k]} disabled={!canEdit} placeholder={extra.placeholder} inputMode={extra.inputMode} maxLength={extra.maxLength}
        aria-invalid={!!extra.error} onChange={(e) => set(k)(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      {extra.error ? <span style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }}>{extra.error}</span> : extra.hint && <span className="muted" style={{ fontSize: 12 }}>{extra.hint}</span>}
    </div>
  );

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Organización</h2>
        <div className="row wrap" style={{ gap: 'var(--space-4)' }}>
          <CoAvatar co={co} size={64} fontSize={22} />
          <div className="stack" style={{ gap: 2 }}>
            <strong>{co.name}</strong>
            <span className="muted" style={{ fontSize: 13 }}>Tu rol: {co.role}{co.ruc ? ' · RUC ' + co.ruc : ''}</span>
          </div>
          {canEdit && (
            <>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Icon n="ph-upload-simple" /> {uploading ? 'Subiendo…' : co.logoUrl ? 'Cambiar logotipo' : 'Subir logotipo'}
              </button>
            </>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 'var(--space-3) var(--space-4)' }}>
          {field('cfg-name', 'Nombre comercial', 'name')}
          {field('cfg-ruc', 'RUC', 'ruc', { placeholder: '11 dígitos', inputMode: 'numeric', maxLength: 11, error: rucOk ? undefined : 'El RUC debe tener 11 dígitos.' })}
          <div style={{ gridColumn: '1 / -1' }}>{field('cfg-address', 'Dirección fiscal', 'address', { placeholder: 'Av., número, distrito' })}</div>
          <div className="field">
            <label htmlFor="cfg-currency">Moneda</label>
            <Select id="cfg-currency" value={form.currency} disabled={!canEdit} onChange={set('currency')} options={MONEDAS.map((m) => ({ v: m.value, l: m.label }))} />
            <span className="muted" style={{ fontSize: 12 }}>Con la que se muestran los montos de esta organización.</span>
          </div>
        </div>
        {!canEdit && <span className="muted" style={{ fontSize: 12 }}>Solo el propietario o un administrador puede cambiar estos datos.</span>}
        {canEdit && (
          <div><button className="btn btn-primary" onClick={save} disabled={!canSave}><Icon n="ph-floppy-disk" /> {busy ? 'Guardando…' : 'Guardar cambios'}</button></div>
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
  const { theme, setTheme, user, companies: all, logout } = useApp();
  const companies = all.filter((c) => c.kind === 'Empresa');

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
