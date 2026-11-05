import { listarEventos } from '../../../lib/servidor/eventos';
import { responderError, responderJson, obtenerVisitante } from '../../../lib/api';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  try {
    await obtenerVisitante(true);
    return responderJson({ events: await listarEventos(), mode: 'demo' });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
