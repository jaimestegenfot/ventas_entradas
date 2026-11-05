'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { consultarApi } from '../lib/cliente';
import {
  formatearFecha,
  formatearDinero,
  formatearHora,
  type InformacionEvento,
  type InformacionPedido,
  type EstadoCola,
} from '../lib/tipos';
import { Icono } from './Icono';
import { VentanaModal } from './VentanaModal';
import { MILISEGUNDOS_CONSULTA_COLA, MAXIMO_ENTRADAS_POR_COMPRA } from '../lib/configuracion';
export const claveCompraActiva = 'entrada-active-purchase';
type EtapaCompra = 'details' | 'loading' | 'waiting' | 'select' | 'checkout' | 'done' | 'expired';
export function ProcesoCompra({
  evento,
  alCerrar,
  alActualizar,
}: {
  evento: InformacionEvento;
  alCerrar: () => void;
  alActualizar: () => void;
}) {
  const [etapa, establecerEtapa] = useState<EtapaCompra>('details');
  const [turno, establecerTurno] = useState<EstadoCola | null>(null);
  const [pedido, establecerPedido] = useState<InformacionPedido | null>(null);
  const [idZona, establecerIdZona] = useState(
    evento.tiers.find((zona) => zona.available > 0)?.id || evento.tiers[0]?.id || '',
  );
  const [cantidad, establecerCantidad] = useState(1);
  const [procesando, establecerProcesando] = useState(false);
  const [error, establecerError] = useState('');
  const [horaActual, establecerHoraActual] = useState(Date.now());
  const claveSolicitud = useRef<string | null>(null);
  const zonaSeleccionada = evento.tiers.find((zona) => zona.id === idZona);
  const fechaVencimiento = pedido?.expiresAt || turno?.expiresAt;
  const segundosRestantes = fechaVencimiento
    ? Math.max(0, Math.ceil((new Date(fechaVencimiento).getTime() - horaActual) / 1000))
    : 0;
  const tiempoRestante = `${Math.floor(segundosRestantes / 60)
    .toString()
    .padStart(2, '0')}:${(segundosRestantes % 60).toString().padStart(2, '0')}`;
  function guardarCompraActiva(turno: EstadoCola | null, pedido?: InformacionPedido) {
    localStorage.setItem(
      claveCompraActiva,
      JSON.stringify({ eventId: evento.id, ticketId: turno?.ticketId, orderId: pedido?.id }),
    );
  }
  useEffect(() => {
    let cancelado = false;
    async function recuperarCompra() {
      let compraGuardada;
      try {
        compraGuardada = JSON.parse(localStorage.getItem(claveCompraActiva) || 'null');
      } catch {
        localStorage.removeItem(claveCompraActiva);
        return;
      }
      if (compraGuardada?.eventId !== evento.id) return;
      establecerEtapa('loading');
      try {
        if (compraGuardada.orderId) {
          const resultado = await consultarApi<{ orders: InformacionPedido[] }>('/api/orders');
          const pedido = resultado.orders.find((pedido) => pedido.id === compraGuardada.orderId);
          if (cancelado) return;
          if (pedido) {
            establecerPedido(pedido);
            establecerEtapa(pedido.status === 'confirmed' ? 'done' : 'checkout');
            return;
          }
          establecerEtapa('expired');
          return;
        }
        if (compraGuardada.ticketId) {
          const turno = await consultarApi<EstadoCola>(
            `/api/queue?ticketId=${compraGuardada.ticketId}`,
          );
          if (cancelado) return;
          establecerTurno(turno);
          establecerEtapa(
            turno.status === 'admitted'
              ? 'select'
              : turno.status === 'waiting'
                ? 'waiting'
                : 'expired',
          );
        } else establecerEtapa('details');
      } catch (errorCapturado) {
        if (!cancelado) {
          establecerError((errorCapturado as Error).message);
          establecerEtapa('expired');
        }
      }
    }
    void recuperarCompra();
    const intervalo = setInterval(() => establecerHoraActual(Date.now()), 1000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [evento.id]);
  useEffect(() => {
    if (!turno || !['waiting', 'select'].includes(etapa)) return;
    let detenido = false;
    const intervalo = setInterval(async () => {
      try {
        const turnoActualizado = await consultarApi<EstadoCola>(
          `/api/queue?ticketId=${turno.ticketId}`,
        );
        if (detenido) return;
        establecerTurno(turnoActualizado);
        if (turnoActualizado.status === 'admitted') establecerEtapa('select');
        if (['expired', 'cancelled', 'used'].includes(turnoActualizado.status))
          establecerEtapa('expired');
      } catch (errorCapturado) {
        if (!detenido) establecerError((errorCapturado as Error).message);
      }
    }, MILISEGUNDOS_CONSULTA_COLA);
    return () => {
      detenido = true;
      clearInterval(intervalo);
    };
  }, [turno?.ticketId, etapa]);
  useEffect(() => {
    if (etapa === 'checkout' && fechaVencimiento && segundosRestantes === 0) {
      establecerEtapa('expired');
      alActualizar();
    }
  }, [segundosRestantes, etapa, fechaVencimiento]);
  async function entrarEnCola() {
    establecerProcesando(true);
    establecerError('');
    try {
      const turno = await consultarApi<EstadoCola>('/api/queue', 'POST', { eventId: evento.id });
      establecerTurno(turno);
      establecerPedido(null);
      guardarCompraActiva(turno);
      establecerEtapa(turno.status === 'admitted' ? 'select' : 'waiting');
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerProcesando(false);
    }
  }
  async function reservarEntradas() {
    establecerProcesando(true);
    establecerError('');
    try {
      claveSolicitud.current ||= crypto.randomUUID();
      const { order: pedido } = await consultarApi<{ order: InformacionPedido }>(
        '/api/reserve',
        'POST',
        {
          eventId: evento.id,
          ticketId: turno?.ticketId,
          tierId: idZona,
          quantity: cantidad,
          requestKey: claveSolicitud.current,
        },
      );
      establecerPedido(pedido);
      guardarCompraActiva(turno, pedido);
      establecerEtapa(
        pedido.status === 'confirmed' ? 'done' : pedido.status === 'held' ? 'checkout' : 'expired',
      );
      alActualizar();
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
      alActualizar();
    } finally {
      establecerProcesando(false);
    }
  }
  async function confirmarCompra(eventoInterfaz: React.FormEvent<HTMLFormElement>) {
    eventoInterfaz.preventDefault();
    establecerProcesando(true);
    establecerError('');
    const formulario = new FormData(eventoInterfaz.currentTarget);
    try {
      const { order: pedidoConfirmado } = await consultarApi<{ order: InformacionPedido }>(
        '/api/pay',
        'POST',
        {
          reservationId: pedido?.id,
          name: formulario.get('name'),
          email: formulario.get('email'),
          acceptedTerms: formulario.get('terms') === 'on',
        },
      );
      establecerPedido(pedidoConfirmado);
      establecerEtapa('done');
      localStorage.removeItem(claveCompraActiva);
      alActualizar();
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerProcesando(false);
    }
  }
  async function cancelarCompra() {
    establecerProcesando(true);
    establecerError('');
    try {
      if (pedido?.status === 'held') await consultarApi('/api/orders', 'DELETE', { id: pedido.id });
      else if (turno) await consultarApi('/api/queue', 'DELETE', { ticketId: turno.ticketId });
      localStorage.removeItem(claveCompraActiva);
      alActualizar();
      alCerrar();
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerProcesando(false);
    }
  }
  return (
    <VentanaModal
      titulo={`Entradas para ${evento.title}`}
      alCerrar={() => {
        if (!procesando) alCerrar();
      }}
      ancho={etapa === 'details'}
    >
      {etapa === 'details' ? (
        <div className="event-detail">
          <div className="detail-cover">
            <img src={evento.image} alt={evento.title} />
            <span className="image-chip">{evento.category}</span>
            <div>
              <span className="eyebrow light">TU PRÓXIMO GRAN MOMENTO</span>
              <h2>{evento.title}</h2>
              <p>{evento.subtitle}</p>
            </div>
          </div>
          <div className="detail-content">
            <span className="eyebrow">EL PLAN</span>
            <h2>Esto hay que vivirlo.</h2>
            <div className="event-meta">
              <p>
                <Icono nombre="calendar" />
                <span>
                  {formatearFecha(evento.startsAt, true)} · {formatearHora(evento.startsAt)}
                </span>
              </p>
              <p>
                <Icono nombre="pin" />
                <span>
                  {evento.venue}, {evento.city}
                </span>
              </p>
            </div>
            <p className="description">{evento.description}</p>
            <div className="detail-pricing">
              <span>
                Entradas desde<strong>{formatearDinero(evento.priceCents)}</strong>
              </span>
              <span className="stock">
                <i />
                {evento.available} disponibles
              </span>
            </div>
            <button
              className="button button-primary full"
              onClick={() => void entrarEnCola()}
              disabled={
                procesando ||
                evento.available === 0 ||
                new Date(evento.startsAt).getTime() <= Date.now()
              }
            >
              {procesando
                ? 'Buscando tu lugar…'
                : evento.available
                  ? 'Entrar a la cola'
                  : 'Entradas agotadas'}
              <Icono nombre="arrow" />
            </button>
            <p className="fine-print">
              <Icono nombre="shield" tamano={14} />
              Acceso por orden de llegada. Sin cobros en esta demo.
            </p>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="purchase-modal">
          <div className="purchase-heading">
            <span className="eyebrow">
              {evento.category} · {evento.city}
            </span>
            <h2>{evento.title}</h2>
            <p>
              {formatearFecha(evento.startsAt, true)} · {formatearHora(evento.startsAt)}
            </p>
          </div>
          <div className="purchase-steps">
            {['Tu turno', 'Tus entradas', 'Confirmación'].map((nombrePaso, indice) => (
              <span
                className={
                  (etapa === 'waiting' ? 0 : etapa === 'select' ? 1 : 2) >= indice ? 'active' : ''
                }
                key={nombrePaso}
              >
                <b>{indice + 1}</b>
                {nombrePaso}
              </span>
            ))}
          </div>
          {etapa === 'loading' && (
            <div className="purchase-state">
              <span className="spinner" />
              <h3>Recuperando tu compra…</h3>
            </div>
          )}
          {etapa === 'waiting' && (
            <div className="purchase-state">
              <div className="state-icon queue-pulse">
                <Icono nombre="people" tamano={32} />
              </div>
              <span className="eyebrow">YA TIENES UN LUGAR</span>
              <h3>Lo bueno merece la espera.</h3>
              <p>Avanzamos por orden de llegada. Tu turno se actualiza automáticamente.</p>
              <div className="queue-position">
                <span>PERSONAS DELANTE DE TI</span>
                <strong>{turno?.ahead ?? '…'}</strong>
                <span className="live-indicator">
                  <i />
                  Cola en tiempo real
                </span>
              </div>
              <div className="notice">
                <Icono nombre="info" />
                Mantén esta página abierta. Si recargas, recuperaremos tu lugar.
              </div>
              <button
                className="text-button muted"
                onClick={() => void cancelarCompra()}
                disabled={procesando}
              >
                Salir de la cola
              </button>
            </div>
          )}
          {etapa === 'select' && (
            <div className="purchase-body">
              <div className="notice success">
                <Icono nombre="check" />
                <div>
                  <b>¡Es tu turno!</b>
                  <span>Tienes {tiempoRestante} para elegir tus entradas.</span>
                </div>
              </div>
              <h3>Elige cómo quieres vivirlo</h3>
              <div className="tier-options">
                {evento.tiers.map((zona) => (
                  <label
                    className={`tier-option ${idZona === zona.id ? 'selected' : ''}`}
                    key={zona.id}
                  >
                    <input
                      type="radio"
                      name="tier"
                      checked={idZona === zona.id}
                      onChange={() => {
                        establecerIdZona(zona.id);
                        establecerCantidad(1);
                        claveSolicitud.current = null;
                      }}
                      disabled={!zona.available}
                    />
                    <div>
                      <b>{zona.name}</b>
                      <small>
                        {zona.available > 0
                          ? `${zona.available} entradas disponibles`
                          : 'Zona agotada'}
                      </small>
                    </div>
                    <strong>{formatearDinero(zona.priceCents)}</strong>
                  </label>
                ))}
              </div>
              <div className="quantity-row">
                <div>
                  <b>Cantidad de entradas</b>
                  <small>Máximo 6 por compra</small>
                </div>
                <div className="quantity-control">
                  <button
                    aria-label="Quitar una entrada"
                    disabled={cantidad <= 1}
                    onClick={() => {
                      establecerCantidad((cantidadActual) => cantidadActual - 1);
                      claveSolicitud.current = null;
                    }}
                  >
                    <Icono nombre="minus" tamano={16} />
                  </button>
                  <b>{cantidad}</b>
                  <button
                    aria-label="Añadir una entrada"
                    disabled={
                      cantidad >=
                      Math.min(MAXIMO_ENTRADAS_POR_COMPRA, zonaSeleccionada?.available || 0)
                    }
                    onClick={() => {
                      establecerCantidad((cantidadActual) => cantidadActual + 1);
                      claveSolicitud.current = null;
                    }}
                  >
                    <Icono nombre="plus" tamano={16} />
                  </button>
                </div>
              </div>
              <div className="purchase-total">
                <span>
                  Total<span>Sin cargos adicionales</span>
                </span>
                <strong>{formatearDinero((zonaSeleccionada?.priceCents || 0) * cantidad)}</strong>
              </div>
              <button
                className="button button-primary full"
                onClick={() => void reservarEntradas()}
                disabled={procesando || !zonaSeleccionada?.available || segundosRestantes === 0}
              >
                {procesando ? 'Reservando tus entradas…' : 'Continuar con mi compra'}
                <Icono nombre="arrow" />
              </button>
              <button
                className="text-button muted"
                onClick={() => void cancelarCompra()}
                disabled={procesando}
              >
                Cancelar y liberar mi turno
              </button>
            </div>
          )}
          {etapa === 'checkout' && pedido && (
            <form className="purchase-body" onSubmit={confirmarCompra}>
              <div className="notice">
                <Icono nombre="clock" />
                <div>
                  <b>Reservadas para ti durante {tiempoRestante}</b>
                  <span>
                    {pedido.quantity} {pedido.quantity === 1 ? 'entrada' : 'entradas'} ·{' '}
                    {pedido.tierName}
                  </span>
                </div>
              </div>
              <h3>¿A nombre de quién va el plan?</h3>
              <label className="field">
                Nombre completo
                <input
                  name="name"
                  autoComplete="name"
                  placeholder="Tu nombre y apellidos"
                  required
                  minLength={3}
                  maxLength={100}
                  defaultValue={pedido.customerName}
                />
              </label>
              <label className="field">
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  required
                  maxLength={200}
                  defaultValue={pedido.customerEmail}
                />
              </label>
              <p className="input-help">
                Tus entradas quedarán guardadas en este navegador. Esta demo no envía correos.
              </p>
              <div className="demo-payment">
                <Icono nombre="shield" />
                <div>
                  <b>Compra de demostración</b>
                  <p>Prueba el proceso completo sin ingresar tarjetas ni realizar cobros.</p>
                </div>
                <span>DEMO</span>
              </div>
              <label className="checkbox-field">
                <input type="checkbox" name="terms" required />
                <span>
                  Acepto los{' '}
                  <Link href="/legal/terminos" target="_blank">
                    términos de compra
                  </Link>{' '}
                  y entiendo que esta compra es de prueba.
                </span>
              </label>
              <div className="purchase-total">
                <span>Total a confirmar</span>
                <strong>{formatearDinero(pedido.totalCents)}</strong>
              </div>
              <button className="button button-primary full" type="submit" disabled={procesando}>
                {procesando ? 'Confirmando…' : 'Confirmar compra de prueba'}
                <Icono nombre="arrow" />
              </button>
              <button
                type="button"
                className="text-button muted"
                onClick={() => void cancelarCompra()}
                disabled={procesando}
              >
                Cancelar reserva
              </button>
            </form>
          )}
          {etapa === 'done' && pedido && (
            <div className="purchase-state">
              <div className="state-icon success-icon">
                <Icono nombre="check" tamano={34} />
              </div>
              <span className="eyebrow">EL PLAN YA ES TUYO</span>
              <h3>¡Nos vemos ahí, {pedido.customerName.split(' ')[0]}!</h3>
              <p>Tu compra de prueba está confirmada. Guarda tus entradas con su código único.</p>
              <div className="confirmation-ticket">
                <Icono nombre="ticket" tamano={30} />
                <div>
                  <b>
                    {pedido.quantity} {pedido.quantity === 1 ? 'entrada' : 'entradas'} ·{' '}
                    {pedido.tierName}
                  </b>
                  <small>Pedido #{pedido.id.slice(0, 8).toUpperCase()}</small>
                </div>
                <Icono nombre="check" />
              </div>
              <div className="ticket-links">
                {pedido.tickets.map((entrada, indice) => (
                  <a
                    className="button button-outline full"
                    href={`/api/tickets/${entrada.id}`}
                    target="_blank"
                    rel="noreferrer"
                    key={entrada.id}
                  >
                    <Icono nombre="download" tamano={18} />
                    Abrir entrada {indice + 1} con QR
                    <Icono nombre="external" tamano={15} />
                  </a>
                ))}
              </div>
              <Link href="/mis-entradas" className="button button-primary full">
                Ver mis entradas
                <Icono nombre="arrow" />
              </Link>
              <p className="fine-print">Confirmación de demostración · Sin cobro</p>
            </div>
          )}
          {etapa === 'expired' && (
            <div className="purchase-state">
              <div className="state-icon">
                <Icono nombre="clock" tamano={32} />
              </div>
              <h3>Tu turno ha terminado</h3>
              <p>
                Las entradas reservadas se liberan al vencer el plazo. Puedes volver a intentarlo si
                aún hay disponibilidad.
              </p>
              <button
                className="button button-primary full"
                disabled={procesando}
                onClick={() => void entrarEnCola()}
              >
                Volver a la cola
                <Icono nombre="arrow" />
              </button>
            </div>
          )}
          {error && (
            <div className="notice error purchase-error" role="alert">
              {error}
            </div>
          )}
          <div className="purchase-footer">
            <Icono nombre="lock" tamano={13} />
            Tu turno y tus entradas se gestionan de forma segura.
          </div>
        </div>
      )}
    </VentanaModal>
  );
}
