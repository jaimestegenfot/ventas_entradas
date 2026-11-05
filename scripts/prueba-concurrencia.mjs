// Prueba repetible del RNF de integridad. Ejecutar tras 03_reiniciar_prueba.sql.
const URL_SERVIDOR = process.env.BASE_URL || 'http://localhost:3000';
const cantidadCompradores = Number(process.env.COMPRADORES || 12);
if (!Number.isInteger(cantidadCompradores) || cantidadCompradores < 2 || cantidadCompradores > 100)
  throw new Error('COMPRADORES debe estar entre 2 y 100');

async function solicitar(path, metodo = 'GET', datos) {
  const inicio = performance.now();
  const respuesta = await fetch(`${URL_SERVIDOR}${path}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  const duracionMs = performance.now() - inicio;
  const resultado = await respuesta.json();
  return { status: respuesta.status, result: resultado, ms: duracionMs };
}
const { result: catalogo, status: estadoHttp } = await solicitar('/api/events');
if (estadoHttp !== 200) throw new Error(`No responde la aplicación: ${JSON.stringify(catalogo)}`);
const evento = catalogo.events.find((evento) => evento.slug === 'prueba-ultima-entrada');
if (!evento) throw new Error('Falta ejecutar 02_datos.sql');
if (evento.available !== 1)
  throw new Error(
    'Reinicia el evento de prueba con 03_reiniciar_prueba.sql (debe quedar 1 entrada).',
  );

console.log(`Probando ${cantidadCompradores} compradores simultáneos contra 1 sola entrada…`);
const turnosCreados = await Promise.all(
  Array.from({ length: cantidadCompradores }, () =>
    solicitar('/api/queue', 'POST', { eventId: evento.id, visitorId: crypto.randomUUID() }),
  ),
);
if (turnosCreados.some((resultado) => resultado.status !== 200))
  throw new Error(
    `Falló la sala de espera: ${JSON.stringify(turnosCreados.filter((resultado) => resultado.status !== 200))}`,
  );

const estadosTurnos = await Promise.all(
  turnosCreados.map((turno) => solicitar(`/api/queue?ticketId=${turno.result.ticketId}`)),
);
const turnosAdmitidos = estadosTurnos.flatMap((estado, indice) =>
  estado.result.status === 'admitted' ? [{ ticketId: turnosCreados[indice].result.ticketId }] : [],
);
if (turnosAdmitidos.length !== 1)
  throw new Error(
    `La sala debe admitir a una sola persona, pero admitió a ${turnosAdmitidos.length}`,
  );
const personasEsperando = estadosTurnos.filter(
  (estado) => estado.result.status === 'waiting',
).length;

const intentosReserva = await Promise.all(
  turnosAdmitidos.map((intento) => {
    intento.requestKey = crypto.randomUUID();
    return solicitar('/api/reserve', 'POST', {
      eventId: evento.id,
      ticketId: intento.ticketId,
      requestKey: intento.requestKey,
    });
  }),
);
const reservasExitosas = intentosReserva.filter((resultado) => resultado.status === 200);
const reservasRechazadas = intentosReserva.filter((resultado) => resultado.status === 409);
const fallosInesperados = intentosReserva.filter((resultado) => resultado.status !== 200);
if (fallosInesperados.length)
  throw new Error(`Error inesperado: ${JSON.stringify(fallosInesperados)}`);
if (reservasExitosas.length !== 1)
  throw new Error(`RNF FALLIDO: ${reservasExitosas.length} reservas exitosas para 1 cupo`);

const ganador = turnosAdmitidos[intentosReserva.findIndex((intento) => intento.status === 200)];
const reservaOriginal = reservasExitosas[0].result;
const reservaRepetida = await solicitar('/api/reserve', 'POST', {
  eventId: evento.id,
  ticketId: ganador.ticketId,
  requestKey: ganador.requestKey,
});
if (
  reservaRepetida.status !== 200 ||
  reservaRepetida.result.reservationId !== reservaOriginal.reservationId
)
  throw new Error('RNF FALLIDO: idempotencia de reserva');

const primeraConfirmacion = await solicitar('/api/pay', 'POST', {
  reservationId: reservaOriginal.reservationId,
});
const segundaConfirmacion = await solicitar('/api/pay', 'POST', {
  reservationId: reservaOriginal.reservationId,
});
if (
  primeraConfirmacion.status !== 200 ||
  segundaConfirmacion.status !== 200 ||
  primeraConfirmacion.result.paymentReference !== segundaConfirmacion.result.paymentReference
)
  throw new Error('RNF FALLIDO: idempotencia del pago simulado');
const catalogoFinal = await solicitar('/api/events');
const entradasRestantes = catalogoFinal.result.events.find(
  (evento) => evento.id === evento.id,
).available;
if (entradasRestantes !== 0)
  throw new Error(`RNF FALLIDO: quedaron ${entradasRestantes} disponibles`);

const duraciones = intentosReserva
  .map((intento) => intento.ms)
  .sort((intento, siguienteDuracion) => intento - siguienteDuracion);
const percentil95 = duraciones[Math.ceil(0.95 * duraciones.length) - 1];
console.log(`✓ Compradores: ${cantidadCompradores}`);
console.log(`✓ Admitidos inicialmente: ${turnosAdmitidos.length} (máximo: 1)`);
console.log(`✓ Compradores que siguen en fila: ${personasEsperando}`);
console.log(`✓ Reservas exitosas: ${reservasExitosas.length}`);
console.log(`✓ Reservas rechazadas: ${reservasRechazadas.length}`);
console.log('✓ Sobreventas: 0');
console.log('✓ Reintentar reserva no crea otra orden');
console.log('✓ Reintentar pago simulado no duplica confirmación');
console.log(
  `✓ p95 de reserva en esta prueba: ${percentil95.toFixed(0)} ms (NO equivale a prueba masiva)`,
);
console.log('RESULTADO: PRUEBA DE INTEGRIDAD APROBADA');
