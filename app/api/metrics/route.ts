import { obtenerDatosPanel } from '../../../lib/servidor/panel';
import { responderError, responderJson, exigirAdministrador } from '../../../lib/api';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await exigirAdministrador();
    return responderJson(obtenerDatosPanel());
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
