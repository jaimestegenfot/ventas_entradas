import { registrarIngreso } from '../../../../lib/servidor/entradas';
import {
  responderError,
  responderDatosInvalidos,
  responderJson,
  exigirAdministrador,
  verificarMismoOrigen,
} from '../../../../lib/api';
export async function POST(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    await exigirAdministrador();
    const datosSolicitud = await solicitud.json();
    if (typeof datosSolicitud.code !== 'string' || datosSolicitud.code.length > 100)
      return responderDatosInvalidos();
    return responderJson(await registrarIngreso(datosSolicitud.code));
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
