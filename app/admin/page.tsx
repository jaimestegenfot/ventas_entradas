'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Marca } from '../../componentes/EstructuraSitio';
import { Icono } from '../../componentes/Icono';
import { EditorEvento } from '../../componentes/EditorEvento';
import { consultarApi } from '../../lib/cliente';
import { MILISEGUNDOS_ACTUALIZACION_PANEL } from '../../lib/configuracion';
import {
  formatearFecha,
  formatearDinero,
  type InformacionEvento,
  type InformacionPedido,
} from '../../lib/tipos';
type SeccionPanel = 'overview' | 'events' | 'orders' | 'queue' | 'checkin';
type DatosPanel = {
  events: InformacionEvento[];
  orders: InformacionPedido[];
  metrics: {
    events: number;
    published: number;
    confirmed: number;
    revenue: number;
    waiting: number;
    admitted: number;
    activeHolds: number;
  };
  queues: { eventId: string; waiting: number; admitted: number }[];
};
const seccionesPanel: { id: SeccionPanel; name: string; icon: string }[] = [
  { id: 'overview', name: 'Vista general', icon: 'grid' },
  { id: 'events', name: 'Mis eventos', icon: 'calendar' },
  { id: 'orders', name: 'Pedidos', icon: 'ticket' },
  { id: 'queue', name: 'Colas de acceso', icon: 'people' },
  { id: 'checkin', name: 'Validar entrada', icon: 'qr' },
];
const titulosPorSeccion: Record<SeccionPanel, [string, string]> = {
  overview: [
    'Todo listo para el próximo plan.',
    'Tus eventos, tus entradas y tu público, en un solo lugar.',
  ],
  events: [
    'Tus ideas, en la cartelera.',
    'Crea eventos, ajusta su aforo y gestiona la disponibilidad.',
  ],
  orders: ['Cada entrada cuenta.', 'Consulta los últimos 100 pedidos y exporta sus detalles.'],
  queue: [
    'Un turno para cada persona.',
    'Controla el acceso y acompaña a tu público en tiempo real.',
  ],
  checkin: ['Que empiece el momento.', 'Valida cada entrada una sola vez en el acceso al evento.'],
};
export default function PaginaAdministracion() {
  const [autenticado, establecerAutenticado] = useState<boolean | null>(null);
  const [contrasena, establecerContrasena] = useState('');
  const [procesando, establecerProcesando] = useState(false);
  const [error, establecerError] = useState('');
  const [datos, establecerDatos] = useState<DatosPanel | null>(null);
  const [seccionActiva, establecerSeccionActiva] = useState<SeccionPanel>('overview');
  const [eventoEnEdicion, establecerEventoEnEdicion] = useState<
    InformacionEvento | null | undefined
  >(undefined);
  const [busqueda, establecerBusqueda] = useState('');
  const [filtroEstado, establecerFiltroEstado] = useState('all');
  const [aviso, establecerAviso] = useState('');
  const [codigo, establecerCodigo] = useState('');
  const [validacionEntrada, establecerValidacionEntrada] = useState<{
    ok: boolean;
    message: string;
    detail?: string;
  } | null>(null);
  const cargarDatos = useCallback(async () => {
    try {
      const respuesta = await consultarApi<DatosPanel>('/api/metrics');
      establecerDatos(respuesta);
      establecerError('');
    } catch (errorCapturado) {
      const mensaje = (errorCapturado as Error).message;
      if (mensaje.includes('Inicia sesión')) establecerAutenticado(false);
      else establecerError(mensaje);
    }
  }, []);
  useEffect(() => {
    void consultarApi<{ authenticated: boolean }>('/api/admin/session')
      .then((respuesta) => establecerAutenticado(respuesta.authenticated))
      .catch((errorCapturado) => {
        establecerError(errorCapturado.message);
        establecerAutenticado(false);
      });
  }, []);
  useEffect(() => {
    if (!autenticado) return;
    void cargarDatos();
    const intervalo = setInterval(() => void cargarDatos(), MILISEGUNDOS_ACTUALIZACION_PANEL);
    return () => clearInterval(intervalo);
  }, [autenticado, cargarDatos]);
  async function iniciarSesion(eventoInterfaz: React.FormEvent) {
    eventoInterfaz.preventDefault();
    establecerProcesando(true);
    establecerError('');
    try {
      await consultarApi('/api/admin/session', 'POST', { password: contrasena });
      establecerAutenticado(true);
      establecerContrasena('');
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerProcesando(false);
    }
  }
  async function cerrarSesion() {
    try {
      await consultarApi('/api/admin/session', 'DELETE');
      establecerAutenticado(false);
      establecerDatos(null);
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    }
  }
  async function validarEntrada(eventoInterfaz: React.FormEvent) {
    eventoInterfaz.preventDefault();
    establecerProcesando(true);
    establecerValidacionEntrada(null);
    try {
      const respuesta = await consultarApi<{ code: string; order: InformacionPedido }>(
        '/api/admin/check-in',
        'POST',
        { code: codigo },
      );
      establecerValidacionEntrada({
        ok: true,
        message: 'Entrada válida. ¡Bienvenido al plan!',
        detail: `${respuesta.order.customerName} · ${respuesta.order.eventTitle} · ${respuesta.order.tierName}`,
      });
      establecerCodigo('');
      await cargarDatos();
    } catch (errorCapturado) {
      establecerValidacionEntrada({ ok: false, message: (errorCapturado as Error).message });
    } finally {
      establecerProcesando(false);
    }
  }
  function cambiarSeccion(nuevaSeccion: SeccionPanel) {
    establecerSeccionActiva(nuevaSeccion);
    establecerBusqueda('');
    establecerFiltroEstado('all');
    establecerAviso('');
  }
  function exportarPedidos() {
    const escaparCeldaCsv = (valor: unknown) => {
      let textoCelda = String(valor ?? '');
      if (/^[=+@\-\t\r]/.test(textoCelda)) textoCelda = `'${textoCelda}`;
      return `"${textoCelda.replace(/"/g, '""')}"`;
    };
    const contenidoCsv =
      '\uFEFF' +
      [
        [
          'Pedido',
          'Evento',
          'Nombre',
          'Correo',
          'Zona',
          'Cantidad',
          'Total PEN',
          'Estado',
          'Fecha',
        ],
        ...(datos?.orders || []).map((pedido) => [
          pedido.id,
          pedido.eventTitle,
          pedido.customerName,
          pedido.customerEmail,
          pedido.tierName,
          pedido.quantity,
          (pedido.totalCents / 100).toFixed(2),
          pedido.status,
          pedido.createdAt,
        ]),
      ]
        .map((fila) => fila.map(escaparCeldaCsv).join(','))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' }));
    const enlaceDescarga = document.createElement('a');
    enlaceDescarga.href = url;
    enlaceDescarga.download = 'entrada-pedidos.csv';
    enlaceDescarga.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const eventos = (datos?.events || []).filter(
    (evento) =>
      (filtroEstado === 'all' || evento.status === filtroEstado) &&
      `${evento.title} ${evento.city}`.toLowerCase().includes(busqueda.toLowerCase()),
  );
  const pedidos = (datos?.orders || []).filter(
    (pedido) =>
      (filtroEstado === 'all' || pedido.status === filtroEstado) &&
      `${pedido.eventTitle} ${pedido.id} ${pedido.customerName} ${pedido.customerEmail}`
        .toLowerCase()
        .includes(busqueda.toLowerCase()),
  );
  function mostrarTablaEventos(eventosTabla: InformacionEvento[]) {
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Entradas vendidas</th>
              <th>Desde</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {eventosTabla.map((evento) => (
              <tr key={evento.id}>
                <td>
                  <div className="table-event">
                    <img src={evento.image} alt="" />
                    <div>
                      <b>{evento.title}</b>
                      <small>
                        {evento.city} · {evento.category}
                      </small>
                    </div>
                  </div>
                </td>
                <td>{formatearFecha(evento.startsAt, true)}</td>
                <td>
                  <span className={`status-badge status-${evento.status}`}>
                    {evento.status === 'published' ? 'Publicado' : 'Borrador'}
                  </span>
                </td>
                <td>
                  <div className="stock-progress">
                    <span>
                      {evento.sold} / {evento.capacity}
                    </span>
                    <div>
                      <i
                        style={{
                          width: `${Math.min(100, (evento.sold / evento.capacity) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td>{formatearDinero(evento.priceCents)}</td>
                <td>
                  <button
                    className="table-action"
                    aria-label={`Editar ${evento.title}`}
                    onClick={() => establecerEventoEnEdicion(evento)}
                  >
                    <Icono nombre="edit" tamano={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!eventosTabla.length && (
          <p className="table-empty">Todavía no hay eventos que coincidan.</p>
        )}
      </div>
    );
  }
  if (autenticado === null)
    return (
      <div className="admin-login">
        <div className="login-form-wrap">
          <span className="spinner" />
          <p className="muted">Preparando tu panel…</p>
        </div>
      </div>
    );
  if (!autenticado)
    return (
      <main className="admin-login">
        <section className="login-story">
          <Marca />
          <div>
            <span className="eyebrow">EL DETRÁS DE CADA GRAN MOMENTO</span>
            <h1>
              Ellos ponen las ganas.
              <br />
              Tú haces que suceda.
            </h1>
            <p>Crea tu próximo evento, conecta con tu público y deja que el plan tome vida.</p>
          </div>
          <small>Una idea. Un escenario. Muchas historias.</small>
        </section>
        <section className="login-form-wrap">
          <form onSubmit={iniciarSesion}>
            <span className="eyebrow">ESPACIO DE ORGANIZADORES</span>
            <h2>Qué bueno tenerte aquí.</h2>
            <p>Ingresa con tu contraseña para gestionar eventos y acompañar cada compra.</p>
            <label className="field">
              Contraseña de administrador
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                value={contrasena}
                onChange={(eventoInterfaz) => establecerContrasena(eventoInterfaz.target.value)}
                placeholder="Tu contraseña"
              />
            </label>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <button className="button button-primary full" type="submit" disabled={procesando}>
              {procesando ? 'Entrando…' : 'Entrar a mi panel'}
              <Icono nombre="arrow" tamano={18} />
            </button>
            <p className="fine-print">
              <Icono nombre="lock" tamano={13} />
              Acceso exclusivo para organizadores.
            </p>
          </form>
          <Link href="/" className="back-link">
            <Icono nombre="arrow" tamano={15} />
            Volver a descubrir eventos
          </Link>
        </section>
      </main>
    );
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Marca />
        <span className="sidebar-label">TU ESPACIO</span>
        <nav aria-label="Panel del organizador">
          {seccionesPanel.map((seccion) => (
            <button
              key={seccion.id}
              className={seccionActiva === seccion.id ? 'active' : ''}
              onClick={() => cambiarSeccion(seccion.id)}
            >
              <Icono nombre={seccion.icon} tamano={19} />
              {seccion.name}
            </button>
          ))}
        </nav>
        <div className="sidebar-demo">
          <b>
            <Icono nombre="sparkle" tamano={14} />
            Todo empieza con una idea.
          </b>
          <p>Esta es una demostración. Los pedidos no realizan cobros reales.</p>
        </div>
        <div className="sidebar-bottom">
          <Link href="/">
            <Icono nombre="external" tamano={16} />
            Ver mi cartelera
          </Link>
          <button onClick={() => void cerrarSesion()}>
            <Icono nombre="logout" tamano={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            Organizador
            <Icono nombre="chevron" tamano={12} />
            <b>{seccionesPanel.find((seccion) => seccion.id === seccionActiva)?.name}</b>
          </div>
          <div className="admin-user">
            <span>OR</span>
            <div>
              <b>Mi organización</b>
              <small>Administrador</small>
            </div>
            <button
              className="refresh-button"
              onClick={() => void cerrarSesion()}
              aria-label="Cerrar sesión"
            >
              <Icono nombre="logout" tamano={14} />
            </button>
          </div>
        </header>
        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <h1>{titulosPorSeccion[seccionActiva][0]}</h1>
              <p>{titulosPorSeccion[seccionActiva][1]}</p>
            </div>
            {seccionActiva !== 'checkin' && (
              <button
                className="button button-primary"
                onClick={() => establecerEventoEnEdicion(null)}
              >
                <Icono nombre="plus" tamano={17} />
                Crear evento
              </button>
            )}
          </div>
          {error && (
            <div className="notice error admin-notice" role="alert">
              {error}
              <button className="text-button" onClick={() => void cargarDatos()}>
                Reintentar
              </button>
            </div>
          )}
          {aviso && (
            <div className="notice success admin-notice" role="status">
              <Icono nombre="check" />
              {aviso}
              <button
                className="text-button"
                onClick={() => establecerAviso('')}
                aria-label="Cerrar aviso"
              >
                <Icono nombre="x" tamano={16} />
              </button>
            </div>
          )}
          {!datos ? (
            <div className="empty-state">
              <span className="spinner" />
              <p>Cargando tus eventos…</p>
            </div>
          ) : (
            <>
              {seccionActiva === 'overview' && (
                <>
                  <div className="admin-metrics">
                    {[
                      {
                        label: 'Ventas de prueba',
                        value: formatearDinero(datos.metrics.revenue),
                        small: 'Total de pedidos confirmados',
                        icon: 'chart',
                      },
                      {
                        label: 'Entradas confirmadas',
                        value: datos.metrics.confirmed,
                        small: 'Un código único para cada entrada',
                        icon: 'ticket',
                      },
                      {
                        label: 'Eventos publicados',
                        value: datos.metrics.published,
                        small: `${datos.metrics.events} eventos en tu organización`,
                        icon: 'calendar',
                      },
                      {
                        label: 'Personas en espera',
                        value: datos.metrics.waiting,
                        small: `${datos.metrics.admitted + datos.metrics.activeHolds} personas comprando ahora`,
                        icon: 'people',
                      },
                    ].map((metrica) => (
                      <div className="metric-card" key={metrica.label}>
                        <div>
                          <span>{metrica.label}</span>
                          <Icono nombre={metrica.icon} tamano={19} />
                        </div>
                        <strong>{metrica.value}</strong>
                        <small>{metrica.small}</small>
                      </div>
                    ))}
                  </div>
                  <section className="admin-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Tus próximos eventos</h2>
                        <p>El próximo gran momento está cada vez más cerca.</p>
                      </div>
                      <button className="text-button" onClick={() => cambiarSeccion('events')}>
                        Ver todos
                        <Icono nombre="arrow" tamano={14} />
                      </button>
                    </div>
                    {mostrarTablaEventos(datos.events.slice(0, 4))}
                  </section>
                  <div className="dashboard-bottom">
                    <section className="admin-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Tu público, en tiempo real</h2>
                          <p>Una cola ordenada. Una mejor experiencia.</p>
                        </div>
                        <Icono nombre="people" tamano={21} estilo={{ color: '#b196c6' }} />
                      </div>
                      <div className="queue-summary">
                        <div>
                          <strong>{datos.metrics.waiting}</strong>
                          <span>En la cola</span>
                        </div>
                        <div>
                          <strong>{datos.metrics.admitted}</strong>
                          <span>Eligiendo entradas</span>
                        </div>
                        <div>
                          <strong>{datos.metrics.activeHolds}</strong>
                          <span>Reservas activas</span>
                        </div>
                      </div>
                      <p className="queue-explanation">
                        Los turnos avanzan automáticamente por orden de llegada. Las entradas sin
                        confirmar vuelven a estar disponibles al vencer la reserva.
                      </p>
                    </section>
                    <div className="admin-promo">
                      <span className="promo-star">✳</span>
                      <span className="eyebrow">HAY UN PÚBLICO ESPERANDO</span>
                      <h3>Tu próxima gran idea merece un escenario.</h3>
                      <p>Deja los detalles listos y comparte un nuevo plan con tu comunidad.</p>
                      <button
                        className="text-button"
                        onClick={() => establecerEventoEnEdicion(null)}
                      >
                        Crear un nuevo evento
                        <Icono nombre="arrow" tamano={15} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {seccionActiva === 'events' && (
                <>
                  <div className="admin-toolbar">
                    <label className="search-input">
                      <Icono nombre="search" tamano={17} />
                      <input
                        type="search"
                        placeholder="Buscar por evento o ciudad…"
                        aria-label="Buscar mis eventos"
                        value={busqueda}
                        onChange={(eventoInterfaz) =>
                          establecerBusqueda(eventoInterfaz.target.value)
                        }
                      />
                    </label>
                    <select
                      aria-label="Filtrar estado de eventos"
                      value={filtroEstado}
                      onChange={(eventoInterfaz) =>
                        establecerFiltroEstado(eventoInterfaz.target.value)
                      }
                    >
                      <option value="all">Todos los estados</option>
                      <option value="published">Publicados</option>
                      <option value="draft">Borradores</option>
                    </select>
                  </div>
                  <section className="admin-panel">{mostrarTablaEventos(eventos)}</section>
                </>
              )}
              {seccionActiva === 'orders' && (
                <>
                  <div className="admin-toolbar">
                    <label className="search-input">
                      <Icono nombre="search" tamano={17} />
                      <input
                        type="search"
                        aria-label="Buscar pedidos"
                        placeholder="Evento, comprador o pedido…"
                        value={busqueda}
                        onChange={(eventoInterfaz) =>
                          establecerBusqueda(eventoInterfaz.target.value)
                        }
                      />
                    </label>
                    <select
                      aria-label="Filtrar estado de pedidos"
                      value={filtroEstado}
                      onChange={(eventoInterfaz) =>
                        establecerFiltroEstado(eventoInterfaz.target.value)
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="confirmed">Confirmados</option>
                      <option value="held">Reservados</option>
                      <option value="expired">Vencidos</option>
                      <option value="cancelled">Cancelados</option>
                    </select>
                    <button className="button button-outline" onClick={exportarPedidos}>
                      <Icono nombre="download" tamano={15} />
                      Exportar CSV
                    </button>
                  </div>
                  <section className="admin-panel">
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Pedido / comprador</th>
                            <th>Evento</th>
                            <th>Entradas</th>
                            <th>Total</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pedidos.map((pedido) => (
                            <tr key={pedido.id}>
                              <td>
                                <div className="table-event">
                                  <div>
                                    <b>
                                      {pedido.customerName ||
                                        `#${pedido.id.slice(0, 8).toUpperCase()}`}
                                    </b>
                                    <small>
                                      {pedido.customerEmail || 'Pendiente de confirmar'}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>{pedido.eventTitle}</td>
                              <td>
                                {pedido.quantity} · {pedido.tierName}
                              </td>
                              <td>{formatearDinero(pedido.totalCents)}</td>
                              <td>
                                <span className={`status-badge status-${pedido.status}`}>
                                  {
                                    {
                                      confirmed: 'Confirmado',
                                      held: 'Reservado',
                                      expired: 'Vencido',
                                      cancelled: 'Cancelado',
                                    }[pedido.status]
                                  }
                                </span>
                              </td>
                              <td>{formatearFecha(pedido.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!pedidos.length && (
                        <p className="table-empty">
                          Los pedidos aparecerán aquí cuando tu público elija sus entradas.
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}
              {seccionActiva === 'queue' && (
                <section className="admin-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Accesos por evento</h2>
                      <p>Actualización automática cada 10 segundos.</p>
                    </div>
                    <button
                      className="refresh-button"
                      onClick={() => void cargarDatos()}
                      aria-label="Actualizar colas"
                    >
                      <Icono nombre="refresh" tamano={16} />
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Evento</th>
                          <th>En espera</th>
                          <th>Eligiendo entradas</th>
                          <th>Límite simultáneo</th>
                          <th>Disponibles</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {datos.events
                          .filter((evento) => evento.status === 'published')
                          .map((evento) => {
                            const resumenCola = datos.queues?.find(
                              (resumenCola) => resumenCola.eventId === evento.id,
                            );
                            return (
                              <tr key={evento.id}>
                                <td>
                                  <div className="table-event">
                                    <img src={evento.image} alt="" />
                                    <div>
                                      <b>{evento.title}</b>
                                      <small>{evento.city}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>{resumenCola?.waiting || 0}</td>
                                <td>{resumenCola?.admitted || 0}</td>
                                <td>{evento.queueSlots} persona</td>
                                <td>{evento.available}</td>
                                <td>
                                  <button
                                    className="table-action"
                                    aria-label={`Configurar cola de ${evento.title}`}
                                    onClick={() => establecerEventoEnEdicion(evento)}
                                  >
                                    <Icono nombre="edit" tamano={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <p className="queue-table-info">
                    Cada persona dispone de 5 minutos para elegir sus entradas y 10 minutos para
                    confirmar su reserva. Los turnos de quienes abandonan la cola se liberan tras 2
                    minutos sin conexión.
                  </p>
                </section>
              )}
              {seccionActiva === 'checkin' && (
                <section className="checkin-panel">
                  <div className="checkin-icon">
                    <Icono nombre="qr" tamano={30} />
                  </div>
                  <span className="eyebrow">BIENVENIDOS AL PLAN</span>
                  <h2>Una entrada. Un solo acceso.</h2>
                  <p>
                    Lee el QR con tu lector y pega el código, o escribe el código ENT que aparece en
                    la entrada. Al validar, quedará marcado como utilizado.
                  </p>
                  <form onSubmit={validarEntrada}>
                    <label className="field">
                      Código de la entrada
                      <input
                        autoComplete="off"
                        name="code"
                        value={codigo}
                        onChange={(eventoInterfaz) => establecerCodigo(eventoInterfaz.target.value)}
                        placeholder="ENT-XXXXXXXXXXXXXXXX"
                        required
                        maxLength={100}
                      />
                    </label>
                    <button
                      className="button button-primary full"
                      type="submit"
                      disabled={procesando}
                    >
                      {procesando ? 'Validando…' : 'Validar y registrar acceso'}
                      <Icono nombre="check" tamano={18} />
                    </button>
                  </form>
                  {validacionEntrada && (
                    <div
                      className={`notice ${validacionEntrada.ok ? 'success' : 'error'} checkin-result`}
                      role="status"
                    >
                      <Icono nombre={validacionEntrada.ok ? 'check' : 'x'} />
                      <div>
                        <b>{validacionEntrada.message}</b>
                        {validacionEntrada.detail && <span>{validacionEntrada.detail}</span>}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
      {eventoEnEdicion !== undefined && (
        <EditorEvento
          evento={eventoEnEdicion}
          alCerrar={() => establecerEventoEnEdicion(undefined)}
          alGuardar={() => {
            establecerEventoEnEdicion(undefined);
            establecerAviso(
              eventoEnEdicion
                ? 'Los cambios de tu evento están guardados.'
                : 'Tu nuevo evento ya está creado.',
            );
            void cargarDatos();
          }}
        />
      )}
    </main>
  );
}
