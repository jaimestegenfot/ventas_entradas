import 'server-only';
import { scryptSync, createHash } from 'node:crypto';

// Hashes de contraseñas y tokens; nunca se guardan estos valores en texto plano en SQLite.
export function crearHashContrasena(contrasena: string, salContrasena: string) {
  return scryptSync(contrasena, salContrasena, 64).toString('hex');
}

export const crearHashToken = (tokenSesion: string) =>
  createHash('sha256').update(tokenSesion).digest('hex');
