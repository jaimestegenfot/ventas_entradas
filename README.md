# Entrada · demo de venta de entradas

Aplicación Next.js con catálogo, cola FIFO, reservas, confirmación simulada, entradas con QR y panel en `/admin`. Los pagos son de demostración y no realizan cobros. Incluye un script de carga k6 en `scripts/carga-k6.js`.

## Desarrollo local

Usa Node.js **22.x, desde 22.13.0**, y npm. Instala con `npm ci` y ejecuta `npm run dev`. Puedes copiar `.env.example` a `.env.local` y definir `ADMIN_PASSWORD` antes del primer arranque.

Sin credenciales remotas, la aplicación usa `.data/entrada.sqlite` y `.data/uploads/`. Si no defines contraseña, se genera en `.data/admin-access.txt`. Estos archivos y `.env.local` están excluidos de Git, del envío por Vercel CLI y de las trazas de archivos que empaqueta Next.js.

```sh
npm run build
npm test
npm run start
```

La compilación local utiliza `.next-production` para poder mantener el servidor de desarrollo separado. Las pruebas crean un servidor y una base de datos aislados; no modifican datos ni usan servicios remotos. Ejecuta `npm run build` antes de `npm test`.

## Desplegar en Vercel

Vercel no proporciona un disco local persistente compartido entre funciones. Por eso este proyecto usa **Turso/libSQL para los datos** y **Vercel Blob para las imágenes** al desplegar. No configures SQLite en `/tmp`: perdería pedidos y no coordinaría el inventario entre instancias.

1. Crea una base de datos **libSQL compatible con `@libsql/client`** en Turso. Obtén su URL `libsql://...` y un token de lectura y escritura. Elige una ubicación cercana a las funciones de Vercel.
2. Sube este repositorio a tu proveedor Git e impórtalo en Vercel. Usa la raíz del repositorio, el preset **Next.js** y Node.js **22.x**. `vercel.json` define instalación `npm ci`, compilación `npm run build` y salida `.next`.
3. En **Storage**, crea y conecta un almacén **Vercel Blob público** al proyecto. Las portadas son públicas. La conexión aporta `BLOB_READ_WRITE_TOKEN`.
4. En las variables de entorno del proyecto, configura las siguientes para el entorno donde desplegarás:

   | Variable                | Valor                                                 |
   | ----------------------- | ----------------------------------------------------- |
   | `TURSO_DATABASE_URL`    | URL de la base libSQL de Turso.                       |
   | `TURSO_AUTH_TOKEN`      | Token con permisos de lectura y escritura.            |
   | `ADMIN_PASSWORD`        | Contraseña privada para inicializar el administrador. |
   | `BLOB_READ_WRITE_TOKEN` | Token del almacén Blob público conectado.             |

5. Despliega. La compilación valida las variables y no necesita conectarse a la base. En la primera petición que usa datos se crean las tablas, los eventos de ejemplo y el administrador dentro de una transacción.
6. Comprueba `/`, inicia sesión en `/admin`, sube una portada y realiza una compra simulada. Confirma que el QR se descarga, el pedido aparece en «Mis entradas» y sigue disponible tras otro despliegue.

Las cookies se marcan `Secure` automáticamente en Vercel. No añadas `NEXT_DIST_DIR`, `ENTRADA_DB_PATH` ni `ENTRADA_DATA_DIR` en ese entorno. Las variables secretas se usan únicamente en el servidor; no les añadas el prefijo `NEXT_PUBLIC_`.

Usa bases y almacenes distintos para **Preview** y **Production**, de modo que una prueba no altere ventas o portadas de producción. Al cambiar variables en Vercel, realiza un nuevo despliegue para aplicarlas. Si usas CLI, puedes vincular el proyecto con `vercel link` y desplegar con `vercel --prod`, después de configurar las variables en Vercel.

`ADMIN_PASSWORD` se lee solo al inicializar una base nueva: cambiar la variable no cambia una contraseña ya guardada. Los pedidos, sesiones y turnos se guardan en Turso; las operaciones de inventario usan transacciones de escritura para coordinar instancias. Las portadas admiten JPG, PNG o WebP de hasta **4 MB**.

## Datos existentes

La base SQLite y las imágenes locales **no se copian automáticamente a Turso o Blob**. Un despliegue con una base nueva comienza con datos de ejemplo. Si necesitas conservar datos locales, respáldalos e impórtalos a la base libSQL antes de abrir el despliegue al público; sube las portadas a Blob y actualiza las referencias `/api/uploads/...`. Los archivos de `supabase/` son del prototipo anterior y no configuran la versión actual.

## Referencias

- [Persistencia y SQLite en Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
- [Cliente TypeScript de Turso/libSQL](https://docs.turso.tech/sdk/ts/reference).
- [SDK de Vercel Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk).
- [Límites de las funciones de Vercel](https://vercel.com/docs/functions/limitations).

Para recorrer el código, consulta `GUIA_DEL_CODIGO.md`.
