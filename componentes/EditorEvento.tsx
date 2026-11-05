'use client';
import { useState } from 'react';
import { consultarApi } from '../lib/cliente';
import { categorias, type InformacionEvento } from '../lib/tipos';
import { VentanaModal } from './VentanaModal';
import { Icono } from './Icono';
import { PERSONAS_COMPRANDO_POR_EVENTO, MAXIMO_BYTES_IMAGEN } from '../lib/configuracion';
const portadasDisponibles = ['festival', 'indie', 'theater', 'river', 'electronic', 'running'];
export function EditorEvento({
  evento,
  alCerrar,
  alGuardar,
}: {
  evento: InformacionEvento | null;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [imagen, establecerImagen] = useState(evento?.image || '/images/festival.jpg');
  const [zonas, establecerZonas] = useState(
    evento?.tiers.map((zona) => ({
      id: zona.id,
      name: zona.name,
      price: String(zona.priceCents / 100),
      capacity: String(zona.capacity),
    })) || [{ id: '', name: 'General', price: '50', capacity: '100' }],
  );
  const [procesando, establecerProcesando] = useState(false);
  const [subiendoImagen, establecerSubiendoImagen] = useState(false);
  const [error, establecerError] = useState('');
  const fechaDelFormulario = evento
    ? new Date(new Date(evento.startsAt).getTime() - 5 * 3600000).toISOString().slice(0, 16)
    : '';
  async function subirImagen(archivo: File) {
    establecerSubiendoImagen(true);
    establecerError('');
    try {
      if (archivo.size > MAXIMO_BYTES_IMAGEN)
        throw new Error('La imagen debe pesar como máximo 4 MB.');
      const datosSolicitud = new FormData();
      datosSolicitud.set('file', archivo);
      const respuesta = await consultarApi<{ url: string }>(
        '/api/admin/upload',
        'POST',
        datosSolicitud,
      );
      establecerImagen(respuesta.url);
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerSubiendoImagen(false);
    }
  }
  async function guardarEvento(eventoInterfaz: React.FormEvent<HTMLFormElement>) {
    eventoInterfaz.preventDefault();
    establecerProcesando(true);
    establecerError('');
    const formulario = new FormData(eventoInterfaz.currentTarget);
    try {
      const datosSolicitud = {
        title: formulario.get('title'),
        subtitle: formulario.get('subtitle'),
        description: formulario.get('description'),
        venue: formulario.get('venue'),
        city: formulario.get('city'),
        startsAt: `${formulario.get('startsAt')}:00-05:00`,
        category: formulario.get('category'),
        image: imagen,
        status: formulario.get('status'),
        featured: formulario.get('featured') === 'on',
        queueSlots: PERSONAS_COMPRANDO_POR_EVENTO,
        tiers: zonas.map((zona) => ({
          id: zona.id || undefined,
          name: zona.name,
          priceCents: Math.round(Number(zona.price) * 100),
          capacity: Number(zona.capacity),
        })),
      };
      await consultarApi(
        `/api/admin/events${evento ? `/${evento.id}` : ''}`,
        evento ? 'PUT' : 'POST',
        datosSolicitud,
      );
      alGuardar();
    } catch (errorCapturado) {
      establecerError((errorCapturado as Error).message);
    } finally {
      establecerProcesando(false);
    }
  }
  return (
    <VentanaModal
      titulo={evento ? 'Editar evento' : 'Crear evento'}
      alCerrar={() => {
        if (!procesando && !subiendoImagen) alCerrar();
      }}
      ancho
    >
      <div className="editor-header">
        <span className="eyebrow">HAZ QUE SUCEDA</span>
        <h2>{evento ? 'Dale forma a tu evento.' : 'Un buen plan empieza aquí.'}</h2>
        <p>Completa los detalles y prepara las entradas para tu público.</p>
      </div>
      <form onSubmit={guardarEvento}>
        <div className="editor-body">
          <h3 className="editor-section-title">
            <Icono nombre="calendar" tamano={16} />
            01 · Los detalles del plan
          </h3>
          <div className="form-grid">
            <label className="field span-two">
              Nombre del evento
              <input
                name="title"
                defaultValue={evento?.title}
                placeholder="Ej. Festival Amazónico 2027"
                required
                maxLength={150}
              />
            </label>
            <label className="field span-two">
              Una frase que lo diga todo
              <input
                name="subtitle"
                defaultValue={evento?.subtitle}
                placeholder="Ej. Una noche para sentir la selva."
                maxLength={150}
              />
            </label>
            <label className="field">
              Categoría
              <select name="category" defaultValue={evento?.category || 'Música'}>
                {categorias.map((categoriaDisponible) => (
                  <option key={categoriaDisponible}>{categoriaDisponible}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Fecha y hora · Perú
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={fechaDelFormulario}
                required
              />
            </label>
            <label className="field">
              Recinto o lugar
              <input
                name="venue"
                defaultValue={evento?.venue}
                placeholder="Ej. Anfiteatro Amazónico"
                required
                maxLength={150}
              />
            </label>
            <label className="field">
              Ciudad
              <input
                name="city"
                defaultValue={evento?.city || 'Puerto Maldonado'}
                required
                maxLength={100}
              />
            </label>
            <label className="field span-two">
              Cuéntanos de qué va
              <textarea
                name="description"
                defaultValue={evento?.description}
                placeholder="Artistas, horarios, qué incluye, edades permitidas…"
                required
                maxLength={5000}
              />
            </label>
          </div>
          <h3 className="editor-section-title">
            <Icono nombre="upload" tamano={16} />
            02 · Una imagen que invite
          </h3>
          <div className="cover-picker">
            <div className="cover-preview">
              <img src={imagen} alt="Vista previa de la portada" />
            </div>
            <div className="cover-controls">
              <label className="upload-button">
                <Icono nombre="upload" tamano={15} />
                {subiendoImagen ? 'Subiendo imagen…' : 'Subir mi propia imagen'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={subiendoImagen}
                  onChange={(eventoInterfaz) => {
                    if (eventoInterfaz.target.files?.[0])
                      void subirImagen(eventoInterfaz.target.files[0]);
                  }}
                />
              </label>
              <p>JPG, PNG o WebP · Hasta 4 MB. O elige una de la biblioteca.</p>
              <div className="cover-options">
                {portadasDisponibles.map((nombrePortada) => (
                  <button
                    type="button"
                    key={nombrePortada}
                    className={imagen === `/images/${nombrePortada}.jpg` ? 'active' : ''}
                    aria-label={`Usar portada ${nombrePortada}`}
                    onClick={() => establecerImagen(`/images/${nombrePortada}.jpg`)}
                  >
                    <img src={`/images/${nombrePortada}.jpg`} alt="" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <h3 className="editor-section-title">
            <Icono nombre="ticket" tamano={16} />
            03 · Entradas y aforo
          </h3>
          {zonas.map((zona, indice) => (
            <div className="tier-editor" key={zona.id || indice}>
              <label className="field">
                Zona
                <input
                  required
                  maxLength={60}
                  value={zona.name}
                  onChange={(eventoInterfaz) =>
                    establecerZonas((zonasActuales) =>
                      zonasActuales.map((zonaActual, indiceZona) =>
                        indiceZona === indice
                          ? { ...zonaActual, name: eventoInterfaz.target.value }
                          : zonaActual,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                Precio · S/
                <input
                  type="number"
                  required
                  min="0"
                  max="100000"
                  step="0.01"
                  value={zona.price}
                  onChange={(eventoInterfaz) =>
                    establecerZonas((zonasActuales) =>
                      zonasActuales.map((zonaActual, indiceZona) =>
                        indiceZona === indice
                          ? { ...zonaActual, price: eventoInterfaz.target.value }
                          : zonaActual,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                Aforo
                <input
                  type="number"
                  required
                  min="1"
                  max="100000"
                  step="1"
                  value={zona.capacity}
                  onChange={(eventoInterfaz) =>
                    establecerZonas((zonasActuales) =>
                      zonasActuales.map((zonaActual, indiceZona) =>
                        indiceZona === indice
                          ? { ...zonaActual, capacity: eventoInterfaz.target.value }
                          : zonaActual,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="icon-button"
                type="button"
                aria-label={`Eliminar zona ${zona.name}`}
                disabled={zonas.length === 1}
                onClick={() =>
                  establecerZonas((zonasActuales) =>
                    zonasActuales.filter((_, indiceZona) => indiceZona !== indice),
                  )
                }
              >
                <Icono nombre="x" tamano={16} />
              </button>
            </div>
          ))}
          <button
            className="text-button add-tier"
            type="button"
            disabled={zonas.length >= 5}
            onClick={() =>
              establecerZonas((zonasActuales) => [
                ...zonasActuales,
                { id: '', name: '', price: '', capacity: '' },
              ])
            }
          >
            <Icono nombre="plus" tamano={14} />
            Añadir otra zona
          </button>
          <div className="editor-settings">
            <label className="field">
              Estado del evento
              <select name="status" defaultValue={evento?.status || 'published'}>
                <option value="published">Publicado · Visible en la web</option>
                <option value="draft">Borrador · Solo en el panel</option>
              </select>
            </label>
            <label className="field">
              Personas comprando a la vez
              <input
                name="queueSlots"
                type="number"
                value={PERSONAS_COMPRANDO_POR_EVENTO}
                readOnly
              />
              <span className="input-help" style={{ margin: 0 }}>
                La siguiente persona pasa cuando termina, cancela o vence la compra anterior.
              </span>
            </label>
          </div>
          <label className="checkbox-field">
            <input name="featured" type="checkbox" defaultChecked={evento?.featured} />
            <span>Destacar este evento en la portada. Reemplazará el destacado actual.</span>
          </label>
          <p className="input-help" style={{ marginTop: 13, marginBottom: 0 }}>
            El aforo disponible se actualiza con cada reserva. Las reservas sin confirmar se liberan
            a los 10 minutos.
          </p>
        </div>
        {error && (
          <div className="notice error editor-error" role="alert">
            {error}
          </div>
        )}
        <div className="editor-actions">
          <span>Todo listo para el próximo «vamos».</span>
          <div>
            <button
              type="button"
              className="button button-outline"
              onClick={alCerrar}
              disabled={procesando || subiendoImagen}
            >
              Cancelar
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={procesando || subiendoImagen}
            >
              {procesando ? 'Guardando…' : evento ? 'Guardar cambios' : 'Crear evento'}
              <Icono nombre="arrow" tamano={16} />
            </button>
          </div>
        </div>
      </form>
    </VentanaModal>
  );
}
