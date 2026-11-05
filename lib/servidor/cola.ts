import 'server-only';
import type { BaseDatos } from './base-datos';
import { randomUUID } from 'node:crypto';
import type { EstadoCola } from '../tipos';
import { FilaBaseDatos, ErrorOperacion } from './compartido';
import { obtenerFechaActual, calcularFechaFutura } from './fechas';
import { ejecutarTransaccion } from './base-datos';
import { obtenerInformacionEvento, obtenerEventoPublicado } from './eventos';
import {
  SEGUNDOS_TURNO_COMPRA,
  SEGUNDOS_ESPERA_SIN_CONEXION,
  PERSONAS_COMPRANDO_POR_EVENTO,
} from '../configuracion';
// Turnos por orden de llegada, admisión limitada y salida de la sala de espera.
async function contarReservasActivas(baseDatos: BaseDatos, idEvento: string): Promise<number> {
  return (
    (await baseDatos
      .prepare(
        "SELECT COUNT(*) AS n FROM orders WHERE event_id=? AND status='held' AND expires_at>?",
      )
      .get(idEvento, obtenerFechaActual())) as FilaBaseDatos
  ).n;
}
export async function admitirSiguientesVisitantes(baseDatos: BaseDatos, idEvento: string) {
  const accesosActivos = (
    (await baseDatos
      .prepare("SELECT COUNT(*) AS n FROM queue WHERE event_id=? AND status='admitted'")
      .get(idEvento)) as FilaBaseDatos
  ).n;
  // Reservar no libera el turno: la persona todavía está confirmando su compra.
  const reservasActivas = await contarReservasActivas(baseDatos, idEvento);
  const siguientesTurnos = (await baseDatos
    .prepare("SELECT id FROM queue WHERE event_id=? AND status='waiting' ORDER BY sequence LIMIT ?")
    .all(
      idEvento,
      Math.max(0, PERSONAS_COMPRANDO_POR_EVENTO - accesosActivos - reservasActivas),
    )) as FilaBaseDatos[];
  for (const registroTurno of siguientesTurnos)
    await baseDatos
      .prepare("UPDATE queue SET status='admitted', expires_at=? WHERE id=?")
      .run(calcularFechaFutura(SEGUNDOS_TURNO_COMPRA), registroTurno.id);
}
export async function obtenerInformacionTurno(
  baseDatos: BaseDatos,
  id: string,
): Promise<EstadoCola> {
  const registroTurno = (await baseDatos
    .prepare('SELECT * FROM queue WHERE id=?')
    .get(id)) as FilaBaseDatos;
  const personasDelante =
    registroTurno.status === 'waiting'
      ? (
          (await baseDatos
            .prepare(
              "SELECT COUNT(*) AS n FROM queue WHERE event_id=? AND ((status='waiting' AND sequence<?) OR status='admitted')",
            )
            .get(registroTurno.event_id, registroTurno.sequence)) as FilaBaseDatos
        ).n + (await contarReservasActivas(baseDatos, registroTurno.event_id))
      : 0;
  return {
    ticketId: registroTurno.id,
    eventId: registroTurno.event_id,
    status: registroTurno.status,
    position: registroTurno.status === 'waiting' ? personasDelante + 1 : 0,
    ahead: personasDelante,
    expiresAt: registroTurno.expires_at,
  };
}
export async function entrarEnCola(idEvento: string, idVisitante: string) {
  return await ejecutarTransaccion(async (baseDatos) => {
    const registroEvento = await obtenerEventoPublicado(baseDatos, idEvento);
    if (!(await obtenerInformacionEvento(baseDatos, registroEvento)).available)
      throw new ErrorOperacion('Las entradas de este evento están agotadas.');
    const registroExistente = (await baseDatos
      .prepare('SELECT * FROM queue WHERE event_id=? AND visitor_id=?')
      .get(idEvento, idVisitante)) as FilaBaseDatos | undefined;
    let id = registroExistente?.id || randomUUID();
    if (registroExistente && ['waiting', 'admitted'].includes(registroExistente.status)) {
      if (registroExistente.status === 'waiting')
        await baseDatos
          .prepare('UPDATE queue SET expires_at=? WHERE id=?')
          .run(calcularFechaFutura(SEGUNDOS_ESPERA_SIN_CONEXION), id);
    } else {
      if (registroExistente)
        await baseDatos
          .prepare(
            'DELETE FROM queue WHERE id=? AND NOT EXISTS (SELECT 1 FROM orders WHERE queue_id=?)',
          )
          .run(id, id);
      // Los pedidos conservan su turno anterior; el siguiente intento recibe un turno nuevo.
      if (await baseDatos.prepare('SELECT id FROM queue WHERE id=?').get(id))
        await baseDatos.prepare('UPDATE queue SET visitor_id=? WHERE id=?').run(randomUUID(), id);
      id = randomUUID();
      await baseDatos
        .prepare(
          'INSERT INTO queue(id,event_id,visitor_id,status,joined_at,expires_at) VALUES (?,?,?,?,?,?)',
        )
        .run(
          id,
          idEvento,
          idVisitante,
          'waiting',
          obtenerFechaActual(),
          calcularFechaFutura(SEGUNDOS_ESPERA_SIN_CONEXION),
        );
    }
    await admitirSiguientesVisitantes(baseDatos, idEvento);
    return await obtenerInformacionTurno(baseDatos, id);
  });
}
export async function consultarTurno(id: string, idVisitante: string) {
  return await ejecutarTransaccion(async (baseDatos) => {
    const registroTurno = (await baseDatos
      .prepare('SELECT * FROM queue WHERE id=? AND visitor_id=?')
      .get(id, idVisitante)) as FilaBaseDatos | undefined;
    if (!registroTurno) throw new ErrorOperacion('No encontramos tu turno.', 404);
    await obtenerEventoPublicado(baseDatos, registroTurno.event_id);
    if (registroTurno.status === 'waiting')
      await baseDatos
        .prepare('UPDATE queue SET expires_at=? WHERE id=?')
        .run(calcularFechaFutura(SEGUNDOS_ESPERA_SIN_CONEXION), id);
    await admitirSiguientesVisitantes(baseDatos, registroTurno.event_id);
    return await obtenerInformacionTurno(baseDatos, id);
  });
}
export async function salirDeCola(id: string, idVisitante: string) {
  return await ejecutarTransaccion(async (baseDatos) => {
    const registroTurno = (await baseDatos
      .prepare('SELECT event_id FROM queue WHERE id=? AND visitor_id=?')
      .get(id, idVisitante)) as FilaBaseDatos | undefined;
    if (registroTurno) {
      await baseDatos
        .prepare(
          "UPDATE queue SET status='cancelled' WHERE id=? AND status IN ('waiting','admitted')",
        )
        .run(id);
      await admitirSiguientesVisitantes(baseDatos, registroTurno.event_id);
    }
    return { ok: true };
  });
}
