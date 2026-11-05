import { confirmarPedido } from '../../../lib/servidor/pedidos';
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
      !esIdentificadorValido(datosSolicitud.reservationId) ||
      typeof datosSolicitud.name !== 'string' ||
      typeof datosSolicitud.email !== 'string' ||
      datosSolicitud.acceptedTerms !== true
    )
      return responderDatosInvalidos();
    return responderJson({
      order: await confirmarPedido(
        datosSolicitud.reservationId,
        await obtenerVisitante(),
        datosSolicitud.name,
        datosSolicitud.email,
      ),
      mode: 'SIMULADO',
    });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
