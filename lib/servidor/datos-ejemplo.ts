import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { obtenerFechaActual } from './fechas';
import { PERSONAS_COMPRANDO_POR_EVENTO } from '../configuracion';

// Catálogo inicial. Solo se inserta si la base de datos todavía no contiene eventos.
export function crearEventosEjemplo(baseDatos: DatabaseSync) {
  const eventosEjemplo = [
    {
      identificadorUrl: 'selva-sonora',
      titulo: 'Selva Sonora',
      resumen: 'La Amazonía tiene su propio ritmo.',
      descripcion:
        'Una noche al aire libre para sentir la selva, descubrir artistas y cantar hasta que salga el sol. Música en vivo, gastronomía amazónica y un encuentro que se queda contigo. Apertura de puertas a las 17:00. Evento para mayores de 18 años.',
      recinto: 'Anfiteatro Amazónico',
      ciudad: 'Puerto Maldonado',
      fechaInicio: '2027-02-13T19:00:00-05:00',
      categoria: 'Festivales',
      imagen: '/images/festival.jpg',
      precioSoles: 85,
      aforoGeneral: 350,
      destacado: 1,
    },
    {
      identificadorUrl: 'lima-indie-sessions',
      titulo: 'Lima Indie Sessions',
      resumen: 'Tu nueva banda favorita está aquí.',
      descripcion:
        'Las voces que están cambiando la escena se encuentran en una noche íntima. Disfruta de cuatro bandas en vivo, una cuidada selección de vinilos y buena compañía. Apertura de puertas una hora antes del concierto.',
      recinto: 'CC. Barranco',
      ciudad: 'Lima',
      fechaInicio: '2027-01-23T20:00:00-05:00',
      categoria: 'Música',
      imagen: '/images/indie.jpg',
      precioSoles: 65,
      aforoGeneral: 180,
      destacado: 0,
    },
    {
      identificadorUrl: 'entre-nosotros',
      titulo: 'Entre nosotros',
      resumen: 'Hay historias que se viven de cerca.',
      descripcion:
        'Una puesta en escena sobre los encuentros inesperados y las cosas que nos unen. Teatro contemporáneo con un elenco local y una conversación con los artistas al terminar la función. Duración: 90 minutos.',
      recinto: 'Teatro Municipal',
      ciudad: 'Lima',
      fechaInicio: '2027-01-30T19:30:00-05:00',
      categoria: 'Teatro',
      imagen: '/images/theater.jpg',
      precioSoles: 45,
      aforoGeneral: 120,
      destacado: 0,
    },
    {
      identificadorUrl: 'atardecer-en-el-rio',
      titulo: 'Atardecer en el río',
      resumen: 'Desconecta. Respira. Vuelve a conectar.',
      descripcion:
        'Una experiencia guiada por el río Madre de Dios al caer la tarde. Incluye paseo en bote, degustación de productos locales y una sesión acústica a la orilla del río. Recomendamos llevar repelente y ropa cómoda.',
      recinto: 'Embarcadero Turístico',
      ciudad: 'Puerto Maldonado',
      fechaInicio: '2027-02-06T16:00:00-05:00',
      categoria: 'Experiencias',
      imagen: '/images/river.jpg',
      precioSoles: 120,
      aforoGeneral: 40,
      destacado: 0,
    },
    {
      identificadorUrl: 'noche-electrica',
      titulo: 'Noche Eléctrica',
      resumen: 'Una ciudad. Un beat. Toda la noche.',
      descripcion:
        'Una selección de DJs nacionales, instalaciones de luz y un sonido que se siente. Ven a bailar en una noche dedicada a la música electrónica. Solo para mayores de 18 años. Lleva tu documento de identidad.',
      recinto: 'Arena Costa Verde',
      ciudad: 'Lima',
      fechaInicio: '2027-02-20T21:00:00-05:00',
      categoria: 'Música',
      imagen: '/images/electronic.jpg',
      precioSoles: 90,
      aforoGeneral: 250,
      destacado: 0,
    },
    {
      identificadorUrl: 'corre-amazonia',
      titulo: 'Corre Amazonía · 10K',
      resumen: 'Cada kilómetro cuenta una historia.',
      descripcion:
        'Corre junto a la comunidad en una ruta rodeada de naturaleza. Inscripción con dorsal, hidratación y medalla de participación. Recoge tu kit el día anterior en el punto de partida. Salida a las 06:30.',
      recinto: 'Plaza de Armas',
      ciudad: 'Puerto Maldonado',
      fechaInicio: '2027-03-07T06:30:00-05:00',
      categoria: 'Deportes',
      imagen: '/images/running.jpg',
      precioSoles: 35,
      aforoGeneral: 300,
      destacado: 0,
    },
  ];
  baseDatos.exec('BEGIN IMMEDIATE');
  try {
    for (const eventoEjemplo of eventosEjemplo) {
      const id = randomUUID();
      baseDatos
        .prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(
          id,
          eventoEjemplo.identificadorUrl,
          eventoEjemplo.titulo,
          eventoEjemplo.resumen,
          eventoEjemplo.descripcion,
          eventoEjemplo.recinto,
          eventoEjemplo.ciudad,
          new Date(String(eventoEjemplo.fechaInicio)).toISOString(),
          eventoEjemplo.categoria,
          eventoEjemplo.imagen,
          'published',
          eventoEjemplo.destacado,
          PERSONAS_COMPRANDO_POR_EVENTO,
          obtenerFechaActual(),
        );
      baseDatos
        .prepare('INSERT INTO tiers VALUES (?,?,?,?,?)')
        .run(
          randomUUID(),
          id,
          'General',
          Number(eventoEjemplo.precioSoles) * 100,
          Number(eventoEjemplo.aforoGeneral),
        );
      if (eventoEjemplo.categoria === 'Música' || eventoEjemplo.categoria === 'Festivales')
        baseDatos
          .prepare('INSERT INTO tiers VALUES (?,?,?,?,?)')
          .run(
            randomUUID(),
            id,
            'Preferencial',
            (Number(eventoEjemplo.precioSoles) + 65) * 100,
            60,
          );
    }
    baseDatos.exec('COMMIT');
  } catch (errorCapturado) {
    baseDatos.exec('ROLLBACK');
    throw errorCapturado;
  }
}
