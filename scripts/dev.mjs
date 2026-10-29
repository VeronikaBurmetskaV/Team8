// Starts the whole app for local development (ADR-0010):
// Spring Boot with profile dev (embedded Postgres + Flyway) on :8080 and Vite on :5173.
// Extra arguments go to Vite, e.g. `npm run dev -- --host` for the phone demo.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REQUIRED_JAVA = 21;
const rootDir = fileURLToPath(new URL("../", import.meta.url));
const backendDir = fileURLToPath(new URL("../backend/", import.meta.url));
const isWindows = process.platform === "win32";

function checkJava() {
  const result = spawnSync("java", ["-version"], { encoding: "utf8", shell: isWindows });
  if (result.error || result.status !== 0) {
    fail(`Java не знайдено. Встановіть JDK ${REQUIRED_JAVA} (Temurin): https://adoptium.net`);
  }
  // `java -version` prints to stderr, e.g. openjdk version "21.0.5" 2024-10-15
  const match = /version "(\d+)/.exec(result.stderr);
  const major = match ? Number(match[1]) : 0;
  if (major < REQUIRED_JAVA) {
    fail(`Потрібна Java ${REQUIRED_JAVA}+, знайдено: ${match ? major : "невідома версія"}.`);
  }
}

function fail(message) {
  console.error(`\n[dev] ${message}\n`);
  process.exit(1);
}

function start(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit", shell: isWindows });
  child.on("exit", (code) => {
    console.log(`\n[dev] ${name} exited with code ${code}; stopping everything.`);
    stopAll(code ?? 1);
  });
  return child;
}

const children = [];
let stopping = false;

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 500);
}

checkJava();
console.log("[dev] backend: http://localhost:8080  frontend: http://localhost:5173");
console.log("[dev] the first start downloads Maven and embedded Postgres; it can take a few minutes.\n");

children.push(
  start(
    "backend",
    isWindows ? "mvnw.cmd" : "./mvnw",
    ["spring-boot:run", "-Dspring-boot.run.profiles=dev"],
    backendDir,
  ),
  start("frontend", "npm", ["--workspace", "frontend", "run", "dev", "--", ...process.argv.slice(2)], rootDir),
);

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
