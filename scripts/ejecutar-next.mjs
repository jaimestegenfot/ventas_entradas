import { spawn } from 'node:child_process';
import path from 'node:path';
import { limpiarTrazas } from './limpiar-trazas.mjs';
const comando = process.argv[2] || 'dev';
const procesoNext = spawn(
  process.execPath,
  [
    path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'),
    comando,
    ...process.argv.slice(3),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(!process.env.VERCEL && ['build', 'start'].includes(comando)
        ? { NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-production' }
        : {}),
    },
    windowsHide: true,
  },
);
procesoNext.on('exit', async (codigoSalida) => {
  if (codigoSalida === 0 && comando === 'build') {
    try {
      const carpetaSalida = process.env.VERCEL
        ? '.next'
        : process.env.NEXT_DIST_DIR || '.next-production';
      const eliminados = await limpiarTrazas(path.join(process.cwd(), carpetaSalida));
      if (eliminados)
        console.log(`Excluidas ${eliminados} referencias a datos locales de las trazas.`);
    } catch (error) {
      console.error('No se pudo verificar el contenido del despliegue:', error.message);
      process.exit(1);
    }
  }
  process.exit(codigoSalida ?? 1);
});
procesoNext.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => procesoNext.kill(senal));
