import 'server-only';
import { FilaBaseDatos, ErrorOperacion } from './compartido';
import { obtenerFechaActual } from './fechas';
import { ejecutarTransaccion } from './base-datos';
import { obtenerInformacionPedido } from './pedidos';

// Validación y registro de un único ingreso por código de entrada.
export function registrarIngreso(codigo: string) {
  return ejecutarTransaccion((baseDatos) => {
    const registroEntrada = baseDatos
      .prepare('SELECT * FROM tickets WHERE code=?')
      .get(codigo.trim().toUpperCase()) as FilaBaseDatos | undefined;
    if (!registroEntrada)
      throw new ErrorOperacion('El código no corresponde a una entrada válida.', 404);
    if (registroEntrada.checked_in_at) throw new ErrorOperacion('Esta entrada ya fue utilizada.');
    baseDatos
      .prepare('UPDATE tickets SET checked_in_at=? WHERE id=?')
      .run(obtenerFechaActual(), registroEntrada.id);
    return {
      code: registroEntrada.code,
      order: obtenerInformacionPedido(
        baseDatos,
        baseDatos
          .prepare('SELECT * FROM orders WHERE id=?')
          .get(registroEntrada.order_id) as FilaBaseDatos,
      ),
    };
  });
}
