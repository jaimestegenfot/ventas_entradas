# Cómo entender el proyecto

Empieza por `app/page.tsx`: es la portada. Cada archivo de `app` llamado `page.tsx` representa una página; los archivos `route.ts` reciben las peticiones de la web. Esos nombres los exige Next.js.

## Dónde está cada parte

| Archivo o carpeta                  | Responsabilidad                                                             |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `app/page.tsx`                     | Catálogo, búsqueda, filtros, favoritos y selección de evento.               |
| `app/admin/page.tsx`               | Vistas del panel del organizador.                                           |
| `app/mis-entradas/page.tsx`        | Pedidos y entradas del comprador.                                           |
| `app/estilos.css`                  | Estilos de toda la web, separados en secciones comentadas.                  |
| `componentes/ProcesoCompra.tsx`    | Pantallas y acciones de la compra: cola, selección, reserva y confirmación. |
| `componentes/EditorEvento.tsx`     | Formulario para crear o editar un evento.                                   |
| `componentes/EstructuraSitio.tsx`  | Marca, encabezado y pie de página.                                          |
| `componentes/VentanaModal.tsx`     | Ventana emergente y navegación accesible con teclado.                       |
| `componentes/Icono.tsx`            | Dibujos SVG reutilizables.                                                  |
| `lib/tipos.ts`                     | Forma de los datos que intercambian la web y el servidor.                   |
| `lib/configuracion.ts`             | Duraciones y límites compartidos, con nombres descriptivos.                 |
| `lib/cliente.ts`                   | Función `consultarApi` para enviar solicitudes desde el navegador.          |
| `lib/api.ts`                       | Cookies, permisos, validación del origen y respuestas HTTP comunes.         |
| `lib/rutas.ts`                     | Ubicación de los archivos de datos e imágenes subidas.                      |
| `lib/servidor/base-datos.ts`       | SQLite local o Turso remoto, inicialización y transacciones asíncronas.     |
| `lib/servidor/esquema.ts`          | Tablas e índices de SQLite.                                                 |
| `lib/servidor/datos-ejemplo.ts`    | Eventos iniciales expresados como objetos con campos en español.            |
| `lib/servidor/eventos.ts`          | Publicación, edición y disponibilidad de eventos.                           |
| `lib/servidor/cola.ts`             | Entrada, consulta, admisión y salida de la cola.                            |
| `lib/servidor/pedidos.ts`          | Reservas, confirmación y consulta de pedidos.                               |
| `lib/servidor/entradas.ts`         | Validación de un solo ingreso por entrada.                                  |
| `lib/servidor/autenticacion.ts`    | Sesiones del administrador.                                                 |
| `lib/servidor/seguridad.ts`        | Hash de contraseñas y tokens.                                               |
| `lib/servidor/fechas.ts`           | Cálculos de fecha y vencimiento en el servidor.                             |
| `lib/servidor/panel.ts`            | Métricas e información del panel.                                           |
| `scripts/probar-aplicacion.mjs`    | Pruebas funcionales con servidor y base de datos aislados.                  |
| `scripts/ejecutar-next.mjs`        | Ejecución de compilación y servidor de producción.                          |
| `scripts/verificar-despliegue.mjs` | Comprobación de variables obligatorias antes de compilar en Vercel.         |
| `vercel.json`                      | Preset Next.js, instalación, compilación y carpeta de salida en Vercel.     |

Los archivos de `supabase/`, `lib/supabase.ts` y `scripts/prueba-concurrencia.mjs` corresponden al prototipo anterior. Se conservan como referencia y no participan en el flujo actual.

## Cómo leer los nombres

Las variables y funciones propias usan español sin tildes para escribirlas fácilmente: `eventoSeleccionado`, `establecerEventos`, `reservarEntradas`, `obtenerBaseDatos`.

- `obtener...`, `consultar...` y `listar...` devuelven información.
- `establecer...` actualiza un estado de React.
- `alCerrar`, `alGuardar` y `alActualizar` son acciones que un componente recibe de su padre.
- `procesando`, `cargando` y `subiendoImagen` indican que hay una operación en curso.
- Las constantes en mayúsculas, como `SEGUNDOS_RESERVA_ENTRADAS`, contienen límites o duraciones.

## Recorrido de una compra

```text
PaginaInicio
  → ProcesoCompra
    → consultarApi('/api/queue')
      → entrarEnCola / consultarTurno
    → consultarApi('/api/reserve')
      → reservarEntradas
    → consultarApi('/api/pay')
      → confirmarPedido
    → PaginaMisEntradas
      → obtenerDetalleEntrada
```

Los cambios de inventario se realizan dentro de `ejecutarTransaccion`. Esa función confirma todos los pasos juntos o revierte la operación cuando ocurre un error.

Las operaciones de datos son asíncronas y se esperan con `await`, también en las rutas HTTP. `ejecutarLectura` permite consultar sin adquirir un bloqueo de escritura. En Vercel, las transacciones se ejecutan en Turso para coordinar todas las instancias; en desarrollo local, se conserva SQLite. Las portadas se guardan en Vercel Blob cuando está configurado `BLOB_READ_WRITE_TOKEN`. Consulta `README.md` para preparar los servicios y las variables de despliegue.

`PERSONAS_COMPRANDO_POR_EVENTO` vale `1`: una reserva pendiente también ocupa el acceso. La siguiente persona espera hasta que la compra anterior se confirma, se cancela o vence su plazo. El panel no permite aumentar ese límite.

## Nombres que mantienen compatibilidad

Las rutas HTTP, campos JSON, nombres de cookies, claves guardadas en el navegador, columnas SQLite y clases CSS conservan sus nombres existentes. Así siguen siendo compatibles los datos guardados y el diseño. Los nombres propios de React, Next.js, HTML y las librerías se utilizan como los define cada herramienta.

En `lib/tipos.ts` hay comentarios en español para los campos del contrato de datos. Los más habituales son:

| Campo                              | Significado                                               |
| ---------------------------------- | --------------------------------------------------------- |
| `title`, `subtitle`, `description` | Título, subtítulo y descripción.                          |
| `venue`, `city`, `startsAt`        | Recinto, ciudad y fecha de inicio.                        |
| `tiers`                            | Zonas de entradas del evento.                             |
| `priceCents`, `totalCents`         | Precio y total expresados en céntimos.                    |
| `capacity`, `available`, `sold`    | Aforo, disponibles y entradas vendidas.                   |
| `ticketId`, `position`, `ahead`    | Identificador del turno, posición y personas por delante. |
| `expiresAt`                        | Fecha de vencimiento del turno o reserva.                 |
| `customerName`, `customerEmail`    | Nombre y correo del comprador.                            |
| `tickets`, `code`, `checkedInAt`   | Entradas, código único y momento del ingreso.             |

Los estados `published` y `draft` significan publicado y borrador. En la cola, `waiting`, `admitted`, `used`, `expired` y `cancelled` significan en espera, admitido, usado, vencido y cancelado. En pedidos, `held` y `confirmed` significan reservado y confirmado.

## Comandos útiles

```sh
npm run dev          # Abrir la web en desarrollo
npm run build        # Compilar y comprobar TypeScript
npm test             # Comprobar el funcionamiento con datos aislados
npm run format       # Ordenar el formato de los archivos
npm run format:check # Comprobar que el formato sigue consistente
```

La configuración de formato está en `.prettierrc.json`. Los cambios de organización no modifican la contraseña del administrador ni los registros existentes.
