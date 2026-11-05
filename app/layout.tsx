import type { Metadata } from 'next';
import './estilos.css';

export const metadata: Metadata = {
  title: 'Entrada. | Momentos que se quedan',
  description:
    'Descubre conciertos, festivales, teatro y experiencias. Encuentra tu próximo plan, compra tus entradas y vive el momento.',
};

export default function DisposicionPrincipal({
  children: contenido,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{contenido}</body>
    </html>
  );
}
