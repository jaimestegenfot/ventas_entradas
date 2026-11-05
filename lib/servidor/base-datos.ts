import 'server-only';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { directorioDatos } from '../rutas';
import { FilaBaseDatos } from './compartido';
import { obtenerFechaActual } from './fechas';
import { crearHashContrasena } from './seguridad';
import { esquemaBaseDatos } from './esquema';
import { crearEventosEjemplo } from './datos-ejemplo';
import { PERSONAS_COMPRANDO_POR_EVENTO } from '../configuracion';

// Conexión SQLite, inicialización y transacciones para evitar reservas simultáneas sobre el mismo aforo.
const estadoGlobalBaseDatos = globalThis as unknown as { entradaDb?: DatabaseSync };

export function obtenerBaseDatos(): DatabaseSync {
  if (estadoGlobalBaseDatos.entradaDb) return estadoGlobalBaseDatos.entradaDb;
  mkdirSync(directorioDatos, { recursive: true });
  const baseDatos = new DatabaseSync(
    process.env.ENTRADA_DB_PATH || path.join(directorioDatos, 'entrada.sqlite'),
  );
  baseDatos.exec(esquemaBaseDatos);
  // Aplicar el mismo límite a los eventos creados con versiones anteriores.
  baseDatos
    .prepare('UPDATE events SET queue_slots=? WHERE queue_slots<>?')
    .run(PERSONAS_COMPRANDO_POR_EVENTO, PERSONAS_COMPRANDO_POR_EVENTO);
  estadoGlobalBaseDatos.entradaDb = baseDatos;
  if (!(baseDatos.prepare('SELECT COUNT(*) AS count FROM events').get() as FilaBaseDatos).count)
    crearEventosEjemplo(baseDatos);
  if (!baseDatos.prepare("SELECT value FROM settings WHERE key='admin_hash'").get()) {
    const contrasena = process.env.ADMIN_PASSWORD || randomBytes(12).toString('base64url');
    const salContrasena = randomBytes(16).toString('hex');
    baseDatos
      .prepare('INSERT INTO settings(key,value) VALUES (?,?)')
      .run('admin_salt', salContrasena);
    baseDatos
      .prepare('INSERT INTO settings(key,value) VALUES (?,?)')
      .run('admin_hash', crearHashContrasena(contrasena, salContrasena));
    if (!process.env.ADMIN_PASSWORD) {
      const archivoAccesoAdministrador = path.join(directorioDatos, 'admin-access.txt');
      if (!existsSync(archivoAccesoAdministrador))
        writeFileSync(
          archivoAccesoAdministrador,
          `Panel: http://localhost:3000/admin\nContraseña: ${contrasena}\n`,
          { mode: 0o600 },
        );
    }
  }
  return baseDatos;
}

export function ejecutarTransaccion<Resultado>(
  operacion: (baseDatos: DatabaseSync) => Resultado,
): Resultado {
  const baseDatos = obtenerBaseDatos();
  baseDatos.exec('BEGIN IMMEDIATE');
  try {
    liberarRegistrosVencidos(baseDatos);
    const resultado = operacion(baseDatos);
    baseDatos.exec('COMMIT');
    return resultado;
  } catch (error) {
    baseDatos.exec('ROLLBACK');
    throw error;
  }
}

function liberarRegistrosVencidos(baseDatos: DatabaseSync) {
  baseDatos
    .prepare("UPDATE orders SET status='expired' WHERE status='held' AND expires_at<=?")
    .run(obtenerFechaActual());
  baseDatos
    .prepare("UPDATE queue SET status='expired' WHERE status='admitted' AND expires_at<=?")
    .run(obtenerFechaActual());
  // El turno en espera caduca cuando el visitante deja de consultar durante dos minutos.
  baseDatos
    .prepare("UPDATE queue SET status='expired' WHERE status='waiting' AND expires_at<=?")
    .run(obtenerFechaActual());
  baseDatos.prepare('DELETE FROM sessions WHERE expires_at<=?').run(obtenerFechaActual());
}
