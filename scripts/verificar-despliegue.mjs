// Valida nombres y formato; no conecta a servicios ni muestra secretos durante el build.
export function verificarDespliegue(entorno = process.env) {
  if (!entorno.VERCEL) return;
  const obligatorias = [
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'ADMIN_PASSWORD',
    'BLOB_READ_WRITE_TOKEN',
  ];
  const faltantes = obligatorias.filter((nombre) => !entorno[nombre]?.trim());
  if (faltantes.length)
    throw new Error(
      `Configura estas variables en Vercel antes de desplegar: ${faltantes.join(', ')}. Consulta README.md.`,
    );
  if (!/^(libsql|https):\/\//.test(entorno.TURSO_DATABASE_URL))
    throw new Error('TURSO_DATABASE_URL debe comenzar con libsql:// o https://.');
}

verificarDespliegue();
