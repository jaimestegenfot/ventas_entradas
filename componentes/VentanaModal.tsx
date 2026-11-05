'use client';
import { useEffect, useRef } from 'react';
import { Icono } from './Icono';
export function VentanaModal({
  children: contenido,
  titulo,
  alCerrar,
  ancho = false,
}: {
  children: React.ReactNode;
  titulo: string;
  alCerrar: () => void;
  ancho?: boolean;
}) {
  const referenciaVentana = useRef<HTMLDivElement>(null);
  const referenciaAlCerrar = useRef(alCerrar);
  referenciaAlCerrar.current = alCerrar;
  useEffect(() => {
    const elementoAnterior = document.activeElement as HTMLElement | null;
    const desbordamientoAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    referenciaVentana.current?.focus();
    function manejarTeclado(eventoInterfaz: KeyboardEvent) {
      if (eventoInterfaz.key === 'Escape') referenciaAlCerrar.current();
      if (eventoInterfaz.key === 'Tab') {
        const elementosEnfocables = referenciaVentana.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        );
        if (!elementosEnfocables?.length) {
          eventoInterfaz.preventDefault();
          return;
        }
        const primerElemento = elementosEnfocables[0],
          ultimoElemento = elementosEnfocables[elementosEnfocables.length - 1];
        if (
          eventoInterfaz.shiftKey &&
          (document.activeElement === primerElemento ||
            document.activeElement === referenciaVentana.current)
        ) {
          eventoInterfaz.preventDefault();
          ultimoElemento.focus();
        } else if (
          !eventoInterfaz.shiftKey &&
          (document.activeElement === ultimoElemento ||
            document.activeElement === referenciaVentana.current)
        ) {
          eventoInterfaz.preventDefault();
          primerElemento.focus();
        }
      }
    }
    document.addEventListener('keydown', manejarTeclado);
    return () => {
      document.body.style.overflow = desbordamientoAnterior;
      document.removeEventListener('keydown', manejarTeclado);
      elementoAnterior?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(eventoInterfaz) => {
        if (eventoInterfaz.target === eventoInterfaz.currentTarget) alCerrar();
      }}
    >
      <div
        className={`modal ${ancho ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        ref={referenciaVentana}
      >
        <button className="icon-button modal-close" aria-label="Cerrar ventana" onClick={alCerrar}>
          <Icono nombre="x" />
        </button>
        {contenido}
      </div>
    </div>
  );
}
