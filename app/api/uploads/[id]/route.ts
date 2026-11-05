import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { directorioImagenesSubidas } from '../../../../lib/rutas';
export async function GET(_solicitud: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(id))
    return new Response('No encontrada', { status: 404 });
  try {
    const datos = await readFile(path.join(directorioImagenesSubidas, id));
    return new Response(datos, {
      headers: {
        'Content-Type': id.endsWith('.jpg')
          ? 'image/jpeg'
          : id.endsWith('.png')
            ? 'image/png'
            : 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('No encontrada', { status: 404 });
  }
}
