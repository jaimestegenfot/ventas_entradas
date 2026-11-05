import 'server-only';

// Fechas del servidor en formato ISO para guardar y comparar vencimientos.
export const obtenerFechaActual = () => new Date().toISOString();

export const calcularFechaFutura = (segundos: number) =>
  new Date(Date.now() + segundos * 1000).toISOString();
