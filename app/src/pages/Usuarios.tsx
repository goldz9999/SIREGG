import { useEffect, useState } from 'react';
import { actualizarUsuario, crearUsuario, empresasUsuario, listUsuarios } from '../api/endpoints';
import { mapMember, toRolEmpresa } from '../api/mappers';
import { Dialog, Icon, Select } from '../components/ui';
import { ROLE_DOCS, ROLES } from '../data/org';
import type { Member, Role } from '../data/types';
import { initials } from '../lib/format';
import { useViewport } from '../hooks/useViewport';
import { useApp } from '../state/AppState';

interface NewMember { name: string; email: string; password: string; role: Role; personal: boolean; empresas: string[] }
interface EditState { m: Member; role: Role; ids: string[]; personal: boolean; telegram: boolean }

export default function Usuarios() {
  const { co, showToast, user, companies } = useApp();
  const { w } = useViewport();
  const [invite, setInvite] = useState<NewMember | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiMembers, setApiMembers] = useState<Member[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const empresaId = Number(co.id);
    listUsuarios(empresaId)
      .then((list) => { if (alive) setApiMembers(list.map((u) => mapMember(u, empresaId, user.id))); })
      .catch((e) => { if (alive) showToast(e instanceof Error ? e.message : 'No se pudieron cargar los miembros.', 'ph-warning-circle'); });
    return () => { alive = false; };
  }, [co.id, tick, user.id, showToast]);

  const myRole = co.role;
  const isOwner = myRole === 'Propietario';
  const canManage = isOwner || myRole === 'Administrador';
  const roleChoices = isOwner ? ROLES : ROLES.slice(1);
  const members: Member[] = apiMembers;

  const orgs = companies.filter((c) => c.kind === 'Empresa');
  const gestionables = orgs.filter((c) => c.role === 'Propietario' || c.role === 'Administrador').map((c) => c.id);

  const openEdit = (m: Member) => {
    setEditing({
      m,
      role: m.role,
      ids: m.empresaIds.map(String).filter((id) => gestionables.includes(id)),
      personal: m.personal,
      telegram: m.telegram,
    });
  };

  const saveEdit = async () => {
    if (!editing || editing.m.id === undefined || busy) return;
    const { m, role, ids, personal, telegram } = editing;
<<<<<<< HEAD
=======
    const memberId = m.id as number;
>>>>>>> 9e9eb3b72ca9104bdf764692bca092365df22da4
    setBusy(true);
    try {
      const body: Parameters<typeof actualizarUsuario>[2] = {};
      if (role !== m.role) body.rol_empresa = toRolEmpresa(role);
      if (personal !== m.personal) body.puede_registrar_personal = personal;
      if (telegram !== m.telegram) body.puede_gestionar_telegram = telegram;

      const patchPromise = Object.keys(body).length
<<<<<<< HEAD
        ? actualizarUsuario(m.id, Number(co.id), body)
=======
        ? actualizarUsuario(memberId, Number(co.id), body)
>>>>>>> 9e9eb3b72ca9104bdf764692bca092365df22da4
        : Promise.resolve();

      const gestionableIds = ids.filter((id) => gestionables.includes(id)).map(Number);
      const orgPromise =
        orgs.length > 1
<<<<<<< HEAD
          ? empresasUsuario(m.id, Number(co.id), gestionableIds)
=======
          ? empresasUsuario(memberId, Number(co.id), gestionableIds)
>>>>>>> 9e9eb3b72ca9104bdf764692bca092365df22da4
          : Promise.resolve();

      await Promise.all([patchPromise, orgPromise]);
      setEditing(null);
      setTick((t) => t + 1);
      showToast('Cambios de ' + m.name + ' guardados.', 'ph-check-circle');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar.', 'ph-warning-circle');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!editing || editing.m.id === undefined || busy) return;
    const { m } = editing;
<<<<<<< HEAD
    const newActive = m.acc !== 'Activa';
    setBusy(true);
    try {
      await actualizarUsuario(m.id, Number(co.id), { activo: newActive });
=======
    const memberId = m.id as number;
    const newActive = m.acc !== 'Activa';
    setBusy(true);
    try {
      await actualizarUsuario(memberId, Number(co.id), { activo: newActive });
>>>>>>> 9e9eb3b72ca9104bdf764692bca092365df22da4
      setEditing(null);
      setTick((t) => t + 1);
      showToast(newActive ? 'Cuenta de ' + m.name + ' reactivada.' : 'Cuenta de ' + m.name + ' desactivada.', 'ph-check-circle');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar el cambio.', 'ph-warning-circle');
    } finally {
      setBusy(false);
    }
  };

  const orgChecks = (selected: string[], onChange: (ids: string[]) => void, fixed: string[] = []) => (
    <div className="stack" style={{ gap: 6 }}>
      {orgs.map((o) => {
        const can = gestionables.includes(o.id);
        const checked = selected.includes(o.id) || fixed.includes(o.id);
        return (
          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: can ? 'pointer' : 'default', opacity: can ? 1 : 0.5 }}
            title={can ? undefined : 'No administras esta organización'}>
            <input className="check" type="checkbox" checked={checked} disabled={!can}
              onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} />
            <span>{o.name}{o.id === co.id ? <span className="muted" style={{ fontSize: 12 }}> (actual)</span> : ''}</span>
          </label>
        );
      })}
    </div>
  );

  const sendInvite = async () => {
    if (!invite || busy) return;
    const name = invite.name.trim();
    const em = invite.email.trim();
    if (!name) { showToast('Ingresa el nombre de la persona.', 'ph-warning-circle'); return; }
    if (!/^\S+@\S+\.\S+$/.test(em)) { showToast('Ingresa un correo válido.', 'ph-warning-circle'); return; }
    if (invite.password.length < 6) { showToast('La contraseña temporal debe tener al menos 6 caracteres.', 'ph-warning-circle'); return; }
    if (members.some((m) => m.email.toLowerCase() === em.toLowerCase())) { showToast('Ese correo ya es miembro.', 'ph-warning-circle'); return; }
    if (!invite.empresas.length) { showToast('Elige al menos una organización.', 'ph-warning-circle'); return; }
    setBusy(true);
    try {
      await crearUsuario(Number(co.id), {
        nombre: name, email: em, password: invite.password, rol_empresa: toRolEmpresa(invite.role),
        ...(isOwner && invite.personal && invite.role !== 'Propietario' ? { puede_registrar_personal: true } : {}),
        empresa_ids: invite.empresas.map(Number),
      });
      setInvite(null);
      setTick((t) => t + 1);
      showToast('Usuario ' + name + ' creado. Comparte la contraseña temporal con la persona.', 'ph-user-plus');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo crear el usuario.', 'ph-warning-circle');
    } finally {
      setBusy(false);
    }
  };

  const narrow = w < 700;

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{members.length} miembro{members.length !== 1 ? 's' : ''} en {co.name}</span>
        <span className="grow" />
        {canManage && (
          <button className="btn btn-primary" onClick={() => setInvite({ name: '', email: '', password: '', role: 'Empleado', personal: false, empresas: [co.id] })}>
            <Icon n="ph-user-plus" /> Agregar miembro
          </button>
        )}
      </div>

      <div className="panel" style={{ padding: '4px 0', gap: 0 }}>
        {members.map((m, i) => {
          const locked = m.me || (m.role === 'Propietario' && !isOwner);
          const editable = canManage && !locked;
          const suspended = m.acc === 'Suspendida';

          return (
            <div
              key={m.email}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '12px 20px',
                boxShadow: i < members.length - 1 ? '0 1px 0 var(--line)' : 'none',
                opacity: suspended ? 0.55 : 1,
                transition: 'opacity 0.2s ease',
              }}
            >
              {/* Avatar */}
              <span
                className="icon-tile"
                style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--color-accent-100)', color: 'var(--color-accent-900)',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                {initials(m.name)}
              </span>

              {/* Name + email */}
              <span className="stack minw0" style={{ flex: 1, gap: 2, lineHeight: 1.3 }}>
                <span style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.name}
                  {m.me && <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>(tú)</span>}
                </span>
                <span className="muted ellipsis" style={{ fontSize: 12.5 }}>{m.email}</span>
              </span>

              {/* Role + status badges — hidden on very narrow */}
              {!narrow && (
                <span className="row wrap" style={{ gap: 6, flexShrink: 0 }}>
                  <RoleBadge role={m.role} />
                  {suspended && <span className="tag tag-accent-2">Suspendida</span>}
                  {m.personal && m.role !== 'Propietario' && <span className="tag tag-outline" style={{ fontSize: 11 }}>Personales</span>}
                </span>
              )}

              {/* Edit button */}
              {editable && (
                <button
                  className="btn btn-ghost"
                  title="Editar miembro"
                  onClick={() => openEdit(m)}
                  style={{ flexShrink: 0, color: 'var(--color-neutral-700)', padding: '6px 8px' }}
                >
                  <Icon n="ph-pencil-simple" style={{ fontSize: 16 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Role reference */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        {ROLE_DOCS.map(([n, d]) => (
          <div key={n} className="stack" style={{ gap: 3 }}>
            <strong style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <RoleBadge role={n as Role} />
            </strong>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.4 }}>{d}</span>
          </div>
        ))}
      </div>

      {/* ── Create modal ── */}
      {invite && (
        <Dialog onClose={() => setInvite(null)}>
          <div className="dialog-title">Agregar a {co.name}</div>
          <div className="field">
            <label htmlFor="inv-name">Nombre</label>
            <input id="inv-name" className="input" autoFocus placeholder="Nombre y apellido" value={invite.name}
              onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="inv-email">Correo electrónico</label>
            <input id="inv-email" className="input" type="email" placeholder="nombre@empresa.pe" value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="inv-pass">Contraseña temporal</label>
            <input id="inv-pass" className="input" type="text" autoComplete="off" placeholder="Mínimo 6 caracteres" value={invite.password}
              onChange={(e) => setInvite({ ...invite, password: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); }} />
          </div>
          <div className="field">
            <label>Rol</label>
            <Select label="Rol" value={invite.role} options={roleChoices.map((v) => ({ v }))} onChange={(v) => setInvite({ ...invite, role: v as Role })} />
          </div>
          {gestionables.length > 1 && (
            <div className="field">
              <label>Organizaciones</label>
              {orgChecks(invite.empresas, (ids) => setInvite({ ...invite, empresas: ids }))}
            </div>
          )}
          {isOwner && invite.role !== 'Propietario' && (
            <label className="pref">
              <input className="check" type="checkbox" checked={invite.personal} onChange={(e) => setInvite({ ...invite, personal: e.target.checked })} />
              <span className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 14 }}>Puede registrar gastos personales</span>
              </span>
            </label>
          )}
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            No se envía ningún correo: comparte la contraseña temporal con la persona.
            {!isOwner && ' Solo el propietario decide quién registra gastos personales.'}
          </p>
          <div className="dialog-actions">
            <button className="btn btn-ghost" onClick={() => setInvite(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={sendInvite} disabled={busy}>{busy ? 'Creando…' : 'Crear usuario'}</button>
          </div>
        </Dialog>
      )}

      {/* ── Edit modal ── */}
      {editing && (
        <Dialog onClose={() => setEditing(null)} width={480}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 'var(--space-3)', boxShadow: '0 1px 0 var(--line)' }}>
            <span
              className="icon-tile"
              style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', fontWeight: 700, fontSize: 15 }}
            >
              {initials(editing.m.name)}
            </span>
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{editing.m.name}</span>
              <span className="muted ellipsis" style={{ fontSize: 13 }}>{editing.m.email}</span>
            </span>
          </div>

          {/* Role */}
          <div className="field" style={{ marginTop: 'var(--space-3)' }}>
            <label>Rol en {co.name}</label>
            {editing.m.role === 'Propietario' && !isOwner ? (
              <span style={{ fontSize: 14 }}>{editing.m.role} <span className="muted">(no puedes cambiar el rol del propietario)</span></span>
            ) : (
              <Select
                label="Rol"
                value={editing.role}
                options={roleChoices.map((v) => ({ v }))}
                onChange={(v) => setEditing({ ...editing, role: v as Role })}
              />
            )}
          </div>

          {/* Organizations */}
          {orgs.length > 1 && editing.m.role !== 'Propietario' && (
            <div className="field">
              <label>Organizaciones con acceso</label>
              {orgChecks(
                editing.ids,
                (ids) => setEditing({ ...editing, ids }),
                editing.m.empresaIds.map(String).filter((id) => !gestionables.includes(id)),
              )}
              <span className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                En las nuevas tendrá el mismo rol que en {co.short}.
                {!isOwner && ' Solo puedes cambiar las organizaciones que administras.'}
              </span>
            </div>
          )}

          {/* Permissions */}
          {isOwner && editing.role !== 'Propietario' && (
            <div className="field">
              <label>Permisos</label>
              <div className="stack" style={{ gap: 2 }}>
                <label className="pref">
                  <input className="check" type="checkbox" checked={editing.personal}
                    onChange={(e) => setEditing({ ...editing, personal: e.target.checked })} />
                  <span className="stack" style={{ gap: 1 }}>
                    <span style={{ fontSize: 14 }}>Puede registrar gastos personales</span>
                    <span className="muted" style={{ fontSize: 12.5 }}>Solo el propietario decide quién tiene este permiso</span>
                  </span>
                </label>
                <label className="pref">
                  <input className="check" type="checkbox" checked={editing.telegram}
                    onChange={(e) => setEditing({ ...editing, telegram: e.target.checked })} />
                  <span className="stack" style={{ gap: 1 }}>
                    <span style={{ fontSize: 14 }}>Gestiona cuentas de Telegram</span>
                    <span className="muted" style={{ fontSize: 12.5 }}>Puede vincular o quitar cuentas del bot</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="dialog-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button
              className="btn btn-ghost"
              onClick={toggleActive}
              disabled={busy}
              style={{ color: editing.m.acc === 'Activa' ? 'var(--color-accent-2-700)' : 'var(--color-neutral-700)' }}
            >
              {editing.m.acc === 'Activa' ? 'Desactivar cuenta' : 'Reactivar cuenta'}
            </button>
            <span className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
            </span>
          </div>
        </Dialog>
      )}
    </div>
  );
}

const ROLE_STYLE: Record<string, { background: string; color: string }> = {
  Propietario:  { background: 'var(--color-accent-100)',  color: 'var(--color-accent-900)' },
  Administrador:{ background: 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' },
  Supervisor:   { background: 'var(--fill-strong)',       color: 'var(--color-neutral-800)' },
  Contador:     { background: 'var(--fill-strong)',       color: 'var(--color-neutral-800)' },
  Empleado:     { background: 'var(--fill)',              color: 'var(--color-neutral-700)' },
};

function RoleBadge({ role }: { role: Role }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE['Empleado'];
  return <span className="tag" style={s}>{role}</span>;
}
