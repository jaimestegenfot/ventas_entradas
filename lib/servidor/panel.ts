import 'server-only';
import { FilaBaseDatos } from './compartido';
import { ejecutarTransaccion } from './base-datos';
import { listarEventos } from './eventos';
import { obtenerInformacionPedidos } from './pedidos';
// Métricas y datos del panel del organizador.
export async function obtenerDatosPanel() {
  return await ejecutarTransaccion(async (baseDatos) => {
    const eventos = await listarEventos(true, baseDatos);
    const pedidos = await obtenerInformacionPedidos(
      baseDatos,
      (await baseDatos
        .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100')
        .all()) as FilaBaseDatos[],
    );
    const totales = (await baseDatos
      .prepare(
        "SELECT COALESCE(SUM(quantity),0) AS sold, COALESCE(SUM(total_cents),0) AS revenue FROM orders WHERE status='confirmed'",
      )
      .get()) as FilaBaseDatos;
    const resumenesColas = (
      (await baseDatos
        .prepare(
          "SELECT event_id, SUM(CASE WHEN status='waiting' THEN 1 ELSE 0 END) AS waiting, SUM(CASE WHEN status='admitted' THEN 1 ELSE 0 END) AS admitted FROM queue WHERE status IN ('waiting','admitted') GROUP BY event_id",
        )
        .all()) as FilaBaseDatos[]
    ).map((registroTurno) => ({
      eventId: registroTurno.event_id,
      waiting: registroTurno.waiting,
      admitted: registroTurno.admitted,
    }));
    return {
      events: eventos,
      orders: pedidos,
      queues: resumenesColas,
      metrics: {
        events: eventos.length,
        published: eventos.filter((registroEvento) => registroEvento.status === 'published').length,
        confirmed: totales.sold,
        revenue: totales.revenue,
        waiting: (
          (await baseDatos
            .prepare("SELECT COUNT(*) AS n FROM queue WHERE status='waiting'")
            .get()) as FilaBaseDatos
        ).n,
        admitted: (
          (await baseDatos
            .prepare("SELECT COUNT(*) AS n FROM queue WHERE status='admitted'")
            .get()) as FilaBaseDatos
        ).n,
        activeHolds: (
          (await baseDatos
            .prepare("SELECT COUNT(*) AS n FROM orders WHERE status='held'")
            .get()) as FilaBaseDatos
        ).n,
      },
    };
  });
}
