import { entrarEnCola, salirDeCola, consultarTurno } from '../../../lib/servidor/cola';
import {
  responderError,
  responderDatosInvalidos,
  responderJson,
  verificarMismoOrigen,
  esIdentificadorValido,
  obtenerVisitante,
} from '../../../lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    const datosSolicitud = await solicitud.json();
    if (!esIdentificadorValido(datosSolicitud.eventId)) return responderDatosInvalidos();
    return responderJson(entrarEnCola(datosSolicitud.eventId, await obtenerVisitante(true)));
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
export async function GET(solicitud: Request) {
  try {
    const id = new URL(solicitud.url).searchParams.get('ticketId');
    if (!esIdentificadorValido(id)) return responderDatosInvalidos();
    return responderJson(consultarTurno(id, await obtenerVisitante()));
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
export async function DELETE(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    const datosSolicitud = await solicitud.json();
    if (!esIdentificadorValido(datosSolicitud.ticketId)) return responderDatosInvalidos();
    return responderJson(salirDeCola(datosSolicitud.ticketId, await obtenerVisitante()));
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
