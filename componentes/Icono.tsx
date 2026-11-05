import type { CSSProperties } from 'react';
const trazadosIconos: Record<string, React.ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8V5h18v3a4 4 0 0 0 0 8v3H3v-3a4 4 0 0 0 0-8Z" />
      <path d="M15 5v3m0 3v2m0 3v3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13M9 9l11-2" />
      <ellipse cx="6" cy="18" rx="3" ry="3" />
      <ellipse cx="17" cy="16" rx="3" ry="3" />
    </>
  ),
  theater: (
    <>
      <path d="M3 4c4 2 7 2 11 0v9a5.5 5.5 0 0 1-11 0Zm11 4c3 1 5 1 7 0v9a5 5 0 0 1-9 3M6 9h1m3 0h1m-5 4c1 2 3 2 4 0m5 2h1m2 0h1m-4 4c1-1 2-1 3 0" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Zm7-1v4m-2-2h4" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C9 2 3 7 4 14s12 10 16-11ZM4 21 15 10" />
    </>
  ),
  sport: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 5 4-2 6H9l-2-6 5-4Zm0-4v4m9 4h-4m-2 6 2 3M9 17l-2 3m-4-9h4" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  x: <path d="m6 6 12 12M6 18 18 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v17h17M8 15v-4m5 4V6m5 9v-6" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4c3 0 4 2 4 4v3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H4v16h5m6-14 6 6-6 6m-5-6h11" />
    </>
  ),
  edit: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M11 3H3v18h18v-8" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v1" />
    </>
  ),
  refresh: (
    <>
      <path d="M21 4v6h-6M3 20v-6h6" />
      <path d="M4 9a8 8 0 0 1 13-5l4 6M3 14l4 6a8 8 0 0 0 13-5" />
    </>
  ),
  heart: <path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5Z" />,
  qr: (
    <>
      <path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h3v3h3v3h-6zm6-3h-3m-6-9v9H3m9 3v6m3-9h3" />
    </>
  ),
};
export function Icono({
  nombre,
  tamano = 20,
  clase = '',
  estilo,
}: {
  nombre: string;
  tamano?: number;
  clase?: string;
  estilo?: CSSProperties;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clase}
      style={estilo}
      aria-hidden="true"
    >
      {trazadosIconos[nombre] || trazadosIconos.sparkle}
    </svg>
  );
}
