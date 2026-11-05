import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Refuerza las exclusiones de Next.js también al compilar desde Windows para --prebuilt.
export async function limpiarTrazas(directorio) {
  let eliminados = 0;
  async function recorrer(carpeta) {
    for (const archivo of await readdir(carpeta, { withFileTypes: true })) {
      if (archivo.name === 'node_modules' || archivo.name === 'cache') continue;
      const ruta = path.join(carpeta, archivo.name);
      if (archivo.isDirectory()) {
        await recorrer(ruta);
      } else if (archivo.name.endsWith('.nft.json')) {
        const traza = JSON.parse(await readFile(ruta, 'utf8'));
        const archivos = traza.files.filter((nombre) => {
          const normalizado = nombre.replaceAll('\\', '/');
          return !/(^|\/)\.data(\/|$)|(^|\/)\.env[^/]*$/.test(normalizado);
        });
        eliminados += traza.files.length - archivos.length;
        if (archivos.length !== traza.files.length)
          await writeFile(ruta, JSON.stringify({ ...traza, files: archivos }));
      }
    }
  }
  await recorrer(directorio);
  return eliminados;
}
