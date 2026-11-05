import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PieSitio, EncabezadoSitio } from '../../../componentes/EstructuraSitio';
const contenidoLegal = {
  terminos: {
    title: 'Términos de la demostración',
    sections: [
      [
        'Una experiencia de prueba',
        'Entrada es una demostración de venta de entradas. Los eventos de ejemplo, las confirmaciones y las entradas emitidas permiten probar el proceso. No se realizan cobros ni se garantiza el acceso a eventos reales.',
      ],
      [
        'Turnos y reservas',
        'El acceso a la compra se asigna por orden de llegada a una sola persona por evento. Tienes cinco minutos para seleccionar tus entradas y diez minutos para confirmar la reserva. La siguiente persona pasa al finalizar, cancelar o vencer la compra anterior.',
      ],
      [
        'Tus entradas',
        'Cada entrada tiene un código único de un solo uso. Puedes abrirla e imprimirla o guardarla como PDF desde Mis entradas. No compartas el código con otras personas. Las entradas permanecen vinculadas a la cookie de este navegador.',
      ],
      [
        'Antes de vender entradas reales',
        'El responsable de la plataforma debe configurar una pasarela de pago, condiciones comerciales y de devolución, atención al comprador y el despliegue adecuado antes de habilitar ventas reales.',
      ],
    ],
  },
  privacidad: {
    title: 'Privacidad de la demostración',
    sections: [
      [
        'Qué se guarda',
        'Para gestionar las compras de prueba guardamos el nombre, el correo, el pedido y sus entradas. Una cookie de visitante relaciona las compras con este navegador. Los favoritos y la referencia de tu compra en curso se guardan en el almacenamiento local.',
      ],
      [
        'Para qué se utiliza',
        'Los datos permiten recuperar pedidos, mostrar las entradas y verificar códigos en el panel del organizador. Esta versión no envía correos, no utiliza publicidad ni recoge datos de tarjetas de pago.',
      ],
      [
        'Dónde se conserva',
        'Los registros y las imágenes subidas se almacenan en el equipo o servidor que ejecuta la aplicación. El administrador del proyecto controla ese almacenamiento y puede gestionar las solicitudes de eliminación antes de una puesta en producción.',
      ],
      [
        'Tu navegador',
        'Si borras las cookies o cambias de navegador, las compras de este dispositivo dejarán de aparecer. Guarda las entradas como PDF antes de borrar los datos del navegador.',
      ],
    ],
  },
};
export default async function PaginaLegal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in contenidoLegal)) notFound();
  const pagina = contenidoLegal[slug as keyof typeof contenidoLegal];
  return (
    <>
      <EncabezadoSitio />
      <main className="container legal-page">
        <span className="eyebrow">INFORMACIÓN DE ENTRADA</span>
        <h1>{pagina.title}</h1>
        {pagina.sections.map(([titulo, texto]) => (
          <section key={titulo}>
            <h2>{titulo}</h2>
            <p>{texto}</p>
          </section>
        ))}
        <Link href="/" className="button button-outline">
          Volver a los eventos →
        </Link>
      </main>
      <PieSitio />
    </>
  );
}
