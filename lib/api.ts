import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ErrorOperacion } from './servidor/compartido';
import { esAdministrador } from './servidor/autenticacion';
import { SEGUNDOS_COOKIE_VISITANTE } from './configuracion';
export const nombreCookieVisitante = 'entrada_visitor';
export const nombreCookieAdministrador = 'entrada_admin';
export async function obtenerVisitante(crearSiNoExiste = false) {
  const cookiesGuardadas = await cookies();
  const valorActual = cookiesGuardadas.get(nombreCookieVisitante)?.value;
  if (esIdentificadorValido(valorActual)) return valorActual;
  if (!crearSiNoExiste) throw new ErrorOperacion('Inicia una compra para continuar.', 401);
  const id = randomUUID();
  cookiesGuardadas.set(nombreCookieVisitante, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SEGUNDOS_COOKIE_VISITANTE,
  });
  return id;
}
export async function exigirAdministrador() {
  const tokenSesion = (await cookies()).get(nombreCookieAdministrador)?.value;
  if (!esAdministrador(tokenSesion)) throw new ErrorOperacion('Inicia sesión para continuar.', 401);
  return tokenSesion!;
}
export function verificarMismoOrigen(solicitud: Request) {
  const origen = solicitud.headers.get('origin');
  if (origen && origen !== new URL(solicitud.url).origin)
    throw new ErrorOperacion('Solicitud no autorizada.', 403);
}
export function responderError(error: unknown) {
  if (error instanceof ErrorOperacion)
    return NextResponse.json({ error: error.message }, { status: error.estadoHttp });
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: 'Los datos enviados no son válidos.' }, { status: 400 });
  console.error('Error de Entrada:', error);
  return NextResponse.json(
    { error: 'No se pudo completar la operación. Inténtalo de nuevo.' },
    { status: 500 },
  );
}
export function esIdentificadorValido(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
  );
}
export const responderDatosInvalidos = () =>
  NextResponse.json({ error: 'Los datos enviados no son válidos.' }, { status: 400 });
export const responderJson = (datos: unknown) =>
  NextResponse.json(datos, { headers: { 'Cache-Control': 'no-store' } });
