import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as endpoints from '../api/endpoints';
import type { ApiEstadoBot } from '../api/types';
import { Icon } from '../components/ui';
import { useApp } from '../state/AppState';

// Sugerencia inicial: la misma URL con la que este panel habla con el backend.
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

const when = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Telegram() {
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
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
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
    </div>
  );
}
