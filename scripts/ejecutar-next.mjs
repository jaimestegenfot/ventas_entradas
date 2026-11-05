import { spawn } from 'node:child_process';
import path from 'node:path';
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
      ...(['build', 'start'].includes(comando) ? { NEXT_DIST_DIR: '.next-production' } : {}),
    },
    windowsHide: true,
  },
);
procesoNext.on('exit', (codigoSalida) => process.exit(codigoSalida ?? 1));
procesoNext.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => procesoNext.kill(senal));
