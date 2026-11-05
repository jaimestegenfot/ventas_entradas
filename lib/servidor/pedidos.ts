import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import type { InformacionPedido } from '../tipos';
import { FilaBaseDatos, ErrorOperacion } from './compartido';
import { obtenerFechaActual, calcularFechaFutura } from './fechas';
import { obtenerBaseDatos, ejecutarTransaccion } from './base-datos';
import { obtenerInformacionEvento, obtenerEventoPublicado } from './eventos';
import { admitirSiguientesVisitantes } from './cola';
import { SEGUNDOS_RESERVA_ENTRADAS, MAXIMO_ENTRADAS_POR_COMPRA } from '../configuracion';

// Reservas temporales, confirmación de prueba y consulta de pedidos del visitante.
export function reservarEntradas(datosSolicitud: FilaBaseDatos, idVisitante: string) {
  return ejecutarTransaccion((baseDatos) => {
    const registroEvento = obtenerEventoPublicado(baseDatos, datosSolicitud.eventId);
    const pedidoAnterior = baseDatos
      .prepare('SELECT * FROM orders WHERE request_key=?')
      .get(datosSolicitud.requestKey) as FilaBaseDatos | undefined;
    if (pedidoAnterior) {
      if (
        pedidoAnterior.event_id !== datosSolicitud.eventId ||
        pedidoAnterior.visitor_id !== idVisitante ||
        pedidoAnterior.queue_id !== datosSolicitud.ticketId ||
        pedidoAnterior.tier_id !== datosSolicitud.tierId ||
        pedidoAnterior.quantity !== datosSolicitud.quantity
      )
        throw new ErrorOperacion('La solicitud ya se utilizó con otros datos.');
      return obtenerInformacionPedido(baseDatos, pedidoAnterior);
    }
    const registroTurno = baseDatos
      .prepare('SELECT * FROM queue WHERE id=? AND visitor_id=? AND event_id=?')
      .get(datosSolicitud.ticketId, idVisitante, registroEvento.id) as FilaBaseDatos | undefined;
    if (
      !registroTurno ||
      registroTurno.status !== 'admitted' ||
      registroTurno.expires_at <= obtenerFechaActual()
    )
      throw new ErrorOperacion('Tu turno terminó. Vuelve a entrar en la cola.');
    const zonaSeleccionada = obtenerInformacionEvento(baseDatos, registroEvento).tiers.find(
      (registroZona) => registroZona.id === datosSolicitud.tierId,
    );
    if (
      !zonaSeleccionada ||
      !Number.isInteger(datosSolicitud.quantity) ||
      datosSolicitud.quantity < 1 ||
      datosSolicitud.quantity > MAXIMO_ENTRADAS_POR_COMPRA
    )
      throw new ErrorOperacion('Selecciona entre 1 y 6 entradas.', 400);
    if (zonaSeleccionada.available < datosSolicitud.quantity)
      throw new ErrorOperacion(
        'No quedan suficientes entradas en esta zona. Elige otra cantidad o zona.',
      );
    const id = randomUUID();
    baseDatos
      .prepare(
        'INSERT INTO orders(id,event_id,tier_id,queue_id,visitor_id,request_key,quantity,total_cents,status,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        registroEvento.id,
        zonaSeleccionada.id,
        registroTurno.id,
        idVisitante,
        datosSolicitud.requestKey,
        datosSolicitud.quantity,
        zonaSeleccionada.priceCents * datosSolicitud.quantity,
        'held',
        calcularFechaFutura(SEGUNDOS_RESERVA_ENTRADAS),
        obtenerFechaActual(),
      );
    baseDatos.prepare("UPDATE queue SET status='used' WHERE id=?").run(registroTurno.id);
    admitirSiguientesVisitantes(baseDatos, registroEvento.id);
    return obtenerInformacionPedido(
      baseDatos,
      baseDatos.prepare('SELECT * FROM orders WHERE id=?').get(id) as FilaBaseDatos,
    );
  });
}

export function obtenerInformacionPedido(
  baseDatos: DatabaseSync,
  registroPedido: FilaBaseDatos,
): InformacionPedido {
  const registroEvento = baseDatos
    .prepare('SELECT * FROM events WHERE id=?')
    .get(registroPedido.event_id) as FilaBaseDatos;
  const registroZona = baseDatos
    .prepare('SELECT name FROM tiers WHERE id=?')
    .get(registroPedido.tier_id) as FilaBaseDatos;
  const entradas = (
    baseDatos
      .prepare('SELECT * FROM tickets WHERE order_id=?')
      .all(registroPedido.id) as FilaBaseDatos[]
  ).map((entrada) => ({ id: entrada.id, code: entrada.code, checkedInAt: entrada.checked_in_at }));
  return {
    id: registroPedido.id,
    eventId: registroEvento.id,
    eventTitle: registroEvento.title,
    image: registroEvento.image,
    venue: registroEvento.venue,
    city: registroEvento.city,
    startsAt: registroEvento.starts_at,
    tierName: registroZona.name,
    quantity: registroPedido.quantity,
    totalCents: registroPedido.total_cents,
    status: registroPedido.status,
    expiresAt: registroPedido.expires_at,
    customerName: registroPedido.customer_name,
    customerEmail: registroPedido.customer_email,
    createdAt: registroPedido.created_at,
    tickets: entradas,
  };
}

export function confirmarPedido(id: string, idVisitante: string, nombre: string, correo: string) {
  return ejecutarTransaccion((baseDatos) => {
    const registroPedido = baseDatos
      .prepare('SELECT * FROM orders WHERE id=? AND visitor_id=?')
      .get(id, idVisitante) as FilaBaseDatos | undefined;
    if (!registroPedido) throw new ErrorOperacion('No encontramos tu pedido.', 404);
    if (registroPedido.status === 'confirmed')
      return obtenerInformacionPedido(baseDatos, registroPedido);
    if (registroPedido.status !== 'held' || registroPedido.expires_at <= obtenerFechaActual())
      throw new ErrorOperacion('Tu reserva ha caducado. Vuelve a elegir tus entradas.');
    if (
      nombre.trim().length < 3 ||
      nombre.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
      correo.length > 200
    )
      throw new ErrorOperacion('Escribe un nombre y un correo válidos.', 400);
    baseDatos
      .prepare(
        "UPDATE orders SET status='confirmed', customer_name=?, customer_email=?, confirmed_at=? WHERE id=?",
      )
      .run(nombre.trim(), correo.trim().toLowerCase(), obtenerFechaActual(), id);
    for (let indice = 0; indice < registroPedido.quantity; indice++)
      baseDatos
        .prepare('INSERT INTO tickets(id,order_id,code) VALUES (?,?,?)')
        .run(randomUUID(), id, `ENT-${randomBytes(8).toString('hex').toUpperCase()}`);
    admitirSiguientesVisitantes(baseDatos, registroPedido.event_id);
    return obtenerInformacionPedido(
      baseDatos,
      baseDatos.prepare('SELECT * FROM orders WHERE id=?').get(id) as FilaBaseDatos,
    );
  });
}

export function listarPedidosVisitante(idVisitante: string) {
  return ejecutarTransaccion((baseDatos) =>
    (
      baseDatos
        .prepare(
          "SELECT * FROM orders WHERE visitor_id=? AND status IN ('held','confirmed') ORDER BY created_at DESC",
        )
        .all(idVisitante) as FilaBaseDatos[]
    ).map((registroPedido) => obtenerInformacionPedido(baseDatos, registroPedido)),
  );
}

export function cancelarPedido(id: string, idVisitante: string) {
  return ejecutarTransaccion((baseDatos) => {
    const registroPedido = baseDatos
      .prepare("SELECT event_id FROM orders WHERE id=? AND visitor_id=? AND status='held'")
      .get(id, idVisitante) as FilaBaseDatos | undefined;
    baseDatos
      .prepare("UPDATE orders SET status='cancelled' WHERE id=? AND visitor_id=? AND status='held'")
      .run(id, idVisitante);
    if (registroPedido) admitirSiguientesVisitantes(baseDatos, registroPedido.event_id);
    return { ok: true };
  });
}

export function obtenerDetalleEntrada(id: string, idVisitante: string) {
  const baseDatos = obtenerBaseDatos();
  const entrada = baseDatos
    .prepare(
      "SELECT t.*,o.visitor_id FROM tickets t JOIN orders o ON o.id=t.order_id WHERE t.id=? AND o.status='confirmed'",
    )
    .get(id) as FilaBaseDatos | undefined;
  if (!entrada || entrada.visitor_id !== idVisitante)
    throw new ErrorOperacion('Entrada no encontrada.', 404);
  return {
    ticket: entrada,
    order: obtenerInformacionPedido(
      baseDatos,
      baseDatos.prepare('SELECT * FROM orders WHERE id=?').get(entrada.order_id) as FilaBaseDatos,
    ),
  };
}
