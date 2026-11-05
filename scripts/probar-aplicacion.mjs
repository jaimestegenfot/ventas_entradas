import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// Cada ejecución usa su propio servidor y base de datos, aislados de los registros de la web.
const directorioProyecto = process.cwd();
const directorioDatos = path.join(directorioProyecto, '.data');
await mkdir(directorioDatos, { recursive: true });
const directorioPruebas = path.join(directorioDatos, `test-${randomUUID()}`);
await mkdir(directorioPruebas);
const rutaBaseDatos = path.join(directorioPruebas, 'entrada.sqlite');
const puerto = Number(process.env.TEST_PORT || 3101);
const urlServidor = `http://127.0.0.1:${puerto}`;
const contrasena = randomBytes(20).toString('hex');
let salidaServidor = '';
let baseDatos;
const procesoServidor = spawn(
  process.execPath,
  [
    path.join(directorioProyecto, 'node_modules', 'next', 'dist', 'bin', 'next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(puerto),
  ],
  {
    cwd: directorioProyecto,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_DIST_DIR: '.next-production',
      ENTRADA_DATA_DIR: directorioPruebas,
      ENTRADA_DB_PATH: rutaBaseDatos,
      ADMIN_PASSWORD: contrasena,
      // No usar servicios ni credenciales reales aunque existan en el entorno del desarrollador.
      VERCEL: '',
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
      BLOB_READ_WRITE_TOKEN: '',
      COOKIE_SECURE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
procesoServidor.stdout.on('data', (fragmentoSalida) => {
  salidaServidor += fragmentoSalida;
});
procesoServidor.stderr.on('data', (fragmentoSalida) => {
  salidaServidor += fragmentoSalida;
});
let comprobaciones = 0;
function comprobar(descripcion, verificacion) {
  verificacion();
  comprobaciones++;
  console.log(`✓ ${descripcion}`);
}
class ClientePruebas {
  cookie = '';
  async solicitar(url, metodo = 'GET', datosSolicitud, estadoEsperado = 200) {
    const respuesta = await fetch(urlServidor + url, {
      method: metodo,
      headers: {
        Cookie: this.cookie,
        ...(datosSolicitud instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      },
      body:
        datosSolicitud === undefined
          ? undefined
          : datosSolicitud instanceof FormData
            ? datosSolicitud
            : JSON.stringify(datosSolicitud),
    });
    const cookiesRecibidas = respuesta.headers.getSetCookie();
    if (cookiesRecibidas.length) {
      const mapaCookies = new Map(
        this.cookie
          .split('; ')
          .filter(Boolean)
          .map((cookieRecibida) => {
            const indice = cookieRecibida.indexOf('=');
            return [cookieRecibida.slice(0, indice), cookieRecibida.slice(indice + 1)];
          }),
      );
      for (const cookieRecibida of cookiesRecibidas) {
        const primeraParte = cookieRecibida.split(';')[0];
        const indice = primeraParte.indexOf('=');
        mapaCookies.set(primeraParte.slice(0, indice), primeraParte.slice(indice + 1));
      }
      this.cookie = Array.from(
        mapaCookies,
        ([nombreCookie, valorCookie]) => `${nombreCookie}=${valorCookie}`,
      ).join('; ');
    }
    const texto = await respuesta.text();
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
    assert.equal(respuesta.status, estadoEsperado, `${metodo} ${url}: ${texto.slice(0, 300)}`);
    return datos;
  }
}
const administrador = new ClientePruebas(),
  comprador = new ClientePruebas(),
  visitanteAjeno = new ClientePruebas();
const crearDatosEvento = (cambios = {}) => ({
  title: 'Evento de prueba',
  subtitle: 'Prueba aislada',
  description: 'Registro temporal para comprobar la integridad de reservas.',
  venue: 'Sala de prueba',
  city: 'Lima',
  startsAt: '2028-06-01T20:00:00-05:00',
  category: 'Música',
  image: '/images/festival.jpg',
  status: 'published',
  featured: false,
  queueSlots: 1,
  tiers: [{ name: 'General', priceCents: 5000, capacity: 10 }],
  ...cambios,
});
try {
  let servidorListo = false;
  for (let indice = 0; indice < 100; indice++) {
    if (procesoServidor.exitCode !== null) throw new Error(salidaServidor);
    try {
      const respuesta = await fetch(urlServidor + '/');
      if (respuesta.ok) {
        servidorListo = true;
        break;
      }
    } catch {}
    await new Promise((resolver) => setTimeout(resolver, 150));
  }
  assert.ok(servidorListo, `El servidor no arrancó: ${salidaServidor}`);
  const catalogoInicial = await comprador.solicitar('/api/events');
  comprobar('Catálogo inicial con seis eventos y stock calculado', () =>
    assert.equal(catalogoInicial.events.length, 6),
  );
  comprobar('Todos los eventos permiten solo una persona comprando', () =>
    assert.ok(catalogoInicial.events.every((evento) => evento.queueSlots === 1)),
  );
  for (const url of [
    '/admin',
    '/mis-entradas',
    '/legal/terminos',
    '/legal/privacidad',
    '/images/festival.jpg',
    '/images/indie.jpg',
    '/images/theater.jpg',
    '/images/river.jpg',
    '/images/electronic.jpg',
    '/images/running.jpg',
    '/fonts/fonts.css',
  ]) {
    const respuesta = await fetch(urlServidor + url);
    assert.ok(respuesta.ok, `${url}: ${respuesta.status}`);
  }
  comprobar('Páginas, fotografías y tipografías disponibles', () => {});
  await visitanteAjeno.solicitar('/api/metrics', 'GET', undefined, 401);
  await visitanteAjeno.solicitar('/api/admin/events', 'POST', crearDatosEvento(), 401);
  comprobar('Panel y operaciones administrativas protegidos', () => {});
  await administrador.solicitar('/api/admin/session', 'POST', { password: 'incorrecta' }, 401);
  await administrador.solicitar('/api/admin/session', 'POST', { password: contrasena });
  comprobar('Autenticación administrativa con cookie de sesión', () =>
    assert.ok(administrador.cookie.includes('entrada_admin=')),
  );
  await administrador.solicitar(
    '/api/admin/events',
    'POST',
    crearDatosEvento({ queueSlots: 2 }),
    400,
  );
  comprobar('El servidor rechaza aumentar el límite de compra simultánea', () => {});
  const solicitudOtroOrigen = await fetch(urlServidor + '/api/admin/events', {
    method: 'POST',
    headers: {
      Cookie: administrador.cookie,
      Origin: 'https://otro-dominio.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(crearDatosEvento()),
  });
  comprobar('Rechazo de escrituras desde otro origen', () =>
    assert.equal(solicitudOtroOrigen.status, 403),
  );
  const borrador = (
    await administrador.solicitar(
      '/api/admin/events',
      'POST',
      crearDatosEvento({ title: 'Borrador privado', status: 'draft' }),
    )
  ).event;
  const eventosPublicos = (await comprador.solicitar('/api/events')).events;
  comprobar('Los borradores no aparecen en el catálogo público', () =>
    assert.ok(!eventosPublicos.some((evento) => evento.id === borrador.id)),
  );
  await comprador.solicitar('/api/queue', 'POST', { eventId: borrador.id }, 404);
  const eventoPublicado = (
    await administrador.solicitar(`/api/admin/events/${borrador.id}`, 'PUT', {
      ...crearDatosEvento({ title: 'Borrador publicado' }),
      tiers: borrador.tiers,
    })
  ).event;
  comprobar('Editar y publicar un borrador lo incorpora al catálogo', () =>
    assert.equal(eventoPublicado.status, 'published'),
  );
  const eventoColaOrdenada = (
    await administrador.solicitar(
      '/api/admin/events',
      'POST',
      crearDatosEvento({ title: 'Cola FIFO' }),
    )
  ).event;
  const visitantes = [new ClientePruebas(), new ClientePruebas(), new ClientePruebas()];
  const turnos = [];
  for (const cliente of visitantes)
    turnos.push(await cliente.solicitar('/api/queue', 'POST', { eventId: eventoColaOrdenada.id }));
  comprobar('Admisión limitada y orden real de llegada', () => {
    assert.equal(turnos[0].status, 'admitted');
    assert.equal(turnos[1].status, 'waiting');
    assert.equal(turnos[1].ahead, 1);
    assert.equal(turnos[2].ahead, 2);
  });
  const turnoRepetido = await visitantes[1].solicitar('/api/queue', 'POST', {
    eventId: eventoColaOrdenada.id,
  });
  comprobar('Volver a entrar mantiene el mismo turno', () =>
    assert.equal(turnoRepetido.ticketId, turnos[1].ticketId),
  );
  await visitanteAjeno.solicitar(
    `/api/queue?ticketId=${turnos[0].ticketId}`,
    'GET',
    undefined,
    401,
  );
  await visitanteAjeno.solicitar('/api/events');
  await visitanteAjeno.solicitar(
    `/api/queue?ticketId=${turnos[0].ticketId}`,
    'GET',
    undefined,
    404,
  );
  comprobar('Los turnos pertenecen a su visitante', () => {});
  await visitantes[0].solicitar('/api/queue', 'DELETE', { ticketId: turnos[0].ticketId });
  const segundoTurno = await visitantes[1].solicitar(`/api/queue?ticketId=${turnos[1].ticketId}`);
  comprobar('Abandonar libera el acceso para el siguiente', () =>
    assert.equal(segundoTurno.status, 'admitted'),
  );
  const eventoUltimaEntrada = (
    await administrador.solicitar(
      '/api/admin/events',
      'POST',
      crearDatosEvento({
        title: 'Última entrada',
        queueSlots: 1,
        tiers: [{ name: 'General', priceCents: 12500, capacity: 1 }],
      }),
    )
  ).event;
  const compradoresSimultaneos = Array.from({ length: 12 }, () => new ClientePruebas());
  const turnosSimultaneos = await Promise.all(
    compradoresSimultaneos.map((cliente) =>
      cliente.solicitar('/api/queue', 'POST', { eventId: eventoUltimaEntrada.id }),
    ),
  );
  comprobar('Doce llegadas simultáneas admiten a una persona y dejan once en cola', () => {
    assert.equal(turnosSimultaneos.filter((turno) => turno.status === 'admitted').length, 1);
    assert.equal(turnosSimultaneos.filter((turno) => turno.status === 'waiting').length, 11);
  });
  const solicitudesReserva = turnosSimultaneos.map((turno) => ({
    eventId: eventoUltimaEntrada.id,
    ticketId: turno.ticketId,
    tierId: eventoUltimaEntrada.tiers[0].id,
    quantity: 1,
    requestKey: randomUUID(),
    totalCents: 1,
  }));
  const resultadosReserva = await Promise.all(
    compradoresSimultaneos.map(async (cliente, indice) => {
      const respuesta = await fetch(urlServidor + '/api/reserve', {
        method: 'POST',
        headers: { Cookie: cliente.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(solicitudesReserva[indice]),
      });
      return { status: respuesta.status, body: await respuesta.json(), i: indice };
    }),
  );
  const reservasExitosas = resultadosReserva.filter((respuesta) => respuesta.status === 200);
  const reservasRechazadas = resultadosReserva.filter((respuesta) => respuesta.status === 409);
  comprobar('12 compradores simultáneos, 1 entrada: una reserva y cero sobreventas', () => {
    assert.equal(reservasExitosas.length, 1);
    assert.equal(reservasRechazadas.length, 11);
  });
  const compradorGanador = compradoresSimultaneos[reservasExitosas[0].i];
  const pedido = reservasExitosas[0].body.order;
  const solicitudOriginal = solicitudesReserva[reservasExitosas[0].i];
  comprobar('El importe se calcula en el servidor', () => assert.equal(pedido.totalCents, 12500));
  const reservaReintentada = await compradorGanador.solicitar(
    '/api/reserve',
    'POST',
    solicitudOriginal,
  );
  comprobar('Reintentar una reserva no crea otro pedido', () =>
    assert.equal(reservaReintentada.order.id, pedido.id),
  );
  await compradorGanador.solicitar(
    '/api/pay',
    'POST',
    { reservationId: pedido.id, name: 'Prueba', email: 'invalido', acceptedTerms: true },
    400,
  );
  await visitanteAjeno.solicitar(
    '/api/pay',
    'POST',
    {
      reservationId: pedido.id,
      name: 'Otro Comprador',
      email: 'otro@example.test',
      acceptedTerms: true,
    },
    404,
  );
  const datosConfirmacion = {
    reservationId: pedido.id,
    name: 'Comprador de Prueba',
    email: 'prueba@example.test',
    acceptedTerms: true,
  };
  const [primeraConfirmacion, segundaConfirmacion] = await Promise.all([
    compradorGanador.solicitar('/api/pay', 'POST', datosConfirmacion),
    compradorGanador.solicitar('/api/pay', 'POST', datosConfirmacion),
  ]);
  comprobar('Confirmación idempotente: un solo código aunque se repita en paralelo', () => {
    assert.equal(primeraConfirmacion.order.tickets.length, 1);
    assert.equal(
      primeraConfirmacion.order.tickets[0].code,
      segundaConfirmacion.order.tickets[0].code,
    );
  });
  const misPedidos = (await compradorGanador.solicitar('/api/orders')).orders;
  comprobar('Las entradas quedan disponibles para su comprador', () =>
    assert.equal(
      misPedidos.find((pedidoGuardado) => pedidoGuardado.id === pedido.id).status,
      'confirmed',
    ),
  );
  const entrada = primeraConfirmacion.order.tickets[0];
  const qr = await compradorGanador.solicitar(`/api/tickets/${entrada.id}?format=qr`);
  const documentoHtml = await compradorGanador.solicitar(`/api/tickets/${entrada.id}`);
  comprobar('QR real y entrada imprimible generados', () => {
    assert.ok(qr.includes('<svg'));
    assert.ok(documentoHtml.includes(entrada.code));
    assert.ok(documentoHtml.includes('window.print()'));
  });
  await visitanteAjeno.solicitar(`/api/tickets/${entrada.id}`, 'GET', undefined, 404);
  await administrador.solicitar('/api/admin/check-in', 'POST', { code: entrada.code });
  await administrador.solicitar('/api/admin/check-in', 'POST', { code: entrada.code }, 409);
  comprobar('Validación de un único acceso por entrada', () => {});
  const eventoModificado = {
    ...crearDatosEvento({ title: 'Última entrada', queueSlots: 1 }),
    tiers: [{ ...eventoUltimaEntrada.tiers[0], capacity: 0 }],
  };
  await administrador.solicitar(
    `/api/admin/events/${eventoUltimaEntrada.id}`,
    'PUT',
    eventoModificado,
    400,
  );
  comprobar('No se acepta un aforo inválido', () => {});
  const eventoCaducidad = (
    await administrador.solicitar(
      '/api/admin/events',
      'POST',
      crearDatosEvento({
        title: 'Caducidad',
        queueSlots: 1,
        tiers: [{ name: 'General', priceCents: 5000, capacity: 2 }],
      }),
    )
  ).event;
  const turno = await comprador.solicitar('/api/queue', 'POST', { eventId: eventoCaducidad.id });
  const reservaTemporal = (
    await comprador.solicitar('/api/reserve', 'POST', {
      eventId: eventoCaducidad.id,
      ticketId: turno.ticketId,
      tierId: eventoCaducidad.tiers[0].id,
      quantity: 2,
      requestKey: randomUUID(),
    })
  ).order;
  let entradasDisponibles = (await comprador.solicitar('/api/events')).events.find(
    (evento) => evento.id === eventoCaducidad.id,
  ).available;
  assert.equal(entradasDisponibles, 0);
  baseDatos = new DatabaseSync(rutaBaseDatos);
  baseDatos
    .prepare('UPDATE orders SET expires_at=? WHERE id=?')
    .run('2000-01-01T00:00:00.000Z', reservaTemporal.id);
  await comprador.solicitar(
    '/api/pay',
    'POST',
    { ...datosConfirmacion, reservationId: reservaTemporal.id },
    409,
  );
  entradasDisponibles = (await comprador.solicitar('/api/events')).events.find(
    (evento) => evento.id === eventoCaducidad.id,
  ).available;
  comprobar('Una reserva vencida no se confirma y libera su aforo', () =>
    assert.equal(entradasDisponibles, 2),
  );
  const turnoCancelacion = await comprador.solicitar('/api/queue', 'POST', {
    eventId: eventoCaducidad.id,
  });
  const pedidoCancelacion = (
    await comprador.solicitar('/api/reserve', 'POST', {
      eventId: eventoCaducidad.id,
      ticketId: turnoCancelacion.ticketId,
      tierId: eventoCaducidad.tiers[0].id,
      quantity: 2,
      requestKey: randomUUID(),
    })
  ).order;
  await comprador.solicitar('/api/orders', 'DELETE', { id: pedidoCancelacion.id });
  const disponiblesTrasCancelar = (await comprador.solicitar('/api/events')).events.find(
    (evento) => evento.id === eventoCaducidad.id,
  ).available;
  comprobar('Cancelar una reserva devuelve inmediatamente sus entradas', () =>
    assert.equal(disponiblesTrasCancelar, 2),
  );
  baseDatos
    .prepare('UPDATE queue SET expires_at=? WHERE id=?')
    .run('2000-01-01T00:00:00.000Z', turnos[1].ticketId);
  const turnoTrasVencimiento = await visitantes[2].solicitar(
    `/api/queue?ticketId=${turnos[2].ticketId}`,
  );
  comprobar('Un acceso vencido deja pasar al siguiente', () =>
    assert.equal(turnoTrasVencimiento.status, 'admitted'),
  );
  const eventoCompraMultiple = (
    await administrador.solicitar(
      '/api/admin/events',
      'POST',
      crearDatosEvento({
        title: 'Varias entradas',
        tiers: [{ name: 'General', priceCents: 2000, capacity: 20 }],
      }),
    )
  ).event;
  const turnoCompraMultiple = await comprador.solicitar('/api/queue', 'POST', {
    eventId: eventoCompraMultiple.id,
  });
  const pedidoCompraMultiple = (
    await comprador.solicitar('/api/reserve', 'POST', {
      eventId: eventoCompraMultiple.id,
      ticketId: turnoCompraMultiple.ticketId,
      tierId: eventoCompraMultiple.tiers[0].id,
      quantity: 3,
      requestKey: randomUUID(),
    })
  ).order;
  const confirmacionCompraMultiple = await comprador.solicitar('/api/pay', 'POST', {
    ...datosConfirmacion,
    reservationId: pedidoCompraMultiple.id,
  });
  comprobar('Compra de varias entradas: tres códigos distintos y total correcto', () => {
    assert.equal(
      new Set(confirmacionCompraMultiple.order.tickets.map((entrada) => entrada.code)).size,
      3,
    );
    assert.equal(confirmacionCompraMultiple.order.totalCents, 6000);
  });
  await administrador.solicitar(
    `/api/admin/events/${eventoCompraMultiple.id}`,
    'PUT',
    {
      ...crearDatosEvento({ title: 'Varias entradas' }),
      tiers: [{ ...eventoCompraMultiple.tiers[0], capacity: 2 }],
    },
    409,
  );
  comprobar('Editar un evento no reduce el aforo por debajo de lo vendido', () => {});
  const imagenInvalida = new FormData();
  imagenInvalida.set(
    'file',
    new File(['<svg>invalid</svg>'], 'malicioso.svg', { type: 'image/svg+xml' }),
  );
  await administrador.solicitar('/api/admin/upload', 'POST', imagenInvalida, 400);
  comprobar('Las subidas rechazan SVG y archivos de otro tipo', () => {});
  const imagenValida = new FormData();
  imagenValida.set(
    'file',
    new File(
      [await readFile(path.join(directorioProyecto, 'public', 'images', 'festival.jpg'))],
      'portada.jpg',
      { type: 'image/jpeg' },
    ),
  );
  const imagenSubida = await administrador.solicitar('/api/admin/upload', 'POST', imagenValida);
  const respuestaImagen = await fetch(urlServidor + imagenSubida.url);
  comprobar('Una portada JPG se sube y se sirve correctamente', () => {
    assert.equal(respuestaImagen.status, 200);
    assert.equal(respuestaImagen.headers.get('Content-Type'), 'image/jpeg');
  });
  await administrador.solicitar(`/api/admin/events/${borrador.id}`, 'PUT', {
    ...crearDatosEvento({ title: 'Con portada propia', image: imagenSubida.url }),
    tiers: eventoPublicado.tiers,
  });
  comprobar('Los eventos aceptan una portada subida por el organizador', () => {});
  const datosPanel = await administrador.solicitar('/api/metrics');
  comprobar('El panel refleja entradas e importes reales de la demo', () => {
    assert.equal(datosPanel.metrics.confirmed, 4);
    assert.equal(datosPanel.metrics.revenue, 18500);
    assert.ok(Array.isArray(datosPanel.queues));
  });

  // Una persona ocupa todo el proceso, incluso después de reservar y antes de confirmar.
  const eventoSecuencial = (
    await administrador.solicitar(
      '/api/admin/events',
      'POST',
      crearDatosEvento({ title: 'Compra secuencial' }),
    )
  ).event;
  const compradoresEnOrden = Array.from({ length: 4 }, () => new ClientePruebas());
  const turnosEnOrden = [];
  for (const cliente of compradoresEnOrden) {
    turnosEnOrden.push(
      await cliente.solicitar('/api/queue', 'POST', { eventId: eventoSecuencial.id }),
    );
  }
  async function reservarEnOrden(indice) {
    return (
      await compradoresEnOrden[indice].solicitar('/api/reserve', 'POST', {
        eventId: eventoSecuencial.id,
        ticketId: turnosEnOrden[indice].ticketId,
        tierId: eventoSecuencial.tiers[0].id,
        quantity: 1,
        requestKey: randomUUID(),
      })
    ).order;
  }
  const primeraReserva = await reservarEnOrden(0);
  const segundoEnEspera = await compradoresEnOrden[1].solicitar(
    `/api/queue?ticketId=${turnosEnOrden[1].ticketId}`,
  );
  comprobar('La segunda persona sigue en cola mientras la primera confirma su reserva', () => {
    assert.equal(segundoEnEspera.status, 'waiting');
    assert.equal(segundoEnEspera.ahead, 1);
  });
  await compradoresEnOrden[1].solicitar(
    '/api/reserve',
    'POST',
    {
      eventId: eventoSecuencial.id,
      ticketId: turnosEnOrden[1].ticketId,
      tierId: eventoSecuencial.tiers[0].id,
      quantity: 1,
      requestKey: randomUUID(),
    },
    409,
  );
  comprobar('Una persona en cola no puede saltar a la reserva', () => {});
  await compradoresEnOrden[0].solicitar('/api/pay', 'POST', {
    ...datosConfirmacion,
    reservationId: primeraReserva.id,
  });
  const segundoAdmitido = await compradoresEnOrden[1].solicitar(
    `/api/queue?ticketId=${turnosEnOrden[1].ticketId}`,
  );
  const terceroEnEspera = await compradoresEnOrden[2].solicitar(
    `/api/queue?ticketId=${turnosEnOrden[2].ticketId}`,
  );
  comprobar('Confirmar admite solo al siguiente comprador en orden', () => {
    assert.equal(segundoAdmitido.status, 'admitted');
    assert.equal(terceroEnEspera.status, 'waiting');
  });
  const segundaReserva = await reservarEnOrden(1);
  await compradoresEnOrden[1].solicitar('/api/orders', 'DELETE', { id: segundaReserva.id });
  const terceroAdmitido = await compradoresEnOrden[2].solicitar(
    `/api/queue?ticketId=${turnosEnOrden[2].ticketId}`,
  );
  comprobar('Cancelar la reserva deja pasar a la siguiente persona', () =>
    assert.equal(terceroAdmitido.status, 'admitted'),
  );
  const terceraReserva = await reservarEnOrden(2);
  baseDatos
    .prepare('UPDATE orders SET expires_at=? WHERE id=?')
    .run('2000-01-01T00:00:00.000Z', terceraReserva.id);
  const cuartoAdmitido = await compradoresEnOrden[3].solicitar(
    `/api/queue?ticketId=${turnosEnOrden[3].ticketId}`,
  );
  comprobar('Vencer la reserva deja pasar a la siguiente persona', () =>
    assert.equal(cuartoAdmitido.status, 'admitted'),
  );
  const ocupacionSecuencial = baseDatos
    .prepare(
      "SELECT (SELECT COUNT(*) FROM queue WHERE event_id=? AND status='admitted') + (SELECT COUNT(*) FROM orders WHERE event_id=? AND status='held' AND expires_at>?) AS cantidad",
    )
    .get(eventoSecuencial.id, eventoSecuencial.id, new Date().toISOString()).cantidad;
  comprobar('Nunca hay más de un proceso de compra activo por evento', () =>
    assert.equal(ocupacionSecuencial, 1),
  );
  await administrador.solicitar('/api/admin/session', 'DELETE');
  await administrador.solicitar('/api/metrics', 'GET', undefined, 401);
  comprobar('Cerrar sesión revoca el acceso administrativo', () => {});
  console.log(`\n${comprobaciones} comprobaciones aprobadas. Base de datos de prueba aislada.`);
} catch (error) {
  console.error(salidaServidor.slice(-6000));
  throw error;
} finally {
  baseDatos?.close();
  procesoServidor.kill();
  await Promise.race([
    once(procesoServidor, 'exit'),
    new Promise((resolver) => setTimeout(resolver, 3000)),
  ]);
  const directorioVerificado = path.resolve(directorioPruebas);
  assert.equal(path.dirname(directorioVerificado), path.resolve(directorioDatos));
  assert.match(path.basename(directorioVerificado), /^test-[0-9a-f-]{36}$/);
  await rm(directorioVerificado, { recursive: true, force: true });
}
