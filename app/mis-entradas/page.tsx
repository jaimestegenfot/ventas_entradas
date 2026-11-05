'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PieSitio, EncabezadoSitio } from '../../componentes/EstructuraSitio';
import { Icono } from '../../componentes/Icono';
import { consultarApi } from '../../lib/cliente';
import {
  formatearFecha,
  formatearDinero,
  formatearHora,
  type InformacionPedido,
} from '../../lib/tipos';
export default function PaginaMisEntradas() {
  const [pedidos, setOrders] = useState<InformacionPedido[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState('');
  async function cargarDatos() {
    establecerCargando(true);
    try {
      setOrders((await consultarApi<{ orders: InformacionPedido[] }>('/api/orders')).orders);
      establecerError('');
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerCargando(false);
    }
  }
  useEffect(() => {
    void cargarDatos();
  }, []);
  return (
    <>
      <EncabezadoSitio />
      <main className="container wallet">
        <div className="wallet-heading">
          <div>
            <span className="eyebrow">TU COLECCIÓN DE BUENOS PLANES</span>
            <h1>Nos vemos ahí.</h1>
            <p>Tus entradas, listas para cuando llegue el momento.</p>
          </div>
          <Link href="/#eventos" className="button button-outline">
            Descubrir otro plan
            <Icono nombre="arrow" tamano={17} />
          </Link>
        </div>
        <div className="wallet-info">
          <Icono nombre="info" tamano={17} />
          <span>
            Estas entradas se guardan en este navegador. Ábrelas y guárdalas como PDF para llevarlas
            contigo. Todas las compras de esta versión son de demostración.
          </span>
        </div>
        {error && (
          <div className="notice error" style={{ marginTop: 20 }} role="alert">
            {error}
            <button className="text-button" onClick={() => void cargarDatos()}>
              Reintentar
            </button>
          </div>
        )}
        {cargando ? (
          <div className="empty-state">
            <span className="spinner" />
            <p>Buscando tus próximos momentos…</p>
          </div>
        ) : pedidos.length ? (
          pedidos.map((pedido) => (
            <article className="wallet-order" key={pedido.id}>
              <div className="wallet-order-header">
                <img src={pedido.image} alt={pedido.eventTitle} />
                <div>
                  <span className={`status-badge status-${pedido.status}`}>
                    {pedido.status === 'confirmed'
                      ? 'Compra de prueba confirmada'
                      : 'Reserva pendiente'}
                  </span>
                  <h2>{pedido.eventTitle}</h2>
                  <p>
                    <Icono nombre="calendar" tamano={13} />
                    {formatearFecha(pedido.startsAt, true)} · {formatearHora(pedido.startsAt)}
                  </p>
                  <p>
                    <Icono nombre="pin" tamano={13} />
                    {pedido.venue} · {pedido.city}
                  </p>
                </div>
                <div className="wallet-order-price">
                  <strong>{formatearDinero(pedido.totalCents)}</strong>
                  <span>
                    {pedido.quantity} {pedido.quantity === 1 ? 'entrada' : 'entradas'} ·{' '}
                    {pedido.tierName}
                  </span>
                </div>
              </div>
              {pedido.status === 'held' ? (
                <div className="wallet-order-held">
                  <span>
                    Tus entradas están reservadas hasta las {formatearHora(pedido.expiresAt)}.
                  </span>
                  <Link className="button button-outline" href="/">
                    Retomar compra
                    <Icono nombre="arrow" tamano={14} />
                  </Link>
                </div>
              ) : (
                <div className="wallet-tickets">
                  {pedido.tickets.map((entrada, indice) => (
                    <div className="wallet-ticket" key={entrada.id}>
                      <img
                        className="wallet-qr"
                        src={`/api/tickets/${entrada.id}?format=qr`}
                        alt={`Código QR de la entrada ${indice + 1}`}
                      />
                      <div>
                        <h3>
                          Entrada {indice + 1} · {pedido.tierName}
                        </h3>
                        <code>{entrada.code}</code>
                        <p>
                          {pedido.customerName} ·{' '}
                          {entrada.checkedInAt ? 'Acceso registrado' : 'Lista para el acceso'}
                        </p>
                        <a
                          className="button button-outline"
                          href={`/api/tickets/${entrada.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icono nombre="download" tamano={13} />
                          Abrir y guardar entrada
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))
        ) : (
          !error && (
            <div className="empty-state" style={{ marginTop: 25 }}>
              <Icono nombre="ticket" tamano={42} />
              <h3>Tu primera gran historia te espera.</h3>
              <p>Cuando confirmes una compra, tus entradas aparecerán aquí.</p>
              <Link href="/#eventos" className="button button-primary">
                Encuentra tu próximo plan
                <Icono nombre="arrow" tamano={17} />
              </Link>
            </div>
          )
        )}
      </main>
      <PieSitio />
    </>
  );
}
