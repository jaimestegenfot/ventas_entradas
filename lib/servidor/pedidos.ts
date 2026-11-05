import 'server-only';
import type { BaseDatos } from './base-datos';
import { randomBytes, randomUUID } from 'node:crypto';
import type { InformacionPedido } from '../tipos';
import { FilaBaseDatos, ErrorOperacion } from './compartido';
import { obtenerFechaActual, calcularFechaFutura } from './fechas';
import { ejecutarLectura, ejecutarTransaccion } from './base-datos';
import { obtenerInformacionEvento, obtenerEventoPublicado } from './eventos';
import { admitirSiguientesVisitantes } from './cola';
import { SEGUNDOS_RESERVA_ENTRADAS, MAXIMO_ENTRADAS_POR_COMPRA } from '../configuracion';
// Reservas temporales, confirmación de prueba y consulta de pedidos del visitante.
export async function reservarEntradas(datosSolicitud: FilaBaseDatos, idVisitante: string) {
  return await ejecutarTransaccion(async (baseDatos) => {
    const registroEvento = await obtenerEventoPublicado(baseDatos, datosSolicitud.eventId);
    const pedidoAnterior = (await baseDatos
      .prepare('SELECT * FROM orders WHERE request_key=?')
      .get(datosSolicitud.requestKey)) as FilaBaseDatos | undefined;
    if (pedidoAnterior) {
      if (
        pedidoAnterior.event_id !== datosSolicitud.eventId ||
        pedidoAnterior.visitor_id !== idVisitante ||
        pedidoAnterior.queue_id !== datosSolicitud.ticketId ||
        pedidoAnterior.tier_id !== datosSolicitud.tierId ||
        pedidoAnterior.quantity !== datosSolicitud.quantity
      )
        throw new ErrorOperacion('La solicitud ya se utilizó con otros datos.');
      return await obtenerInformacionPedido(baseDatos, pedidoAnterior);
    }
    const registroTurno = (await baseDatos
      .prepare('SELECT * FROM queue WHERE id=? AND visitor_id=? AND event_id=?')
      .get(datosSolicitud.ticketId, idVisitante, registroEvento.id)) as FilaBaseDatos | undefined;
    if (
      !registroTurno ||
      registroTurno.status !== 'admitted' ||
      registroTurno.expires_at <= obtenerFechaActual()
    )
      throw new ErrorOperacion('Tu turno terminó. Vuelve a entrar en la cola.');
    const zonaSeleccionada = (await obtenerInformacionEvento(baseDatos, registroEvento)).tiers.find(
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
    await baseDatos
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
    await baseDatos.prepare("UPDATE queue SET status='used' WHERE id=?").run(registroTurno.id);
    await admitirSiguientesVisitantes(baseDatos, registroEvento.id);
    return await obtenerInformacionPedido(
      baseDatos,
      (await baseDatos.prepare('SELECT * FROM orders WHERE id=?').get(id)) as FilaBaseDatos,
    );
  });
}
export async function obtenerInformacionPedido(
  baseDatos: BaseDatos,
  registro: FilaBaseDatos,
): Promise<InformacionPedido> {
  return (await obtenerInformacionPedidos(baseDatos, [registro]))[0];
}

export async function obtenerInformacionPedidos(
  baseDatos: BaseDatos,
  registros: FilaBaseDatos[],
): Promise<InformacionPedido[]> {
  if (!registros.length) return [];
  const idsZonas = [...new Set(registros.map((pedido) => pedido.tier_id))];
  const zonas = await baseDatos
    .prepare(
      `SELECT e.*, t.id AS tier_id, t.name AS tier_name FROM events e JOIN tiers t ON t.event_id=e.id WHERE t.id IN (${idsZonas.map(() => '?').join(',')})`,
    )
    .all(...idsZonas);
  const entradas = await baseDatos
    .prepare(`SELECT * FROM tickets WHERE order_id IN (${registros.map(() => '?').join(',')})`)
    .all(...registros.map((pedido) => pedido.id));
  return registros.map((pedido) => {
    const evento = zonas.find((zona) => zona.tier_id === pedido.tier_id)!;
    return {
      id: pedido.id,
      eventId: evento.id,
      eventTitle: evento.title,
      image: evento.image,
      venue: evento.venue,
      city: evento.city,
      startsAt: evento.starts_at,
      tierName: evento.tier_name,
      quantity: pedido.quantity,
      totalCents: pedido.total_cents,
      status: pedido.status,
      expiresAt: pedido.expires_at,
      customerName: pedido.customer_name,
      customerEmail: pedido.customer_email,
      createdAt: pedido.created_at,
      tickets: entradas
        .filter((entrada) => entrada.order_id === pedido.id)
        .map((entrada) => ({
          id: entrada.id,
          code: entrada.code,
          checkedInAt: entrada.checked_in_at,
        })),
    };
  });
}

export async function confirmarPedido(
  id: string,
  idVisitante: string,
  nombre: string,
  correo: string,
) {
  return await ejecutarTransaccion(async (baseDatos) => {
    const registroPedido = (await baseDatos
      .prepare('SELECT * FROM orders WHERE id=? AND visitor_id=?')
      .get(id, idVisitante)) as FilaBaseDatos | undefined;
    if (!registroPedido) throw new ErrorOperacion('No encontramos tu pedido.', 404);
    if (registroPedido.status === 'confirmed')
      return await obtenerInformacionPedido(baseDatos, registroPedido);
    if (registroPedido.status !== 'held' || registroPedido.expires_at <= obtenerFechaActual())
      throw new ErrorOperacion('Tu reserva ha caducado. Vuelve a elegir tus entradas.');
    if (
      nombre.trim().length < 3 ||
      nombre.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
      correo.length > 200
    )
      throw new ErrorOperacion('Escribe un nombre y un correo válidos.', 400);
    await baseDatos
      .prepare(
        "UPDATE orders SET status='confirmed', customer_name=?, customer_email=?, confirmed_at=? WHERE id=?",
      )
      .run(nombre.trim(), correo.trim().toLowerCase(), obtenerFechaActual(), id);
    for (let indice = 0; indice < registroPedido.quantity; indice++)
      await baseDatos
        .prepare('INSERT INTO tickets(id,order_id,code) VALUES (?,?,?)')
        .run(randomUUID(), id, `ENT-${randomBytes(8).toString('hex').toUpperCase()}`);
    await admitirSiguientesVisitantes(baseDatos, registroPedido.event_id);
    return await obtenerInformacionPedido(
      baseDatos,
      (await baseDatos.prepare('SELECT * FROM orders WHERE id=?').get(id)) as FilaBaseDatos,
    );
  });
}
export async function listarPedidosVisitante(idVisitante: string) {
  return ejecutarTransaccion(async (baseDatos) =>
    obtenerInformacionPedidos(
      baseDatos,
      await baseDatos
        .prepare(
          "SELECT * FROM orders WHERE visitor_id=? AND status IN ('held','confirmed') ORDER BY created_at DESC",
        )
        .all(idVisitante),
    ),
  );
}
export async function cancelarPedido(id: string, idVisitante: string) {
  return await ejecutarTransaccion(async (baseDatos) => {
    const registroPedido = (await baseDatos
      .prepare("SELECT event_id FROM orders WHERE id=? AND visitor_id=? AND status='held'")
      .get(id, idVisitante)) as FilaBaseDatos | undefined;
    await baseDatos
      .prepare("UPDATE orders SET status='cancelled' WHERE id=? AND visitor_id=? AND status='held'")
      .run(id, idVisitante);
    if (registroPedido) await admitirSiguientesVisitantes(baseDatos, registroPedido.event_id);
    return { ok: true };
  });
}
export async function obtenerDetalleEntrada(id: string, idVisitante: string) {
  return ejecutarLectura(async (baseDatos) => {
    const entrada = (await baseDatos
      .prepare(
        "SELECT t.*,o.visitor_id FROM tickets t JOIN orders o ON o.id=t.order_id WHERE t.id=? AND o.status='confirmed'",
      )
      .get(id)) as FilaBaseDatos | undefined;
    if (!entrada || entrada.visitor_id !== idVisitante)
      throw new ErrorOperacion('Entrada no encontrada.', 404);
    return {
      ticket: entrada,
      order: await obtenerInformacionPedido(
        baseDatos,
        (await baseDatos
          .prepare('SELECT * FROM orders WHERE id=?')
          .get(entrada.order_id)) as FilaBaseDatos,
      ),
    };
  });
}
