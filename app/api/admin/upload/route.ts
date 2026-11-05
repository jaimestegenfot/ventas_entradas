import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { directorioImagenesSubidas } from '../../../../lib/rutas';
import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { MAXIMO_BYTES_IMAGEN } from '../../../../lib/configuracion';
import { ErrorOperacion } from '../../../../lib/servidor/compartido';
import {
  responderError,
  responderJson,
  exigirAdministrador,
  verificarMismoOrigen,
} from '../../../../lib/api';
export async function POST(solicitud: Request) {
  try {
    verificarMismoOrigen(solicitud);
    await exigirAdministrador();
    if (Number(solicitud.headers.get('content-length')) > MAXIMO_BYTES_IMAGEN + 64 * 1024)
      throw new ErrorOperacion('La imagen debe pesar como máximo 4 MB.', 400);
    const formulario = await solicitud.formData();
    const archivo = formulario.get('file');
    if (!(archivo instanceof File) || archivo.size > MAXIMO_BYTES_IMAGEN)
      throw new ErrorOperacion('Sube una imagen JPG, PNG o WebP de hasta 4 MB.', 400);
    const contenidoArchivo = Buffer.from(await archivo.arrayBuffer());
    const tipoArchivo =
      contenidoArchivo.subarray(0, 3).toString('hex') === 'ffd8ff'
        ? 'jpg'
        : contenidoArchivo.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
          ? 'png'
          : contenidoArchivo.subarray(0, 4).toString() === 'RIFF' &&
              contenidoArchivo.subarray(8, 12).toString() === 'WEBP'
            ? 'webp'
            : null;
    if (!tipoArchivo)
      throw new ErrorOperacion('El archivo no es una imagen JPG, PNG o WebP válida.', 400);
    const id = `${randomUUID()}.${tipoArchivo}`;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const imagen = await put(`eventos/${id}`, contenidoArchivo, {
        access: 'public',
        contentType: tipoArchivo === 'jpg' ? 'image/jpeg' : `image/${tipoArchivo}`,
        addRandomSuffix: false,
      });
      return responderJson({ url: imagen.url });
    }
    if (process.env.VERCEL)
      throw new Error('Conecta un almacén público Vercel Blob y configura BLOB_READ_WRITE_TOKEN.');
    await mkdir(directorioImagenesSubidas, { recursive: true });
    await writeFile(path.join(directorioImagenesSubidas, id), contenidoArchivo);
    return responderJson({ url: `/api/uploads/${id}` });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
