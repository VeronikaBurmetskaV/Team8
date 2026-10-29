// Runs the backend Maven Wrapper (mvnw or mvnw.cmd) with the given arguments.
// Usage: node scripts/mvnw.mjs verify
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const backendDir = fileURLToPath(new URL("../backend/", import.meta.url));
const isWindows = process.platform === "win32";

const result = spawnSync(isWindows ? "mvnw.cmd" : "./mvnw", process.argv.slice(2), {
  cwd: backendDir,
  stdio: "inherit",
  shell: isWindows,
});
process.exit(result.status ?? 1);
