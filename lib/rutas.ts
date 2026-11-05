import path from 'node:path';
export const directorioDatos = process.env.ENTRADA_DATA_DIR || path.join(process.cwd(), '.data');
export const directorioImagenesSubidas = path.join(directorioDatos, 'uploads');
