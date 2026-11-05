import { reservarEntradas } from '../../../lib/servidor/pedidos';
import {
  responderError,
  responderDatosInvalidos,
  responderJson,
  verificarMismoOrigen,
  esIdentificadorValido,
  obtenerVisitante,
} from '../../../lib/api';
export const runtime = 'nodejs';
export async function POST(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    const datosSolicitud = await solicitud.json();
    if (
      !esIdentificadorValido(datosSolicitud.eventId) ||
      !esIdentificadorValido(datosSolicitud.ticketId) ||
      !esIdentificadorValido(datosSolicitud.requestKey) ||
      !esIdentificadorValido(datosSolicitud.tierId)
    )
      return responderDatosInvalidos();
    return responderJson({ order: reservarEntradas(datosSolicitud, await obtenerVisitante()) });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
