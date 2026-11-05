import { cancelarPedido, listarPedidosVisitante } from '../../../lib/servidor/pedidos';
import {
  responderError,
  responderDatosInvalidos,
  responderJson,
  verificarMismoOrigen,
  esIdentificadorValido,
  obtenerVisitante,
} from '../../../lib/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return responderJson({ orders: listarPedidosVisitante(await obtenerVisitante(true)) });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
export async function DELETE(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    const datosSolicitud = await solicitud.json();
    if (!esIdentificadorValido(datosSolicitud.id)) return responderDatosInvalidos();
    return responderJson(cancelarPedido(datosSolicitud.id, await obtenerVisitante()));
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
