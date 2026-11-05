import 'server-only';

// Tipos de registros SQLite y errores controlados de la aplicación.
export type FilaBaseDatos = Record<string, any>;

export class ErrorOperacion extends Error {
  constructor(
    mensaje: string,
    public estadoHttp = 409,
  ) {
    super(mensaje);
  }
}
