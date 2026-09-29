import { useState } from 'react';
import { Dialog, Icon, Select } from '../components/ui';
import { getMembers, ROLE_DOCS, ROLES } from '../data/org';
import type { Member, Role } from '../data/types';
import { initials } from '../lib/format';
import { useViewport } from '../hooks/useViewport';
import { useApp } from '../state/AppState';

export default function Usuarios() {
  const { co, edits, setEdits, showToast } = useApp();
  const { w } = useViewport();
  const [invite, setInvite] = useState<{ email: string; role: Role } | null>(null);

  const myRole = co.role;
  const isOwner = myRole === 'Propietario';
  const canManage = isOwner || myRole === 'Administrador';
  // Only an owner can grant or change the owner role.
  const roleChoices = isOwner ? ROLES : ROLES.slice(1);
  const members: Member[] = [...getMembers(co.id), ...(edits.invited[co.id] || [])]
    .map((m) => ({ ...m, ...(edits.members[co.id + '|' + m.email] || {}) }));
  const setM = (m: Member, p: Partial<Member>) => setEdits((s) => {
    const k = co.id + '|' + m.email;
    return { ...s, members: { ...s.members, [k]: { ...(s.members[k] || {}), ...p } } };
  });

  const narrow = w < 1200;
  const cols = narrow ? '40px minmax(0,1fr)' : '40px minmax(0,1fr) 190px 170px 130px';
  const cellCol = narrow ? '2' : 'auto';

  const sendInvite = () => {
    if (!invite) return;
    const em = invite.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { showToast('Ingresa un correo válido.', 'ph-warning-circle'); return; }
    if (members.some((m) => m.email === em)) { showToast('Ese correo ya es miembro.', 'ph-warning-circle'); return; }
    const role = invite.role;
    setEdits((s) => ({ ...s, invited: { ...s.invited, [co.id]: [...(s.invited[co.id] || []), { name: em.split('@')[0], email: em, role, inv: 'Pendiente', acc: '—' }] } }));
    setInvite(null);
    showToast('Invitación a ' + em + ' creada (demostración, no se envió correo).', 'ph-paper-plane-tilt');
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>{members.length} miembros en {co.name}</span>
        <span className="grow" />
        {canManage && <button className="btn btn-primary" onClick={() => setInvite({ email: '', role: 'Empleado' })}><Icon n="ph-user-plus" /> Invitar miembro</button>}
      </div>
      <div className="panel" style={{ gap: 0, padding: '4px 20px' }}>
        {members.map((m) => {
          const locked = m.me || (m.role === 'Propietario' && !isOwner);
          const editable = canManage && !locked;
          const actions: { label: string; color?: string; run: () => void }[] = [];
          if (editable) {
            if (m.inv !== 'Aceptada') actions.push({ label: 'Reenviar', run: () => { setM(m, { inv: 'Pendiente' }); showToast('Invitación reenviada a ' + m.email + ' (demostración).', 'ph-paper-plane-tilt'); } });
            else if (m.acc === 'Activa') actions.push({ label: 'Suspender', color: 'var(--color-accent-2-700)', run: () => { setM(m, { acc: 'Suspendida' }); showToast(m.name + ' suspendido en ' + co.short + ' (demostración).', 'ph-prohibit'); } });
            else actions.push({ label: 'Reactivar', run: () => { setM(m, { acc: 'Activa' }); showToast(m.name + ' reactivado (demostración).', 'ph-check-circle'); } });
          }
          const invCls = m.inv === 'Aceptada' ? 'tag tag-outline' : m.inv === 'Pendiente' ? 'tag tag-accent' : 'tag tag-accent-2';
          const accCls = m.acc === 'Activa' ? 'tag tag-outline' : m.acc === 'Suspendida' ? 'tag tag-accent-2' : 'tag tag-neutral';
          return (
            <div key={m.email} data-a="1" style={{ display: 'grid', gridTemplateColumns: cols, gap: 'var(--space-3)', alignItems: 'center', padding: 'var(--space-3) 0', boxShadow: '0 1px 0 var(--line)', opacity: m.acc === 'Suspendida' ? 0.6 : 1 }}>
              <span className="icon-tile" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', fontWeight: 700, fontSize: 14 }}>{initials(m.name)}</span>
              <span className="stack minw0" style={{ lineHeight: 1.3 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}{m.me ? ' (tú)' : ''}</span>
                <span className="muted" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>
              </span>
              <span className="row wrap" style={{ gap: 'var(--space-2)', gridColumn: cellCol }}>
                <span className={invCls}>{m.inv}</span>
                <span className={accCls}>{m.acc === '—' ? 'Sin cuenta' : m.acc}</span>
              </span>
              {editable ? (
                <Select label="Rol" value={m.role} options={roleChoices.map((v) => ({ v }))} style={{ gridColumn: cellCol }}
                  onChange={(v) => { setM(m, { role: v as Role }); showToast('Rol de ' + m.name + ' cambiado a ' + v + ' (demostración).', 'ph-user-switch'); }} />
              ) : <span style={{ fontSize: 14, gridColumn: cellCol }}>{m.role}</span>}
              <span className="row" style={{ gap: 'var(--space-1)', justifyContent: 'flex-end', gridColumn: cellCol }}>
                {actions.map((a) => <button key={a.label} className="btn btn-ghost" style={{ color: a.color }} onClick={a.run}>{a.label}</button>)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        {ROLE_DOCS.map(([n, d]) => (
          <div key={n} className="stack" style={{ gap: 4 }}><strong style={{ fontSize: 15 }}>{n}</strong><span style={{ fontSize: 14, color: 'var(--color-neutral-800)' }}>{d}</span></div>
        ))}
      </div>

      {invite && (
        <Dialog onClose={() => setInvite(null)}>
          <div className="dialog-title">Invitar a {co.name}</div>
          <div className="field">
            <label htmlFor="inv-email">Correo electrónico</label>
            <input id="inv-email" className="input" type="email" autoFocus placeholder="nombre@empresa.pe" value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); }} />
          </div>
          <div className="field">
            <label>Rol</label>
            <Select label="Rol" value={invite.role} options={roleChoices.map((v) => ({ v }))} onChange={(v) => setInvite({ ...invite, role: v as Role })} />
          </div>
          <span className="muted" style={{ fontSize: 13 }}>Demostración: no se enviará ningún correo.</span>
          <div className="dialog-actions">
            <button className="btn btn-ghost" onClick={() => setInvite(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={sendInvite}>Enviar invitación</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
