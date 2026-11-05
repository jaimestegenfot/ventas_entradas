import { spawnSync } from "node:child_process";

const comandoNpm = process.platform === "win32" ? "npm.cmd" : "npm";
const resultado = spawnSync(comandoNpm, ["run", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (resultado.error) {
  console.error(
    `No se pudo ejecutar npm run build: ${resultado.error.message}`,
  );
  process.exitCode = 1;
} else if (resultado.signal) {
  console.error(`La compilación terminó por la señal ${resultado.signal}.`);
  process.exitCode = 1;
} else {
  process.exitCode = resultado.status ?? 1;
}
