'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EncabezadoSitio, PieSitio } from '../componentes/EstructuraSitio';
import { Icono } from '../componentes/Icono';
import { ProcesoCompra, claveCompraActiva } from '../componentes/ProcesoCompra';
import { consultarApi } from '../lib/cliente';
import { categorias, formatearFecha, formatearDinero, type InformacionEvento } from '../lib/tipos';
const iconosPorCategoria: Record<string, string> = {
  Música: 'music',
  Teatro: 'theater',
  Festivales: 'sparkle',
  Experiencias: 'leaf',
  Deportes: 'sport',
};
export default function PaginaInicio() {
  const [eventos, establecerEventos] = useState<InformacionEvento[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState('');
  const [categoria, establecerCategoria] = useState('Todos');
  const [ciudad, establecerCiudad] = useState('Todas las ciudades');
  const [busqueda, establecerBusqueda] = useState('');
  const [orden, establecerOrden] = useState('recommended');
  const [eventoSeleccionado, establecerEventoSeleccionado] = useState<InformacionEvento | null>(
    null,
  );
  const [idCompraActiva, establecerIdCompraActiva] = useState<string | null>(null);
  const [favoritos, establecerFavoritos] = useState<string[]>([]);
  const [soloFavoritos, establecerSoloFavoritos] = useState(false);
  const actualizarEventos = useCallback(async () => {
    try {
      const respuesta = await consultarApi<{ events: InformacionEvento[] }>('/api/events');
      establecerEventos(respuesta.events);
      establecerError('');
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerCargando(false);
    }
  }, []);
  useEffect(() => {
    void actualizarEventos();
    try {
      establecerFavoritos(JSON.parse(localStorage.getItem('entrada-favorites') || '[]'));
      establecerIdCompraActiva(
        JSON.parse(localStorage.getItem(claveCompraActiva) || 'null')?.eventId || null,
      );
    } catch {}
  }, [actualizarEventos]);
  const eventoDestacado = eventos.find((evento) => evento.featured) || eventos[0];
  const eventosFiltrados = useMemo(
    () =>
      eventos
        .filter((evento) => {
          const normalizarTexto = (texto: string) =>
            texto
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();
          return (
            (categoria === 'Todos' || evento.category === categoria) &&
            (ciudad === 'Todas las ciudades' || evento.city === ciudad) &&
            (!soloFavoritos || favoritos.includes(evento.id)) &&
            normalizarTexto(
              `${evento.title} ${evento.city} ${evento.venue} ${evento.category}`,
            ).includes(normalizarTexto(busqueda))
          );
        })
        .sort((eventoAnterior, eventoSiguiente) =>
          orden === 'price'
            ? eventoAnterior.priceCents - eventoSiguiente.priceCents
            : orden === 'date'
              ? Date.parse(eventoAnterior.startsAt) - Date.parse(eventoSiguiente.startsAt)
              : Number(eventoSiguiente.featured) - Number(eventoAnterior.featured),
        ),
    [eventos, categoria, ciudad, busqueda, orden, soloFavoritos, favoritos],
  );
  function alternarFavorito(id: string) {
    const favoritosActualizados = favoritos.includes(id)
      ? favoritos.filter((idFavorito) => idFavorito !== id)
      : [...favoritos, id];
    establecerFavoritos(favoritosActualizados);
    localStorage.setItem('entrada-favorites', JSON.stringify(favoritosActualizados));
  }
  function cerrarCompra() {
    establecerEventoSeleccionado(null);
    try {
      establecerIdCompraActiva(
        JSON.parse(localStorage.getItem(claveCompraActiva) || 'null')?.eventId || null,
      );
    } catch {
      establecerIdCompraActiva(null);
    }
  }
  return (
    <>
      <EncabezadoSitio />
      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="little-star">✳</span> SAL DE LA RUTINA. ENTRA EN EL MOMENTO.
            </div>
            <h1>
              Hay planes.
              <br />Y hay{' '}
              <span>
                momentos
                <br className="desktop-break" /> que se quedan.
              </span>
            </h1>
            <p>
              La música que te mueve. La historia que te atrapa.
              <br className="desktop-break" /> Tu próximo «tenías que estar ahí» empieza aquí.
            </p>
            <a href="#eventos" className="button button-primary hero-button">
              Encuentra tu próximo plan
              <Icono nombre="arrow" tamano={20} />
            </a>
            <div className="hero-proof">
              <div className="proof-symbols">
                <span>♫</span>
                <span>✳</span>
                <span>↗</span>
              </div>
              <div>
                <b>Más momentos. Menos vueltas.</b>
                <span>Entradas digitales, de principio a fin.</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <img
              className="hero-photo"
              src={eventoDestacado?.image || '/images/festival.jpg'}
              alt={
                eventoDestacado
                  ? `Portada de ${eventoDestacado.title}`
                  : 'Luces y público disfrutando de un concierto en vivo'
              }
              fetchPriority="high"
            />
            <div className="hero-image-shade" />
            <div className="hero-live">
              <span />
              UN PLAN PARA RECORDAR
            </div>
            <div className="hero-star">✳</div>
            <div className="hero-featured">
              <div className="featured-label">
                <span>EN EL RADAR</span>
                <span>01 / {String(eventos.length || 6).padStart(2, '0')}</span>
              </div>
              <h2>{eventoDestacado?.title || 'Selva Sonora'}</h2>
              <p>
                <Icono nombre="pin" tamano={14} />
                {eventoDestacado?.city || 'Puerto Maldonado'}
                <span>·</span>
                {eventoDestacado ? formatearFecha(eventoDestacado.startsAt) : '13 feb'}
              </p>
              <button
                className="hero-event-link"
                aria-label="Ver el evento destacado"
                onClick={() => eventoDestacado && establecerEventoSeleccionado(eventoDestacado)}
                disabled={!eventoDestacado}
              >
                <Icono nombre="arrow" tamano={24} />
              </button>
            </div>
            <div className="floating-ticket">
              <Icono nombre="ticket" tamano={21} />
              <div>
                <b>Tu entrada a algo increíble.</b>
                <span>El resto es vivirlo.</span>
              </div>
              <span className="floating-check">
                <Icono nombre="check" tamano={15} />
              </span>
            </div>
          </div>
        </section>
        <div className="ticker" aria-hidden="true">
          <div>
            <span>MENOS SCROLL, MÁS RECUERDOS</span>
            <b>✳</b>
            <span>BUENA MÚSICA. BUENA COMPAÑÍA.</span>
            <b>✳</b>
            <span>LA PRÓXIMA HISTORIA EMPIEZA AQUÍ</span>
            <b>✳</b>
            <span>HAZLE ESPACIO AL PLAN</span>
            <b>✳</b>
          </div>
        </div>

        <section className="events-section container" id="eventos">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TU AGENDA PIDE ALGO BUENO</span>
              <h2>
                Encuentra tu próximo <em>«vamos».</em>
              </h2>
            </div>
            <p>
              Grandes noches, pequeños descubrimientos.
              <br />
              Hay un plan que tiene tu nombre.
            </p>
          </div>
          {idCompraActiva && eventos.find((evento) => evento.id === idCompraActiva) && (
            <div className="resume-banner">
              <Icono nombre="ticket" />
              <span>
                Tu compra sigue en curso. Retoma tu lugar en{' '}
                <b>{eventos.find((evento) => evento.id === idCompraActiva)?.title}</b>.
              </span>
              <button
                onClick={() =>
                  establecerEventoSeleccionado(
                    eventos.find((evento) => evento.id === idCompraActiva)!,
                  )
                }
              >
                Continuar
                <Icono nombre="arrow" tamano={17} />
              </button>
            </div>
          )}
          <div className="search-bar">
            <label className="search-input">
              <Icono nombre="search" />
              <input
                type="search"
                value={busqueda}
                onChange={(eventoInterfaz) => establecerBusqueda(eventoInterfaz.target.value)}
                placeholder="Busca un artista, evento o lugar…"
                aria-label="Buscar eventos"
              />
            </label>
            <label className="city-select">
              <Icono nombre="pin" tamano={19} />
              <select
                value={ciudad}
                onChange={(eventoInterfaz) => establecerCiudad(eventoInterfaz.target.value)}
                aria-label="Filtrar por ciudad"
              >
                <option>Todas las ciudades</option>
                {Array.from(new Set(eventos.map((evento) => evento.city))).map(
                  (categoriaDisponible) => (
                    <option key={categoriaDisponible}>{categoriaDisponible}</option>
                  ),
                )}
              </select>
              <Icono nombre="down" tamano={15} />
            </label>
            <button
              className="button button-primary search-submit"
              onClick={() =>
                document
                  .querySelector('#event-grid')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              Buscar planes
              <Icono nombre="search" tamano={18} />
            </button>
          </div>
          <div className="filter-row">
            <div className="category-tabs" role="group" aria-label="Categorías">
              <button
                className={categoria === 'Todos' ? 'active' : ''}
                onClick={() => establecerCategoria('Todos')}
              >
                <Icono nombre="grid" tamano={17} />
                Todos los planes
              </button>
              {categorias.map((categoriaDisponible) => (
                <button
                  className={categoria === categoriaDisponible ? 'active' : ''}
                  onClick={() => establecerCategoria(categoriaDisponible)}
                  key={categoriaDisponible}
                >
                  <Icono nombre={iconosPorCategoria[categoriaDisponible]} tamano={18} />
                  {categoriaDisponible}
                </button>
              ))}
            </div>
            <button
              className={`favorite-filter ${soloFavoritos ? 'active' : ''}`}
              onClick={() => establecerSoloFavoritos((valorActual) => !valorActual)}
              aria-pressed={soloFavoritos}
              aria-label="Mostrar favoritos"
            >
              <Icono nombre="heart" tamano={19} />
              <span>Guardados</span>
            </button>
          </div>
          <div className="results-header">
            <p>
              <b>{cargando ? '…' : eventosFiltrados.length}</b> planes para salir de lo de siempre
            </p>
            <label>
              Ordenar por:{' '}
              <select
                aria-label="Ordenar eventos"
                value={orden}
                onChange={(eventoInterfaz) => establecerOrden(eventoInterfaz.target.value)}
              >
                <option value="recommended">Recomendados</option>
                <option value="date">Más próximos</option>
                <option value="price">Menor precio</option>
              </select>
              <Icono nombre="down" tamano={13} />
            </label>
          </div>
          {error && (
            <div className="notice error" role="alert">
              <span>{error}</span>
              <button
                className="text-button"
                onClick={() => {
                  establecerCargando(true);
                  void actualizarEventos();
                }}
              >
                Reintentar
              </button>
            </div>
          )}
          <div className="event-grid" id="event-grid">
            {cargando
              ? Array.from({ length: 6 }, (_, indice) => (
                  <div className="event-skeleton" key={indice}>
                    <div />
                    <span />
                    <span />
                  </div>
                ))
              : eventosFiltrados.map((evento) => (
                  <article className="event-card" key={evento.id}>
                    <button
                      className="event-card-image"
                      onClick={() => establecerEventoSeleccionado(evento)}
                      aria-label={`Ver ${evento.title}`}
                    >
                      <img src={evento.image} alt={evento.title} loading="lazy" />
                      <span className={`image-chip ${evento.featured ? 'chip-yellow' : ''}`}>
                        {evento.featured ? (
                          <>
                            <Icono nombre="sparkle" tamano={12} /> Destacado
                          </>
                        ) : (
                          evento.category
                        )}
                      </span>
                      <div className="card-image-shade" />
                      <span className="image-cta">
                        Esto hay que vivirlo <Icono nombre="arrow" tamano={17} />
                      </span>
                    </button>
                    <button
                      className={`save-event ${favoritos.includes(evento.id) ? 'saved' : ''}`}
                      aria-label={`${favoritos.includes(evento.id) ? 'Quitar de' : 'Guardar en'} favoritos: ${evento.title}`}
                      aria-pressed={favoritos.includes(evento.id)}
                      onClick={() => alternarFavorito(evento.id)}
                    >
                      <Icono nombre="heart" tamano={18} />
                    </button>
                    <div className="card-content">
                      <div className="card-date">
                        <Icono nombre="calendar" tamano={14} />
                        {formatearFecha(evento.startsAt, true)}
                        <span>·</span>
                        {evento.category}
                      </div>
                      <button
                        className="card-title"
                        onClick={() => establecerEventoSeleccionado(evento)}
                      >
                        <h3>{evento.title}</h3>
                      </button>
                      <p className="card-location">
                        <Icono nombre="pin" tamano={15} />
                        {evento.venue} · {evento.city}
                      </p>
                      <div className="card-bottom">
                        <span>
                          Desde <b>{formatearDinero(evento.priceCents)}</b>
                        </span>
                        <button
                          onClick={() => establecerEventoSeleccionado(evento)}
                          disabled={
                            evento.available === 0 ||
                            new Date(evento.startsAt).getTime() <= Date.now()
                          }
                        >
                          {new Date(evento.startsAt).getTime() <= Date.now()
                            ? 'Finalizado'
                            : evento.available
                              ? 'Quiero ir'
                              : 'Agotado'}
                          <Icono nombre="arrow" tamano={17} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
          </div>
          {!cargando && !error && eventosFiltrados.length === 0 && (
            <div className="empty-state">
              <Icono nombre="search" tamano={36} />
              <h3>El próximo plan está por aparecer.</h3>
              <p>Prueba otra búsqueda o explora todas las categorías.</p>
              <button
                className="button button-outline"
                onClick={() => {
                  establecerCategoria('Todos');
                  establecerCiudad('Todas las ciudades');
                  establecerBusqueda('');
                  establecerSoloFavoritos(false);
                }}
              >
                Ver todos los eventos
                <Icono nombre="arrow" tamano={17} />
              </button>
            </div>
          )}
          <p className="catalog-footnote">
            <Icono nombre="sparkle" tamano={15} />
            Los mejores planes no siempre se planean. Encuentra el tuyo.
          </p>
        </section>
        <section className="how-section" id="como-funciona">
          <div className="container">
            <div className="how-top">
              <div>
                <span className="eyebrow">TÚ PON LAS GANAS</span>
                <h2>
                  Del «¿y si vamos?»
                  <br />
                  al <em>«qué buena noche».</em>
                </h2>
              </div>
              <p>
                Comprar tu entrada debería ser
                <br />
                la parte más fácil del plan.
              </p>
            </div>
            <div className="how-grid">
              <div>
                <span className="step-number">01</span>
                <Icono nombre="search" tamano={27} />
                <h3>Encuentra tu plan</h3>
                <p>
                  Explora eventos, descubre algo nuevo
                  <br />y elige dónde quieres estar.
                </p>
              </div>
              <div>
                <span className="step-number">02</span>
                <Icono nombre="people" tamano={27} />
                <h3>Tu turno, sin carreras</h3>
                <p>
                  Entra a la cola y espera tu turno.
                  <br />
                  Sin actualizar, sin perder tu lugar.
                </p>
              </div>
              <div>
                <span className="step-number">03</span>
                <Icono nombre="ticket" tamano={27} />
                <h3>Tu entrada. Tu momento.</h3>
                <p>
                  Confirma, guarda tu entrada con QR
                  <br />y prepárate para vivirlo.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="organizer-section container">
          <div className="organizer-symbol">
            <Icono nombre="sparkle" tamano={62} />
          </div>
          <div>
            <span className="eyebrow">LOS BUENOS PLANES SE COMPARTEN</span>
            <h2>¿Tienes un evento en mente?</h2>
            <p>Publícalo, gestiona tus entradas y haz que suceda.</p>
          </div>
          <Link href="/admin" className="button button-dark">
            Organiza tu evento
            <Icono nombre="arrow" tamano={19} />
          </Link>
        </section>
      </main>
      <PieSitio />
      {eventoSeleccionado && (
        <ProcesoCompra
          key={eventoSeleccionado.id}
          evento={
            eventos.find((evento) => evento.id === eventoSeleccionado.id) || eventoSeleccionado
          }
          alCerrar={cerrarCompra}
          alActualizar={() => void actualizarEventos()}
        />
      )}
    </>
  );
}
