export async function consultarApi<Resultado>(
  url: string,
  metodo = 'GET',
  datosSolicitud?: unknown,
): Promise<Resultado> {
  const respuesta = await fetch(url, {
    method: metodo,
    headers:
      datosSolicitud instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    body:
      datosSolicitud === undefined
        ? undefined
        : datosSolicitud instanceof FormData
          ? datosSolicitud
          : JSON.stringify(datosSolicitud),
    cache: 'no-store',
  });
  let resultado;
  try {
    resultado = await respuesta.json();
  } catch {
    throw new Error('No pudimos conectar con el servidor. Inténtalo de nuevo.');
  }
  if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo completar la solicitud.');
  return resultado as Resultado;
}
