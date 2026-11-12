// Runs the backend Maven Wrapper (mvnw or mvnw.cmd) with the given arguments.
// Usage: node scripts/mvnw.mjs verify
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = fileURLToPath(new URL("../backend/", import.meta.url));
const isWindows = process.platform === "win32";
// Full path, not a lookup in the current directory: with NoDefaultCurrentDirectoryInExePath set,
// cmd.exe does not find a bare "mvnw.cmd" (final-review №7). Quoted because `shell: true` joins
// the command line as text and the project path may contain spaces.
const mvnw = isWindows ? `"${path.join(backendDir, "mvnw.cmd")}"` : path.join(backendDir, "mvnw");

const result = spawnSync(mvnw, process.argv.slice(2), {
  cwd: backendDir,
  stdio: "inherit",
  shell: isWindows,
});
process.exit(result.status ?? 1);
