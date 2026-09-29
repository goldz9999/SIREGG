import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as endpoints from '../api/endpoints';
import { mapRole } from '../api/mappers';
import type { ApiEstadoBot, ApiTelegramUsuario } from '../api/types';
import { Icon } from '../components/ui';
import { initials } from '../lib/format';
import { useApp } from '../state/AppState';

// Sugerencia inicial: la misma URL con la que este panel habla con el backend.
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Telegram() {
  const { co, user } = useApp();
  // El webhook (a qué backend apunta el bot) es solo del propietario; las cuentas
  // autorizadas, del propietario o de quien él autorice.
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
      {(user.canTelegram || co.role === 'Propietario') && <CuentasTelegram key={co.id} />}
      {co.role === 'Propietario' && <ConexionBot />}
    </div>
  );
}

const TG_ID = /^[1-9][0-9]{4,14}$/;

function CuentasTelegram() {
  const { co, user, showToast } = useApp();
  const empresaId = Number(co.id);
  const soyPropietario = co.role === 'Propietario';
  const [rows, setRows] = useState<ApiTelegramUsuario[] | null>(null);
  const [edit, setEdit] = useState<{ id: number; value: string } | null>(null);
  const [nuevo, setNuevo] = useState<{ nombre: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    endpoints.listTelegram(empresaId)
      .then((l) => { if (alive) setRows(l); })
      .catch((e) => { if (alive) { setRows([]); showToast(e instanceof Error ? e.message : 'No se pudieron cargar las cuentas.', 'ph-warning-circle'); } });
    return () => { alive = false; };
  }, [empresaId, tick, showToast]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setEdit(null); setNuevo(null); setTick((t) => t + 1);
      showToast(ok, 'ph-check-circle');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar.', 'ph-warning-circle');
    } finally {
      setBusy(false);
    }
  };

  const guardar = (r: ApiTelegramUsuario) => {
    if (!edit || !TG_ID.test(edit.value.trim()) || busy) return;
    run(() => endpoints.vincularTelegram(r.id, empresaId, Number(edit.value.trim())), 'Telegram de ' + (r.nombre || 'usuario') + ' autorizado.');
  };
  const crear = () => {
    if (!nuevo || !nuevo.nombre.trim() || !TG_ID.test(nuevo.id.trim()) || busy) return;
    run(() => endpoints.crearTelegram(empresaId, nuevo.nombre.trim(), Number(nuevo.id.trim())), nuevo.nombre.trim() + ' ya puede usar el bot.');
  };

  const autorizadas = rows?.filter((r) => r.telegram_id && r.activo).length ?? 0;

  return (
    <div data-a="1" className="panel" style={{ gap: 12 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <h2 className="panel-title-lg">Cuentas autorizadas</h2>
        {!nuevo && <button className="btn btn-secondary" onClick={() => setNuevo({ nombre: '', id: '' })}><Icon n="ph-user-plus" /> Agregar solo Telegram</button>}
      </div>
      <span className="muted" style={{ fontSize: 14 }}>
        El bot solo atiende a estas cuentas{rows ? ' (' + autorizadas + ' en ' + co.short + ')' : ''}. Si alguien no está autorizado, el bot le responde con su ID: cópialo aquí.
      </span>

      {nuevo && (
        <div className="stack" style={{ gap: 10, padding: 14, borderRadius: 12, background: 'var(--fill)', border: '1px solid var(--line)' }}>
          <strong style={{ fontSize: 14 }}>Persona que solo usa el bot (sin acceso al panel)</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 'var(--space-3)' }}>
            <div className="field">
              <label htmlFor="tg-new-name">Nombre</label>
              <input id="tg-new-name" className="input" autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="tg-new-id">ID de Telegram</label>
              <input id="tg-new-id" className="input mono" inputMode="numeric" placeholder="8109597915" value={nuevo.id}
                onChange={(e) => setNuevo({ ...nuevo, id: e.target.value.replace(/\D/g, '') })} onKeyDown={(e) => { if (e.key === 'Enter') crear(); }} />
            </div>
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>Queda como Empleado de {co.name}; el rol se cambia en Usuarios y miembros.</span>
          <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
            <button className="btn btn-primary" onClick={crear} disabled={busy || !nuevo.nombre.trim() || !TG_ID.test(nuevo.id)}><Icon n="ph-check" /> Autorizar</button>
            <button className="btn btn-ghost" onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {rows === null && <span className="muted" style={{ fontSize: 14 }}><Icon n="ph-circle-notch" /> Cargando…</span>}
      <div className="stack" style={{ gap: 0 }}>
        {rows?.map((r) => {
          const nombre = r.nombre || r.email || 'Usuario ' + r.id;
          const bloqueado = r.rol_empresa === 'propietario' && !soyPropietario && r.id !== user.id;
          const editando = edit?.id === r.id;
          return (
            <div key={r.id} className="row wrap" style={{ gap: 'var(--space-3)', padding: 'var(--space-3) 0', boxShadow: '0 1px 0 var(--line)', opacity: r.activo ? 1 : 0.6 }}>
              <span className="icon-tile" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-900)', fontWeight: 700, fontSize: 13 }}>{initials(nombre)}</span>
              <span className="stack grow minw0" style={{ lineHeight: 1.3, flex: '1 1 180px' }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{nombre}{r.id === user.id ? ' (tú)' : ''}</span>
                <span className="muted" style={{ fontSize: 13 }}>{mapRole(r.rol_empresa)}{r.tiene_password ? '' : ' · solo Telegram'}{r.activo ? '' : ' · cuenta desactivada'}</span>
              </span>
              {editando ? (
                <span className="row wrap" style={{ gap: 'var(--space-2)' }}>
                  <input className="input mono" aria-label={'ID de Telegram de ' + nombre} inputMode="numeric" autoFocus placeholder="ID de Telegram" style={{ width: 170 }}
                    value={edit.value} onChange={(e) => setEdit({ id: r.id, value: e.target.value.replace(/\D/g, '') })} onKeyDown={(e) => { if (e.key === 'Enter') guardar(r); if (e.key === 'Escape') setEdit(null); }} />
                  <button className="btn btn-primary" onClick={() => guardar(r)} disabled={busy || !TG_ID.test(edit.value)}>Guardar</button>
                  <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
                </span>
              ) : (
                <span className="row wrap" style={{ gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                  {r.telegram_id
                    ? <span className="tag tag-outline mono" title="ID de Telegram autorizado"><Icon n="ph-telegram-logo" /> {r.telegram_id}</span>
                    : <span className="tag tag-neutral">Sin Telegram</span>}
                  {!bloqueado && (
                    <>
                      <button className="btn btn-ghost" onClick={() => setEdit({ id: r.id, value: r.telegram_id ? String(r.telegram_id) : '' })} disabled={busy}>
                        {r.telegram_id ? 'Cambiar' : 'Autorizar'}
                      </button>
                      {r.telegram_id && (
                        <button className="btn btn-ghost" style={{ color: 'var(--color-accent-2-700)' }} disabled={busy}
                          onClick={() => run(() => endpoints.quitarTelegram(r.id, empresaId), 'El bot ya no atiende a ' + nombre + '.')}>Quitar</button>
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
          );
        })}
        {rows?.length === 0 && <span className="muted" style={{ fontSize: 14 }}>No hay miembros en {co.name}.</span>}
      </div>
    </div>
  );
}

function ConexionBot() {
  const { co, showToast } = useApp();
  const empresaId = Number(co.id);
  const [estado, setEstado] = useState<ApiEstadoBot | null>(null);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'cargar' | 'conectar' | 'desconectar' | null>('cargar');
  const [confirmOff, setConfirmOff] = useState(false);

  const aplicar = useCallback((e: ApiEstadoBot) => {
    setEstado(e);
    setError('');
    setUrl(e.webhook?.base_url || (API_URL.startsWith('https://') ? API_URL : ''));
  }, []);

  const cargar = useCallback(() => {
    setBusy('cargar');
    endpoints.estadoBot(empresaId)
      .then(aplicar)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo consultar el bot.'))
      .finally(() => setBusy(null));
  }, [empresaId, aplicar]);
  useEffect(cargar, [cargar]);

  const base = url.trim().replace(/\/+$/, '');
  const urlOk = /^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(base);
  const destino = urlOk ? base + (estado?.ruta_webhook ?? '/facturas/telegram/webhook') : '';
  const sinCambios = !!estado?.webhook?.url && estado.webhook.url === destino;

  const conectar = async () => {
    if (!urlOk || busy) return;
    setBusy('conectar');
    try {
      aplicar(await endpoints.conectarBot(empresaId, base));
      showToast('Bot conectado a ' + base + '.', 'ph-check-circle');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo conectar el bot.', 'ph-warning-circle');
    } finally {
      setBusy(null);
    }
  };

  const desconectar = async () => {
    setConfirmOff(false);
    setBusy('desconectar');
    try {
      aplicar(await endpoints.desconectarBot(empresaId));
      showToast('Bot desconectado. Los mensajes quedan en cola hasta reconectarlo.', 'ph-plugs');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo desconectar el bot.', 'ph-warning-circle');
    } finally {
      setBusy(null);
    }
  };

  const wh = estado?.webhook;
  const conectado = !!wh?.url;
  const row = (label: string, value: ReactNode) => (
    <div className="row" style={{ justifyContent: 'space-between', gap: 'var(--space-3)', fontSize: 14, padding: '6px 0', boxShadow: '0 1px 0 var(--line)' }}>
      <span className="muted">{label}</span><span style={{ textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );

  return (
    <>
      <div data-a="1" className="panel" style={{ gap: 12 }}>
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <h2 className="panel-title-lg">Estado del bot</h2>
          <button className="btn btn-ghost" onClick={cargar} disabled={!!busy}><Icon n="ph-arrow-clockwise" /> Actualizar</button>
        </div>
        {busy === 'cargar' && !estado && <span className="muted" style={{ fontSize: 14 }}><Icon n="ph-circle-notch" /> Consultando a Telegram…</span>}
        {error && <span role="alert" style={{ fontSize: 14, color: 'var(--color-accent-2-700)' }}><Icon n="ph-warning-circle" /> {error}</span>}
        {estado && !estado.token_configurado && (
          <span style={{ fontSize: 14 }}>El backend no tiene <code>TELEGRAM_BOT_TOKEN</code>. Agrégalo a sus variables de entorno y reinícialo.</span>
        )}
        {estado?.token_configurado && (
          <div className="stack" style={{ gap: 0 }}>
            {row('Bot', estado.bot ? '@' + estado.bot.username + ' · ' + estado.bot.nombre : '—')}
            {row('Estado', <span className={conectado ? 'tag tag-outline' : 'tag tag-accent-2'}>{conectado ? 'Conectado' : 'Sin conectar'}</span>)}
            {row('Recibe mensajes en', wh?.url || '—')}
            {row('Mensajes en cola', String(wh?.pendientes ?? 0))}
            {wh?.ultimo_error && row('Último error', (wh.ultimo_error_en ? when(wh.ultimo_error_en) + ' · ' : '') + wh.ultimo_error)}
          </div>
        )}
        {estado?.token_configurado && !estado.secret_configurado && (
          <span className="muted" style={{ fontSize: 13 }}>
            <Icon n="ph-shield-warning" /> El backend no tiene <code>TELEGRAM_WEBHOOK_SECRET</code>: cualquiera que conozca la URL podría enviarle mensajes falsos. Configúralo y vuelve a conectar.
          </span>
        )}
      </div>

      {estado?.token_configurado && (
        <div data-a="1" className="panel" style={{ gap: 14 }}>
          <h2 className="panel-title-lg">Dirección del backend</h2>
          <span className="muted" style={{ fontSize: 14 }}>Si el backend cambia de dominio, escribe aquí la nueva dirección y conecta el bot otra vez.</span>
          <div className="field" style={{ maxWidth: 520 }}>
            <label htmlFor="tg-url">URL pública del backend</label>
            <input id="tg-url" className="input" inputMode="url" placeholder="https://api.tudominio.com" value={url} aria-invalid={!!url && !urlOk}
              onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') conectar(); }} />
            {url && !urlOk
              ? <span style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }}>Debe empezar con https:// (Telegram no acepta http).</span>
              : destino && <span className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>Telegram enviará los mensajes a {destino}</span>}
          </div>
          <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
            <button className="btn btn-primary" onClick={conectar} disabled={!urlOk || !!busy}>
              <Icon n="ph-plugs-connected" /> {busy === 'conectar' ? 'Conectando…' : sinCambios ? 'Volver a conectar' : 'Conectar bot'}
            </button>
            {conectado && !confirmOff && <button className="btn btn-ghost" onClick={() => setConfirmOff(true)} disabled={!!busy}><Icon n="ph-plugs" /> Desconectar</button>}
            {confirmOff && (
              <span className="row wrap" style={{ gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 14 }}>¿Desconectar? El bot dejará de registrar gastos.</span>
                <button className="btn btn-secondary" style={{ color: 'var(--color-accent-2-700)' }} onClick={desconectar}>Sí, desconectar</button>
                <button className="btn btn-ghost" onClick={() => setConfirmOff(false)}>Cancelar</button>
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
