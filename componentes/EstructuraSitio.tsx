import Link from 'next/link';
import { Icono } from './Icono';
export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <Link href="/" className={`brand ${claro ? 'brand-light' : ''}`} aria-label="Entrada, inicio">
      <span className="brand-symbol">
        <Icono nombre="ticket" tamano={23} />
      </span>
      entrada<span className="brand-period">.</span>
    </Link>
  );
}
export function EncabezadoSitio() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Marca />
        <nav className="main-nav" aria-label="Navegación principal">
          <Link href="/#eventos">Descubrir eventos</Link>
          <Link href="/#como-funciona">Cómo funciona</Link>
        </nav>
        <div className="header-actions">
          <Link className="organizer-link" href="/admin">
            Soy organizador <Icono nombre="external" tamano={14} />
          </Link>
          <Link className="button button-outline ticket-nav" href="/mis-entradas">
            <Icono nombre="ticket" tamano={18} /> Mis entradas
          </Link>
        </div>
      </div>
    </header>
  );
}
export function PieSitio() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div>
            <Marca />
            <p>
              Los mejores momentos empiezan
              <br />
              con un «vamos».
            </p>
          </div>
          <div>
            <span>EXPLORA</span>
            <Link href="/#eventos">Próximos eventos</Link>
            <Link href="/mis-entradas">Mis entradas</Link>
          </div>
          <div>
            <span>ORGANIZA</span>
            <Link href="/admin">Panel de eventos</Link>
            <Link href="/#como-funciona">Cómo funciona la cola</Link>
          </div>
          <div className="footer-location">
            <Icono nombre="pin" tamano={19} />
            <p>
              Hecho para encontrarnos.
              <br />
              <b>Desde Perú, con ritmo propio.</b>
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Entrada. Todos los buenos planes, aquí.</span>
          <div>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/privacidad">Privacidad</Link>
            <span className="demo-dot">Modo demostración</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
