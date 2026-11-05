import 'server-only';
import { SEGUNDOS_SESION_ADMINISTRADOR } from '../configuracion';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { FilaBaseDatos, ErrorOperacion } from './compartido';
import { obtenerFechaActual, calcularFechaFutura } from './fechas';
import { crearHashContrasena, crearHashToken } from './seguridad';
import { obtenerBaseDatos } from './base-datos';

// Inicio, comprobación y cierre de sesiones de administrador.
export function iniciarSesionAdministrador(contrasena: string) {
  const baseDatos = obtenerBaseDatos();
  const salContrasena = (
    baseDatos.prepare("SELECT value FROM settings WHERE key='admin_salt'").get() as FilaBaseDatos
  ).value;
  const hashGuardado = (
    baseDatos.prepare("SELECT value FROM settings WHERE key='admin_hash'").get() as FilaBaseDatos
  ).value;
  const hashCalculado = crearHashContrasena(contrasena, salContrasena);
  if (!timingSafeEqual(Buffer.from(hashGuardado, 'hex'), Buffer.from(hashCalculado, 'hex')))
    throw new ErrorOperacion('La contraseña no es correcta.', 401);
  const tokenSesion = randomBytes(32).toString('hex');
  baseDatos
    .prepare('INSERT INTO sessions VALUES (?,?)')
    .run(crearHashToken(tokenSesion), calcularFechaFutura(SEGUNDOS_SESION_ADMINISTRADOR));
  return tokenSesion;
}

export function esAdministrador(tokenSesion?: string) {
  return (
    !!tokenSesion &&
    !!obtenerBaseDatos()
      .prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires_at>?')
      .get(crearHashToken(tokenSesion), obtenerFechaActual())
  );
}

export function cerrarSesionAdministrador(tokenSesion: string) {
  obtenerBaseDatos()
    .prepare('DELETE FROM sessions WHERE token_hash=?')
    .run(crearHashToken(tokenSesion));
}
