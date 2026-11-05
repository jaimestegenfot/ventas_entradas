import 'server-only';
import { SEGUNDOS_SESION_ADMINISTRADOR } from '../configuracion';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ErrorOperacion } from './compartido';
import { obtenerFechaActual, calcularFechaFutura } from './fechas';
import { crearHashContrasena, crearHashToken } from './seguridad';
import { ejecutarLectura, ejecutarTransaccion } from './base-datos';

export async function iniciarSesionAdministrador(contrasena: string) {
  return ejecutarTransaccion(async (baseDatos) => {
    const sal = (await baseDatos
      .prepare("SELECT value FROM settings WHERE key='admin_salt'")
      .get())!.value;
    const hash = (await baseDatos
      .prepare("SELECT value FROM settings WHERE key='admin_hash'")
      .get())!.value;
    const calculado = crearHashContrasena(contrasena, sal);
    if (!timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculado, 'hex')))
      throw new ErrorOperacion('La contraseña no es correcta.', 401);
    const token = randomBytes(32).toString('hex');
    await baseDatos
      .prepare('INSERT INTO sessions VALUES (?,?)')
      .run(crearHashToken(token), calcularFechaFutura(SEGUNDOS_SESION_ADMINISTRADOR));
    return token;
  });
}

export async function esAdministrador(tokenSesion?: string) {
  if (!tokenSesion) return false;
  return ejecutarLectura(
    async (baseDatos) =>
      !!(await baseDatos
        .prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires_at>?')
        .get(crearHashToken(tokenSesion), obtenerFechaActual())),
  );
}

export async function cerrarSesionAdministrador(tokenSesion: string) {
  return ejecutarTransaccion(async (baseDatos) => {
    await baseDatos
      .prepare('DELETE FROM sessions WHERE token_hash=?')
      .run(crearHashToken(tokenSesion));
  });
}
