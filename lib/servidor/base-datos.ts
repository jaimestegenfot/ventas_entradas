import 'server-only';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@libsql/client/http';
import type { InValue, ResultSet } from '@libsql/client';
import { directorioDatos } from '../rutas';
import type { FilaBaseDatos } from './compartido';
import { obtenerFechaActual } from './fechas';
import { crearHashContrasena } from './seguridad';
import { esquemaBaseDatos } from './esquema';
import { crearEventosEjemplo } from './datos-ejemplo';
import { PERSONAS_COMPRANDO_POR_EVENTO } from '../configuracion';

export interface BaseDatos {
  prepare(sql: string): {
    get(...args: InValue[]): Promise<FilaBaseDatos | undefined>;
    all(...args: InValue[]): Promise<FilaBaseDatos[]>;
    run(...args: InValue[]): Promise<unknown>;
  };
}

type Operacion<T> = (baseDatos: BaseDatos) => Promise<T>;
type Conexion = { transaccion<T>(operacion: Operacion<T>, escritura?: boolean): Promise<T> };
const estadoGlobal = globalThis as unknown as { entradaConexion?: Promise<Conexion> };

function adaptarConexion(
  ejecutar: (sql: string, args: InValue[]) => Promise<ResultSet>,
): BaseDatos {
  return {
    prepare: (sql) => ({
      get: async (...args) => (await ejecutar(sql, args)).rows[0],
      all: async (...args) => (await ejecutar(sql, args)).rows,
      run: (...args) => ejecutar(sql, args),
    }),
  };
}

async function abrirConexion(): Promise<Conexion> {
  const url = process.env.TURSO_DATABASE_URL;
  let conexion: Conexion;
  if (url) {
    if (!/^(libsql|https):\/\//.test(url) || !process.env.TURSO_AUTH_TOKEN)
      throw new Error('Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN para la base remota.');
    const cliente = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    await cliente.executeMultiple(esquemaBaseDatos);
    conexion = {
      async transaccion(operacion, escritura = true) {
        // El bloqueo pertenece a la base remota y coordina todas las instancias.
        const transaccion = await cliente.transaction(escritura ? 'write' : 'read');
        try {
          const resultado = await operacion(
            adaptarConexion((sql, args) => transaccion.execute({ sql, args })),
          );
          await transaccion.commit();
          return resultado;
        } catch (error) {
          await transaccion.rollback().catch(() => {});
          throw error;
        } finally {
          transaccion.close();
        }
      },
    };
  } else {
    if (process.env.VERCEL)
      throw new Error(
        'Vercel requiere TURSO_DATABASE_URL y TURSO_AUTH_TOKEN; SQLite local no es persistente.',
      );
    if (process.env.TURSO_AUTH_TOKEN)
      throw new Error('Falta TURSO_DATABASE_URL para usar TURSO_AUTH_TOKEN.');
    const archivo = process.env.ENTRADA_DB_PATH || path.join(directorioDatos, 'entrada.sqlite');
    mkdirSync(path.dirname(archivo), { recursive: true });
    const { DatabaseSync } = await import('node:sqlite');
    const sqlite = new DatabaseSync(archivo);
    sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    sqlite.exec(esquemaBaseDatos);
    const baseDatos: BaseDatos = {
      prepare(sql) {
        const consulta = sqlite.prepare(sql);
        const parametros = (args: InValue[]) => args as (string | number | bigint | null)[];
        return {
          get: async (...args) => consulta.get(...parametros(args)),
          all: async (...args) => consulta.all(...parametros(args)),
          run: async (...args) => consulta.run(...parametros(args)),
        };
      },
    };
    let pendiente = Promise.resolve();
    conexion = {
      async transaccion(operacion, escritura = true) {
        const anterior = pendiente;
        let liberar!: () => void;
        pendiente = new Promise<void>((resolver) => {
          liberar = resolver;
        });
        await anterior;
        try {
          sqlite.exec(escritura ? 'BEGIN IMMEDIATE' : 'BEGIN');
          try {
            const resultado = await operacion(baseDatos);
            sqlite.exec('COMMIT');
            return resultado;
          } catch (error) {
            sqlite.exec('ROLLBACK');
            throw error;
          }
        } finally {
          liberar();
        }
      },
    };
  }
  await conexion.transaccion(async (baseDatos) => {
    await baseDatos
      .prepare('UPDATE events SET queue_slots=? WHERE queue_slots<>?')
      .run(PERSONAS_COMPRANDO_POR_EVENTO, PERSONAS_COMPRANDO_POR_EVENTO);
    if (!(await baseDatos.prepare('SELECT COUNT(*) AS count FROM events').get())!.count)
      await crearEventosEjemplo(baseDatos);
    if (!(await baseDatos.prepare("SELECT value FROM settings WHERE key='admin_hash'").get())) {
      if ((url || process.env.VERCEL) && !process.env.ADMIN_PASSWORD)
        throw new Error('Configura ADMIN_PASSWORD antes de inicializar la base remota.');
      const contrasena = process.env.ADMIN_PASSWORD || randomBytes(12).toString('base64url');
      const sal = randomBytes(16).toString('hex');
      await baseDatos
        .prepare('INSERT INTO settings(key,value) VALUES (?,?)')
        .run('admin_salt', sal);
      await baseDatos
        .prepare('INSERT INTO settings(key,value) VALUES (?,?)')
        .run('admin_hash', crearHashContrasena(contrasena, sal));
      if (!url && !process.env.ADMIN_PASSWORD) {
        mkdirSync(directorioDatos, { recursive: true });
        const archivo = path.join(directorioDatos, 'admin-access.txt');
        if (!existsSync(archivo))
          writeFileSync(
            archivo,
            `Panel: http://localhost:3000/admin\nContraseña: ${contrasena}\n`,
            { mode: 0o600 },
          );
      }
    }
  });
  return conexion;
}

function obtenerConexion() {
  estadoGlobal.entradaConexion ??= abrirConexion().catch((error) => {
    delete estadoGlobal.entradaConexion;
    throw error;
  });
  return estadoGlobal.entradaConexion;
}

export async function ejecutarLectura<T>(operacion: Operacion<T>): Promise<T> {
  return (await obtenerConexion()).transaccion(operacion, false);
}

export async function ejecutarTransaccion<T>(operacion: Operacion<T>): Promise<T> {
  return (await obtenerConexion()).transaccion(async (baseDatos) => {
    const ahora = obtenerFechaActual();
    await baseDatos
      .prepare("UPDATE orders SET status='expired' WHERE status='held' AND expires_at<=?")
      .run(ahora);
    await baseDatos
      .prepare(
        "UPDATE queue SET status='expired' WHERE status IN ('admitted','waiting') AND expires_at<=?",
      )
      .run(ahora);
    await baseDatos.prepare('DELETE FROM sessions WHERE expires_at<=?').run(ahora);
    return operacion(baseDatos);
  });
}
