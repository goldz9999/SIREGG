import { useNavigate } from 'react-router-dom';
import { DemoSave, Icon, Pref, Seg } from '../components/ui';
import { ORG_INFO } from '../data/org';
import { useApp } from '../state/AppState';

const COMPANY_PREFS: [string, string, string][] = [
  ['auto', 'Clasificar como empresarial si el comprobante tiene RUC', 'La IA marca el gasto como empresarial automáticamente.'],
  ['confirm', 'Pedir confirmación para montos mayores a S/ 1,000', 'Los gastos grandes quedan pendientes de revisión.'],
  ['dup', 'Detectar posibles duplicados', 'Compara proveedor, monto, fecha y medio de pago.'],
  ['learn', 'Aprender de las correcciones', 'Las correcciones del equipo mejoran las sugerencias.'],
];

const MY_PREFS: [string, string, string][] = [
  ['dup', 'Posibles duplicados', 'Aviso inmediato cuando la IA detecta un duplicado.'],
  ['rev', 'Gastos pendientes de revisión', 'Resumen diario de lo que falta revisar.'],
  ['week', 'Resumen semanal por correo', 'Totales de la semana por organización.'],
  ['inv', 'Invitaciones y cambios de rol', 'Cuando te agregan o cambian de rol en una organización.'],
];

const saveDemo = (toast: (t: string, i?: string) => void) => () => toast('Cambios aplicados solo en esta demostración.', 'ph-check-circle');

export function ConfigEmpresa() {
  const { co, edits, setEdits, showToast } = useApp();
  const navigate = useNavigate();
  const isOwner = co.role === 'Propietario';
  const [ruc, addr] = ORG_INFO[co.id] || ['', ''];
  const cf: Record<string, string> = { name: co.name, ruc, addr, cur: 'Soles (PEN)', ...(edits.companyCfg[co.id] || {}) };
  const setC = (k: string) => (v: string) => setEdits((s) => ({ ...s, companyCfg: { ...s.companyCfg, [co.id]: { ...(s.companyCfg[co.id] || {}), [k]: v } } }));
  const pr: Record<string, boolean> = { auto: true, confirm: true, dup: true, learn: true, ...(edits.companyPrefs[co.id] || {}) };
  const toggle = (k: string) => setEdits((s) => ({ ...s, companyPrefs: { ...s.companyPrefs, [co.id]: { ...pr, [k]: !pr[k] } } }));

  // Legal data (RUC, fiscal address) is owner-only.
  const fields = [
    { k: 'name', l: 'Nombre comercial', dis: false },
    { k: 'ruc', l: 'RUC', dis: !isOwner, note: isOwner ? '' : 'Solo el propietario puede cambiar datos legales.' },
    { k: 'addr', l: 'Dirección fiscal', dis: !isOwner },
    { k: 'cur', l: 'Moneda principal', dis: true, note: 'Otras monedas no están disponibles en esta versión.' },
  ];
  const links: [string, string, string][] = [['Categorías', 'ph-tag', 'categorias'], ['Proyectos y pedidos', 'ph-folders', 'proyectos'], ['Miembros', 'ph-users', 'usuarios']];

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Organización</h2>
        <div className="row wrap" style={{ gap: 'var(--space-4)' }}>
          <span className="avatar" style={{ width: 64, height: 64, fontSize: 22, background: co.color }}>{co.initials}</span>
          <button className="btn btn-secondary" onClick={() => showToast('Carga de logotipo: demostración, no se sube ningún archivo.', 'ph-image')}><Icon n="ph-image" /> Cambiar logotipo</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'var(--space-3)' }}>
          {fields.map((f) => (
            <div key={f.k} className="field">
              <label htmlFor={'cfg-' + f.k}>{f.l}</label>
              <input id={'cfg-' + f.k} className="input" value={cf[f.k]} disabled={f.dis} onChange={(e) => setC(f.k)(e.target.value)} />
              {f.note && <span className="muted" style={{ fontSize: 12 }}>{f.note}</span>}
            </div>
          ))}
        </div>
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Preferencias de clasificación</h2>
        {COMPANY_PREFS.map(([k, l, d]) => <Pref key={k} on={pr[k]} label={l} desc={d} onToggle={() => toggle(k)} />)}
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Espacio de trabajo</h2>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          {links.map(([label, icon, p]) => <button key={p} className="btn btn-ghost" onClick={() => navigate('/' + p)}><Icon n={icon} /> {label}</button>)}
        </div>
      </div>
      <DemoSave onSave={saveDemo(showToast)} />
    </div>
  );
}

export function ConfigPersonal() {
  const { theme, setTheme, edits, setEdits, showToast, user, companies } = useApp();
  const mp: Record<string, boolean> = { dup: true, rev: true, week: false, inv: true, ...edits.myPrefs };
  const toggle = (k: string) => setEdits((s) => ({ ...s, myPrefs: { ...mp, [k]: !mp[k] } }));
  const account: [string, string, string, string?][] = [
    ['Cambiar contraseña', 'ph-key', 'Cambio de contraseña: demostración.'],
    ['Cerrar sesión en todos los dispositivos', 'ph-devices', 'Sesiones cerradas: demostración.'],
    ['Eliminar cuenta', 'ph-trash', 'Eliminar cuenta: demostración, no se elimina nada.', 'var(--color-accent-2-700)'],
  ];

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Perfil</h2>
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          <span className="icon-tile" style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', fontSize: 22, fontWeight: 700 }}>{user.initials}</span>
          <div className="stack"><strong>{user.name}</strong><span className="muted" style={{ fontSize: 13 }}>Miembro de {companies.length} {companies.length === 1 ? 'organización' : 'organizaciones'}</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 'var(--space-3)' }}>
          <div className="field"><label htmlFor="me-name">Nombre</label><input id="me-name" className="input" defaultValue={user.name} /></div>
          <div className="field"><label htmlFor="me-email">Correo electrónico</label><input id="me-email" className="input" defaultValue={user.email} /></div>
        </div>
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Preferencias visuales</h2>
        <Seg name="theme-me" value={theme} onChange={setTheme} style={{ alignSelf: 'flex-start' }} optStyle={{ padding: '8px 16px' }}
          options={[{ value: 'light', label: 'Claro', icon: 'ph-sun' }, { value: 'dark', label: 'Oscuro', icon: 'ph-moon' }, { value: 'auto', label: 'Auto', icon: 'ph-desktop' }]} />
        <span className="muted" style={{ fontSize: 13 }}>Automático sigue la configuración de tu sistema operativo. Se aplica en todas las organizaciones.</span>
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Notificaciones</h2>
        {MY_PREFS.map(([k, l, d]) => <Pref key={k} on={mp[k]} label={l} desc={d} onToggle={() => toggle(k)} />)}
      </div>
      <div data-a="1" className="panel" style={{ gap: 14 }}>
        <h2 className="panel-title-lg">Cuenta</h2>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          {account.map(([label, icon, t, color]) => (
            <button key={label} className="btn btn-secondary" style={{ color }} onClick={() => showToast(t, icon)}><Icon n={icon} /> {label}</button>
          ))}
        </div>
      </div>
      <DemoSave onSave={saveDemo(showToast)} />
    </div>
  );
}
