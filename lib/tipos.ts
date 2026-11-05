/** Contratos JSON existentes. Los campos mantienen su nombre para conservar compatibilidad. */
export type CategoriaEvento = 'Música' | 'Teatro' | 'Festivales' | 'Experiencias' | 'Deportes';

/** Zona de entradas: nombre, precio en céntimos, aforo y disponibilidad actual. */
export type ZonaEntrada = {
  id: string;
  name: string;
  priceCents: number;
  capacity: number;
  available: number;
};
/** Evento del catálogo o del panel, con el inventario calculado por el servidor. */
export type InformacionEvento = {
  id: string;
  slug: string;
  title: string; // Título que aparece en la cartelera.
  subtitle: string;
  description: string;
  venue: string; // Recinto o lugar del evento.
  city: string;
  startsAt: string; // Fecha y hora de inicio en formato ISO.
  category: CategoriaEvento;
  image: string;
  status: 'published' | 'draft';
  featured: boolean;
  queueSlots: number; // Personas que pueden elegir entradas al mismo tiempo.
  priceCents: number;
  capacity: number;
  available: number;
  sold: number;
  tiers: ZonaEntrada[]; // Zonas: general, preferencial u otras definidas por el organizador.
};

/** Turno de la sala de espera y su fecha de vencimiento. */
export type EstadoCola = {
  ticketId: string;
  eventId: string;
  status: 'waiting' | 'admitted' | 'used' | 'expired' | 'cancelled';
  position: number;
  ahead: number; // Cantidad de personas que están por delante del visitante.
  expiresAt: string | null;
};
/** Pedido con sus datos de compra y códigos de entrada después de confirmarse. */
export type InformacionPedido = {
  id: string;
  eventId: string;
  eventTitle: string;
  image: string;
  venue: string;
  city: string;
  startsAt: string;
  tierName: string;
  quantity: number;
  totalCents: number; // Total del pedido en céntimos; nunca se calcula desde el precio del navegador.
  status: 'held' | 'confirmed' | 'expired' | 'cancelled';
  expiresAt: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  tickets: { id: string; code: string; checkedInAt: string | null }[]; // Entrada y fecha de ingreso.
};
export const categorias: CategoriaEvento[] = [
  'Música',
  'Teatro',
  'Festivales',
  'Experiencias',
  'Deportes',
];
export const formatearDinero = (centimos: number) =>
  new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 2,
  }).format(centimos / 100);
export const formatearFecha = (fecha: string, incluirAnio = false) =>
  new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: incluirAnio ? 'long' : 'short',
    ...(incluirAnio ? { year: 'numeric' } : {}),
    timeZone: 'America/Lima',
  }).format(new Date(fecha));
export const formatearHora = (fecha: string) =>
  new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima',
  }).format(new Date(fecha));
