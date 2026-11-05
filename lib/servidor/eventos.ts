import 'server-only';
import { PERSONAS_COMPRANDO_POR_EVENTO } from '../configuracion';
import type { BaseDatos } from './base-datos';
import { randomUUID } from 'node:crypto';
import type { InformacionEvento, CategoriaEvento } from '../tipos';
import { categorias } from '../tipos';
import { FilaBaseDatos, ErrorOperacion } from './compartido';
import { obtenerFechaActual } from './fechas';
import { ejecutarLectura, ejecutarTransaccion } from './base-datos';
// Consulta, publicación y edición de eventos, zonas, precios y aforos.
export async function listarEventos(
  incluirBorradores = false,
  conexion?: BaseDatos,
): Promise<InformacionEvento[]> {
  if (!conexion) return ejecutarLectura((baseDatos) => listarEventos(incluirBorradores, baseDatos));
  const eventos = await conexion
    .prepare(
      `SELECT e.*, (SELECT COALESCE(SUM(quantity),0) FROM orders WHERE event_id=e.id AND status='confirmed') AS sold FROM events e ${incluirBorradores ? '' : "WHERE status='published'"} ORDER BY featured DESC, starts_at`,
    )
    .all();
  const zonas = await conexion
    .prepare(
      `SELECT t.*, COALESCE(SUM(o.quantity),0) AS occupied FROM tiers t LEFT JOIN orders o ON o.tier_id=t.id AND (o.status='confirmed' OR (o.status='held' AND o.expires_at>?)) GROUP BY t.id ORDER BY t.price_cents`,
    )
    .all(obtenerFechaActual());
  return eventos.map((evento) =>
    componerInformacionEvento(
      evento,
      zonas.filter((zona) => zona.event_id === evento.id),
      evento.sold,
    ),
  );
}

export async function obtenerInformacionEvento(
  baseDatos: BaseDatos,
  registroEvento: FilaBaseDatos,
): Promise<InformacionEvento> {
  const zonas = await baseDatos
    .prepare(
      `SELECT t.*, COALESCE(SUM(o.quantity),0) AS occupied FROM tiers t LEFT JOIN orders o ON o.tier_id=t.id AND (o.status='confirmed' OR (o.status='held' AND o.expires_at>?)) WHERE t.event_id=? GROUP BY t.id ORDER BY t.price_cents`,
    )
    .all(obtenerFechaActual(), registroEvento.id);
  const vendidos = (await baseDatos
    .prepare(
      "SELECT COALESCE(SUM(quantity),0) AS n FROM orders WHERE event_id=? AND status='confirmed'",
    )
    .get(registroEvento.id))!.n;
  return componerInformacionEvento(registroEvento, zonas, vendidos);
}

function componerInformacionEvento(
  registro: FilaBaseDatos,
  registrosZonas: FilaBaseDatos[],
  vendidos: number,
): InformacionEvento {
  const zonas = registrosZonas.map((zona) => ({
    id: zona.id,
    name: zona.name,
    priceCents: zona.price_cents,
    capacity: zona.capacity,
    available: Math.max(0, zona.capacity - zona.occupied),
  }));
  return {
    id: registro.id,
    slug: registro.slug,
    title: registro.title,
    subtitle: registro.subtitle,
    description: registro.description,
    venue: registro.venue,
    city: registro.city,
    startsAt: registro.starts_at,
    category: registro.category,
    image: registro.image,
    status: registro.status,
    featured: !!registro.featured,
    queueSlots: PERSONAS_COMPRANDO_POR_EVENTO,
    tiers: zonas,
    priceCents: Math.min(...zonas.map((zona) => zona.priceCents)),
    capacity: zonas.reduce((n, zona) => n + zona.capacity, 0),
    available: zonas.reduce((n, zona) => n + zona.available, 0),
    sold: vendidos,
  };
}

export async function obtenerEventoPublicado(baseDatos: BaseDatos, id: string) {
  const registroEvento = (await baseDatos
    .prepare("SELECT * FROM events WHERE id=? AND status='published'")
    .get(id)) as FilaBaseDatos | undefined;
  if (!registroEvento) throw new ErrorOperacion('El evento no está disponible.', 404);
  if (new Date(registroEvento.starts_at).getTime() <= Date.now())
    throw new ErrorOperacion('La venta para este evento ha finalizado.');
  return registroEvento;
}
export async function guardarEvento(datosEvento: FilaBaseDatos, id?: string) {
  return await ejecutarTransaccion(async (baseDatos) => {
    const camposObligatorios = [
      'title',
      'description',
      'venue',
      'city',
      'startsAt',
      'category',
      'image',
    ];
    for (const clave of camposObligatorios)
      if (
        typeof datosEvento[clave] !== 'string' ||
        !datosEvento[clave].trim() ||
        datosEvento[clave].length > (clave === 'description' ? 5000 : clave === 'image' ? 500 : 150)
      )
        throw new ErrorOperacion('Completa todos los campos del evento.', 400);
    if (
      !categorias.includes(datosEvento.category as CategoriaEvento) ||
      !['published', 'draft'].includes(datosEvento.status)
    )
      throw new ErrorOperacion('Categoría o estado inválido.', 400);
    if (!Number.isFinite(Date.parse(datosEvento.startsAt)))
      throw new ErrorOperacion('Selecciona una fecha válida.', 400);
    if (new Date(datosEvento.startsAt).getTime() <= Date.now())
      throw new ErrorOperacion('La fecha debe estar en el futuro.', 400);
    if (
      !/^\/(images\/[a-zA-Z0-9._-]+|api\/uploads\/[a-zA-Z0-9.-]+)$/.test(datosEvento.image) &&
      !/^https:\/\/[^\s]+$/.test(datosEvento.image)
    )
      throw new ErrorOperacion('Usa una imagen de la biblioteca o una URL https.', 400);
    if (
      datosEvento.queueSlots !== undefined &&
      datosEvento.queueSlots !== PERSONAS_COMPRANDO_POR_EVENTO
    )
      throw new ErrorOperacion('Solo puede comprar una persona a la vez por evento.', 400);
    if (
      !Array.isArray(datosEvento.tiers) ||
      datosEvento.tiers.length < 1 ||
      datosEvento.tiers.length > 5
    )
      throw new ErrorOperacion('Añade entre 1 y 5 zonas.', 400);
    const nombresZonas = new Set<string>();
    for (const registroZona of datosEvento.tiers) {
      if (
        typeof registroZona.name !== 'string' ||
        !registroZona.name.trim() ||
        registroZona.name.length > 60 ||
        nombresZonas.has(registroZona.name.trim().toLowerCase()) ||
        !Number.isInteger(registroZona.priceCents) ||
        registroZona.priceCents < 0 ||
        registroZona.priceCents > 10000000 ||
        !Number.isInteger(registroZona.capacity) ||
        registroZona.capacity < 1 ||
        registroZona.capacity > 100000
      )
        throw new ErrorOperacion('Revisa los nombres, precios y aforos de las zonas.', 400);
      nombresZonas.add(registroZona.name.trim().toLowerCase());
    }
    const eventoAnterior = id
      ? ((await baseDatos.prepare('SELECT * FROM events WHERE id=?').get(id)) as
          FilaBaseDatos | undefined)
      : undefined;
    if (id && !eventoAnterior) throw new ErrorOperacion('Evento no encontrado.', 404);
    const idEvento = id || randomUUID();
    const identificadorUrl =
      eventoAnterior?.slug ||
      `${datosEvento.title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}-${idEvento.slice(0, 6)}`;
    if (datosEvento.featured && datosEvento.status === 'published')
      await baseDatos.prepare('UPDATE events SET featured=0').run();
    if (eventoAnterior) {
      const zonasAnteriores = (await baseDatos
        .prepare('SELECT * FROM tiers WHERE event_id=?')
        .all(idEvento)) as FilaBaseDatos[];
      for (const registroZona of zonasAnteriores) {
        const zonaActualizada = datosEvento.tiers.find(
          (zonaPropuesta: FilaBaseDatos) => zonaPropuesta.id === registroZona.id,
        );
        const aforoOcupado = (
          (await baseDatos
            .prepare(
              "SELECT COALESCE(SUM(quantity),0) AS n FROM orders WHERE tier_id=? AND (status='confirmed' OR (status='held' AND expires_at>?))",
            )
            .get(registroZona.id, obtenerFechaActual())) as FilaBaseDatos
        ).n;
        if (
          aforoOcupado &&
          (!zonaActualizada ||
            zonaActualizada.capacity < aforoOcupado ||
            zonaActualizada.name !== registroZona.name)
        )
          throw new ErrorOperacion(
            'Una zona con entradas vendidas o reservadas debe conservar su nombre y aforo mínimo.',
          );
        if (
          !zonaActualizada &&
          (await baseDatos.prepare('SELECT 1 FROM orders WHERE tier_id=?').get(registroZona.id))
        )
          throw new ErrorOperacion('No puedes eliminar una zona que tiene pedidos.');
        if (!zonaActualizada)
          await baseDatos.prepare('DELETE FROM tiers WHERE id=?').run(registroZona.id);
      }
      await baseDatos
        .prepare(
          'UPDATE events SET title=?,subtitle=?,description=?,venue=?,city=?,starts_at=?,category=?,image=?,status=?,featured=?,queue_slots=? WHERE id=?',
        )
        .run(
          datosEvento.title.trim(),
          String(datosEvento.subtitle || '').slice(0, 150),
          datosEvento.description.trim(),
          datosEvento.venue.trim(),
          datosEvento.city.trim(),
          new Date(datosEvento.startsAt).toISOString(),
          datosEvento.category,
          datosEvento.image,
          datosEvento.status,
          datosEvento.featured ? 1 : 0,
          PERSONAS_COMPRANDO_POR_EVENTO,
          idEvento,
        );
    } else
      await baseDatos
        .prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(
          idEvento,
          identificadorUrl,
          datosEvento.title.trim(),
          String(datosEvento.subtitle || '').slice(0, 150),
          datosEvento.description.trim(),
          datosEvento.venue.trim(),
          datosEvento.city.trim(),
          new Date(datosEvento.startsAt).toISOString(),
          datosEvento.category,
          datosEvento.image,
          datosEvento.status,
          datosEvento.featured ? 1 : 0,
          PERSONAS_COMPRANDO_POR_EVENTO,
          obtenerFechaActual(),
        );
    for (const registroZona of datosEvento.tiers) {
      const registroExistente =
        registroZona.id &&
        (await baseDatos
          .prepare('SELECT id FROM tiers WHERE id=? AND event_id=?')
          .get(registroZona.id, idEvento));
      if (registroExistente)
        await baseDatos
          .prepare('UPDATE tiers SET name=?,price_cents=?,capacity=? WHERE id=?')
          .run(
            registroZona.name.trim(),
            registroZona.priceCents,
            registroZona.capacity,
            registroZona.id,
          );
      else
        await baseDatos
          .prepare('INSERT INTO tiers VALUES (?,?,?,?,?)')
          .run(
            randomUUID(),
            idEvento,
            registroZona.name.trim(),
            registroZona.priceCents,
            registroZona.capacity,
          );
    }
    return await obtenerInformacionEvento(
      baseDatos,
      (await baseDatos.prepare('SELECT * FROM events WHERE id=?').get(idEvento)) as FilaBaseDatos,
    );
  });
}
