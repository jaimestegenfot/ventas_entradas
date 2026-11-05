import QRCode from 'qrcode';
import { obtenerDetalleEntrada } from '../../../../lib/servidor/pedidos';
import {
  responderError,
  responderDatosInvalidos,
  esIdentificadorValido,
  obtenerVisitante,
} from '../../../../lib/api';
import { formatearFecha, formatearHora, formatearDinero } from '../../../../lib/tipos';
const escaparHtml = (texto: string) =>
  texto.replace(
    /[&<>"']/g,
    (caracter) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter]!,
  );
export async function GET(solicitud: Request, contexto: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await contexto.params;
    if (!esIdentificadorValido(id)) return responderDatosInvalidos();
    const { ticket: entrada, order: pedido } = obtenerDetalleEntrada(id, await obtenerVisitante());
    const qr = await QRCode.toString(entrada.code, {
      type: 'svg',
      width: 220,
      margin: 1,
      color: { dark: '#24143eff', light: '#ffffffff' },
    });
    if (new URL(solicitud.url).searchParams.get('format') === 'qr')
      return new Response(qr, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store' },
      });
    const documentoHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entrada · ${escaparHtml(pedido.eventTitle)}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f6f4f0;padding:35px;color:#24143e}.ticket{max-width:680px;margin:auto;background:white;border:1px solid #ddd;border-radius:20px;overflow:hidden}.top{background:#6941d9;color:white;padding:28px}.top b{font-size:26px}h1{font-size:38px;margin:18px 0}.body{padding:30px}.grid{display:grid;grid-template-columns:1fr 220px;gap:20px}.code{font-family:monospace;font-size:14px}.muted{color:#777;font-size:13px}button{padding:14px 24px;border:0;background:#6941d9;color:white;border-radius:8px;margin:20px auto;display:block;cursor:pointer}svg{max-width:100%}@media print{body{background:white;padding:0}button{display:none}.ticket{border:1px solid #ddd}}@media(max-width:550px){body{padding:10px}.grid{grid-template-columns:1fr}h1{font-size:28px}}</style></head><body><div class="ticket"><div class="top"><b>entrada.</b><p>ENTRADA DE DEMOSTRACIÓN · SIN COBRO</p><h1>${escaparHtml(pedido.eventTitle)}</h1></div><div class="body"><div class="grid"><div><p class="muted">FECHA Y HORA</p><b>${escaparHtml(formatearFecha(pedido.startsAt, true))} · ${escaparHtml(formatearHora(pedido.startsAt))}</b><p class="muted">LUGAR</p><b>${escaparHtml(pedido.venue)} · ${escaparHtml(pedido.city)}</b><p class="muted">TITULAR</p><b>${escaparHtml(pedido.customerName)}</b><p>${escaparHtml(pedido.tierName)} · ${formatearDinero(pedido.totalCents / pedido.quantity)}</p><p class="muted">PEDIDO ${pedido.id.slice(0, 8).toUpperCase()}</p></div><div>${qr}<p class="code">${entrada.code}</p></div></div><hr><p class="muted">Código único de un solo uso. Presenta esta entrada y tu documento de identidad. Esta entrada pertenece a una compra simulada y no acredita acceso a un evento real.</p></div></div><button onclick="window.print()">Imprimir o guardar como PDF</button></body></html>`;
    return new Response(documentoHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="entrada-${entrada.code}.html"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (errorCapturado) {
    return responderError(errorCapturado);
  }
}
