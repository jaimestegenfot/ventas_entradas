import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const directorioProyecto = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const configuracionNext = (phase) => ({
  outputFileTracingRoot: directorioProyecto,
  outputFileTracingExcludes: {
    "/**": ["./.data/**/*", "./.env*"],
  },
  distDir: process.env.VERCEL
    ? ".next"
    : process.env.NEXT_DIST_DIR ||
      (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
  serverExternalPackages: ["node:sqlite"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
});

export default configuracionNext;
