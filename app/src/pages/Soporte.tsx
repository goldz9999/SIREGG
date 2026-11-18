import { useEffect, useState, type FormEvent } from 'react';
import * as endpoints from '../api/endpoints';
import type { ApiTicket, TipoTicket } from '../api/types';
import { Icon, Select } from '../components/ui';
import { ROLE_DOCS } from '../data/org';
import { fd } from '../lib/format';
import { useApp } from '../state/AppState';

const TICKET_TYPES: { v: TipoTicket; l: string }[] = [
  { v: 'error', l: 'Error o falla técnica' },
  { v: 'duda', l: 'Duda sobre el sistema' },
  { v: 'sugerencia', l: 'Sugerencia o mejora' },
];

const LOCAL_TICKETS_KEY = 'siregg_local_tickets';

function getStoredTickets(): ApiTicket[] {
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTicket(t: ApiTicket) {
  try {
    const cur = getStoredTickets();
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify([t, ...cur]));
  } catch {
    /* ignore */
  }
}

export default function Soporte() {
  const { co, user, lastPage, showToast } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Formulario
  const [asunto, setAsunto] = useState('');
  const [tipo, setTipo] = useState<TipoTicket>('error');
  const [descripcion, setDescripcion] = useState('');
  const [adjuntoNombre, setAdjuntoNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<ApiTicket[]>([]);
  const [cargandoTickets, setCargandoTickets] = useState(true);

  const cargarTickets = () => {
    setCargandoTickets(true);
    endpoints
      .listTickets()
      .then((res) => {
        const local = getStoredTickets();
        const merged = [...local.filter((l) => !res.some((r) => r.id === l.id)), ...res];
        setTickets(merged);
      })
      .catch(() => {
        setTickets(getStoredTickets());
      })
      .finally(() => setCargandoTickets(false));
  };

  useEffect(() => {
    cargarTickets();
  }, []);

  const enviarTicket = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!asunto.trim() || !descripcion.trim()) {
      showToast('Por favor completa el asunto y la descripción.', 'ph-warning-circle');
      return;
    }

    setEnviando(true);
    const body = {
      asunto: asunto.trim(),
      tipo,
      descripcion: descripcion.trim(),
      pagina: lastPage,
      empresa_id: co.id === 'personal' ? undefined : Number(co.id),
    };

    try {
      let nuevo: ApiTicket;
      try {
        nuevo = await endpoints.crearTicket(body);
      } catch {
        // Fallback local mientras el backend conecta la tabla soporte_tickets
        nuevo = {
          id: Date.now(),
          empresa_id: body.empresa_id ?? null,
          usuario_id: user.id,
          usuario_nombre: user.name,
          asunto: body.asunto,
          tipo: body.tipo,
          descripcion: body.descripcion,
          pagina: body.pagina,
          estado: 'abierto',
          creado_en: new Date().toISOString(),
        };
      }

      saveLocalTicket(nuevo);
      setTickets((prev) => [nuevo, ...prev]);
      setAsunto('');
      setDescripcion('');
      setAdjuntoNombre('');
      showToast('Tu solicitud fue enviada correctamente.', 'ph-check-circle');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al enviar el ticket.', 'ph-warning-circle');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--space-6)', maxWidth: 1000 }}>
      {/* Encabezado */}
      <div className="stack" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 'clamp(24px,2.6vw,32px)', margin: 0, fontWeight: 700, letterSpacing: '-.025em' }}>
          Centro de ayuda y soporte
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Resuelve dudas comunes, consulta los roles del sistema o envía una solicitud a nuestro equipo.
        </p>
      </div>

      {/* Grid principal: 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 20 }}>
        {/* Columna Izquierda: Formulario + Contacto Directo */}
        <div className="stack" style={{ gap: 20 }}>
          {/* Bloque: Reportar un problema */}
          <section data-a="1" className="panel" style={{ gap: 16 }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span
                className="icon-tile"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--color-accent-100)',
                  color: 'var(--color-accent)',
                }}
              >
                <Icon n="ph-paper-plane-tilt" style={{ fontSize: 18 }} />
              </span>
              <div className="stack" style={{ gap: 1 }}>
                <h2 style={{ fontSize: 17, margin: 0, fontWeight: 600 }}>Reportar un problema o duda</h2>
                <span className="muted" style={{ fontSize: 12.5 }}>Te responderemos a la brevedad posible</span>
              </div>
            </div>

            <form onSubmit={enviarTicket} className="stack" style={{ gap: 14 }}>
              <div className="field">
                <label htmlFor="soporte-tipo">Tipo de solicitud</label>
                <Select
                  id="soporte-tipo"
                  value={tipo}
                  onChange={(v) => setTipo(v as TipoTicket)}
                  options={TICKET_TYPES.map((t) => ({ v: t.v, l: t.l }))}
                />
              </div>

              <div className="field">
                <label htmlFor="soporte-asunto">Asunto breve *</label>
                <input
                  id="soporte-asunto"
                  className="input"
                  placeholder="Ej: No se reconoce el comprobante en dólares"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="field">
                <label htmlFor="soporte-desc">Descripción detallada *</label>
                <textarea
                  id="soporte-desc"
                  className="input"
                  rows={4}
                  placeholder="Explica qué ocurrió, qué intentabas hacer o cuál es tu consulta..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit', minHeight: 90 }}
                />
              </div>

              {/* Adjuntar archivo opcional */}
              <div className="field">
                <label>Captura de pantalla (opcional)</label>
                <div className="row wrap" style={{ gap: 10, alignItems: 'center' }}>
                  <label
                    className="btn btn-secondary"
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon n="ph-paperclip" />
                    <span>{adjuntoNombre ? 'Cambiar captura' : 'Adjuntar archivo'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setAdjuntoNombre(f.name);
                      }}
                    />
                  </label>
                  {adjuntoNombre && (
                    <span className="row" style={{ gap: 6, fontSize: 12.5, color: 'var(--color-accent)' }}>
                      <Icon n="ph-file" /> {adjuntoNombre}
                    </span>
                  )}
                </div>
              </div>

              {/* Datos contextuales auto-adjuntos */}
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--fill)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: 'var(--color-neutral-700)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  border: '1px solid var(--line)',
                }}
              >
                <span>🏢 {co.name}</span>
                <span>👤 {user.name}</span>
                <span>📍 Desde: /{lastPage}</span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={enviando || !asunto.trim() || !descripcion.trim()}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              >
                <Icon n="ph-paper-plane-tilt" /> {enviando ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </form>
          </section>

          {/* Bloque: Contacto directo */}
          <section data-a="1" className="panel" style={{ gap: 14 }}>
            <h2 style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>Contacto directo</h2>
            <div className="stack" style={{ gap: 10, fontSize: 13.5 }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <Icon n="ph-envelope" style={{ fontSize: 18, color: 'var(--color-accent)' }} />
                <span>Correo de soporte:</span>
                <a
                  href="mailto:soporte@siregg.pe"
                  style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}
                >
                  soporte@siregg.pe
                </a>
              </div>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <Icon n="ph-whatsapp-logo" style={{ fontSize: 18, color: '#25D366' }} />
                <span>WhatsApp directo:</span>
                <a
                  href="https://wa.me/51999999999"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}
                >
                  +51 999 999 999
                </a>
              </div>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <Icon n="ph-clock" style={{ fontSize: 18, color: 'var(--color-neutral-600)' }} />
                <span className="muted">Horario de atención: Lunes a Viernes de 8:30 a. m. a 6:30 p. m.</span>
              </div>
            </div>
          </section>
        </div>

        {/* Columna Derecha: Preguntas frecuentes + Mis solicitudes */}
        <div className="stack" style={{ gap: 20 }}>
          {/* Bloque: Preguntas Frecuentes */}
          <section data-a="1" className="panel" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <span
                className="icon-tile"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--color-accent-100)',
                  color: 'var(--color-accent)',
                }}
              >
                <Icon n="ph-question" style={{ fontSize: 18 }} />
              </span>
              <h2 style={{ fontSize: 17, margin: 0, fontWeight: 600 }}>Preguntas frecuentes</h2>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: 'var(--fill)',
                    }}
                  >
                    <button
                      type="button"
                      className="row"
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                    >
                      <span>{item.q}</span>
                      <Icon
                        n={isOpen ? 'ph-caret-up' : 'ph-caret-down'}
                        style={{ fontSize: 16, color: 'var(--color-neutral-600)', flexShrink: 0 }}
                      />
                    </button>
                    {isOpen && (
                      <div
                        style={{
                          padding: '0 14px 14px 14px',
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: 'var(--color-neutral-800)',
                          borderTop: '1px solid var(--line)',
                          paddingTop: 10,
                        }}
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bloque: Mis solicitudes */}
          <section data-a="1" className="panel" style={{ gap: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <span
                  className="icon-tile"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: 'var(--color-accent-100)',
                    color: 'var(--color-accent)',
                  }}
                >
                  <Icon n="ph-ticket" style={{ fontSize: 18 }} />
                </span>
                <h2 style={{ fontSize: 17, margin: 0, fontWeight: 600 }}>Mis solicitudes recientes</h2>
              </div>
              <button className="btn btn-ghost" onClick={cargarTickets} style={{ fontSize: 12 }}>
                <Icon n="ph-arrows-clockwise" /> Refrescar
              </button>
            </div>

            {cargandoTickets ? (
              <span className="muted" style={{ fontSize: 13 }}>Cargando solicitudes…</span>
            ) : tickets.length > 0 ? (
              <div className="stack" style={{ gap: 8 }}>
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="stack"
                    style={{
                      padding: '12px 14px',
                      background: 'var(--fill)',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      gap: 6,
                    }}
                  >
                    <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{t.asunto}</strong>
                      <span
                        className={
                          t.estado === 'resuelto'
                            ? 'tag tag-accent'
                            : t.estado === 'en_proceso'
                            ? 'tag tag-accent-2'
                            : 'tag tag-neutral'
                        }
                        style={{ textTransform: 'capitalize', fontSize: 11 }}
                      >
                        {t.estado === 'en_proceso' ? 'En proceso' : t.estado}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-800)' }}>
                      {t.descripcion}
                    </p>
                    {t.respuesta && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: '8px 12px',
                          background: 'var(--color-raised)',
                          borderRadius: 8,
                          borderLeft: '3px solid var(--color-accent)',
                          fontSize: 12.5,
                        }}
                      >
                        <strong>Respuesta del equipo:</strong> {t.respuesta}
                      </div>
                    )}
                    <div className="row muted" style={{ fontSize: 11.5, gap: 12, marginTop: 2 }}>
                      <span>Fecha: {fd(new Date(t.creado_en))}</span>
                      <span>Tipo: {t.tipo}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                No tienes solicitudes enviadas aún.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Datos de preguntas frecuentes (reutilizando documentación de roles de data/org.ts)
const FAQ_ITEMS = [
  {
    q: '¿Cómo registro un gasto a través de Telegram?',
    a: (
      <span>
        Envía al bot de Telegram una foto de tu factura o boleta, una captura de Yape/Plin, un mensaje de audio o escribe
        el gasto en texto (ejemplo: <em>"Pasaje S/ 4, Halls S/ 1.50, Almuerzo S/ 11"</em>). La inteligencia artificial
        extraerá automáticamente los productos, montos y proveedores.
      </span>
    ),
  },
  {
    q: '¿Cómo vinculo mi cuenta de Telegram?',
    a: (
      <span>
        Inicia conversación con el bot de SIREGG en Telegram. Si eres propietario o administrador, ve a la sección{' '}
        <strong>Bot de Telegram</strong> en el menú lateral para autorizar o vincular los IDs de los miembros de tu equipo.
      </span>
    ),
  },
  {
    q: '¿Qué es un posible duplicado y qué debo hacer?',
    a: (
      <span>
        El sistema detecta automáticamente cuando una imagen o comprobante ya ha sido enviado previamente o si coincide
        en fecha, monto y proveedor con otro gasto. En la bandeja de <strong>Revisión IA</strong> podrás comparar ambos y
        elegir si conservarlos o descartar el duplicado.
      </span>
    ),
  },
  {
    q: '¿Qué permisos y funciones tiene cada rol?',
    a: (
      <div className="stack" style={{ gap: 6, marginTop: 4 }}>
        {ROLE_DOCS.map(([r, desc]) => (
          <div key={r}>
            <strong>{r}:</strong> {desc}
          </div>
        ))}
      </div>
    ),
  },
  {
    q: '¿Cómo funciona la conversión de dólares (USD)?',
    a: (
      <span>
        Si tu empresa está configurada en soles y registras una factura o pago en dólares, el sistema toma la tasa oficial
        del día (SUNAT) y convierte el monto automáticamente, manteniendo registro de la moneda y monto original.
      </span>
    ),
  },
];
