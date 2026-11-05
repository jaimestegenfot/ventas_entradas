import { guardarEvento } from '../../../../lib/servidor/eventos';
import {
  responderError,
  responderJson,
  exigirAdministrador,
  verificarMismoOrigen,
} from '../../../../lib/api';
export async function POST(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    await exigirAdministrador();
    return responderJson({ event: guardarEvento(await solicitud.json()) });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
