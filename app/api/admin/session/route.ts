import { cookies } from 'next/headers';
import { SEGUNDOS_SESION_ADMINISTRADOR } from '../../../../lib/configuracion';
import {
  esAdministrador,
  iniciarSesionAdministrador,
  cerrarSesionAdministrador,
} from '../../../../lib/servidor/autenticacion';
import { ErrorOperacion } from '../../../../lib/servidor/compartido';
import {
  nombreCookieAdministrador,
  responderError,
  responderJson,
  verificarMismoOrigen,
} from '../../../../lib/api';
export const dynamic = 'force-dynamic';
const intentosAcceso = new Map<string, { count: number; until: number }>();
export async function GET() {
  try {
    return responderJson({
      authenticated: esAdministrador((await cookies()).get(nombreCookieAdministrador)?.value),
    });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
export async function POST(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    const direccionIp = solicitud.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
    const intentoAnterior = intentosAcceso.get(direccionIp);
    if (intentoAnterior && intentoAnterior.until > Date.now() && intentoAnterior.count >= 10)
      throw new ErrorOperacion('Demasiados intentos. Espera 15 minutos.', 429);
    const datosSolicitud = await solicitud.json();
    if (typeof datosSolicitud.password !== 'string' || datosSolicitud.password.length > 200)
      throw new ErrorOperacion('Escribe tu contraseña.', 400);
    let tokenSesion: string;
    try {
      tokenSesion = iniciarSesionAdministrador(datosSolicitud.password);
    } catch (errorCapturado) {
      intentosAcceso.set(direccionIp, {
        count:
          intentoAnterior && intentoAnterior.until > Date.now() ? intentoAnterior.count + 1 : 1,
        until:
          intentoAnterior && intentoAnterior.until > Date.now()
            ? intentoAnterior.until
            : Date.now() + 900000,
      });
      throw errorCapturado;
    }
    intentosAcceso.delete(direccionIp);
    (await cookies()).set(nombreCookieAdministrador, tokenSesion, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
      maxAge: SEGUNDOS_SESION_ADMINISTRADOR,
    });
    return responderJson({ authenticated: true });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
export async function DELETE(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    const cookiesGuardadas = await cookies();
    const tokenSesion = cookiesGuardadas.get(nombreCookieAdministrador)?.value;
    if (tokenSesion) cerrarSesionAdministrador(tokenSesion);
    cookiesGuardadas.delete(nombreCookieAdministrador);
    return responderJson({ ok: true });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
