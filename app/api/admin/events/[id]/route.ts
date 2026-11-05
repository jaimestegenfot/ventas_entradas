import { guardarEvento } from '../../../../../lib/servidor/eventos';
import {
  responderError,
  responderDatosInvalidos,
  responderJson,
  exigirAdministrador,
  verificarMismoOrigen,
  esIdentificadorValido,
} from '../../../../../lib/api';
export async function PUT(
  solicitud: Request,
  contexto: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    verificarMismoOrigen(solicitud);
    await exigirAdministrador();
    const { id } = await contexto.params;
    if (!esIdentificadorValido(id)) return responderDatosInvalidos();
    return responderJson({ event: await guardarEvento(await solicitud.json(), id) });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
