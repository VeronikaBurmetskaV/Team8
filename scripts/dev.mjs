// Starts the whole app for local development (ADR-0010):
// Spring Boot with profile dev (embedded Postgres + Flyway) on :8080 and Vite on :5173.
// Extra arguments go to Vite, e.g. `npm run dev -- --host` for the phone demo.
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_JAVA = 21;
const rootDir = fileURLToPath(new URL("../", import.meta.url));
const backendDir = fileURLToPath(new URL("../backend/", import.meta.url));
const isWindows = process.platform === "win32";
// Full path (final-review №7): with NoDefaultCurrentDirectoryInExePath cmd.exe does not find a bare
// "mvnw.cmd". Quoted because `shell: true` joins the command line as text.
const mvnw = isWindows ? `"${path.join(backendDir, "mvnw.cmd")}"` : path.join(backendDir, "mvnw");
/** Spring and the embedded Postgres (DevDatabaseConfig.PORT). */
const BACKEND_PORTS = [8080, 15432];
const GRACEFUL_STOP_MS = 20_000;

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
    if (stopping) return;
    // On Ctrl+C a child can exit before our own SIGINT arrives; let the SIGINT win, so the
    // backend still gets its graceful stop.
    setTimeout(() => {
      if (stopping) return;
      console.log(`\n[dev] ${name} exited with code ${code}; stopping everything.`);
      void stopAll(code ?? 1, { gracefulBackend: false });
    }, 300);
  });
  return child;
}

/** True when something accepts connections on 127.0.0.1:port. */
function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (listening) => {
      socket.destroy();
      resolve(listening);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

async function busyPorts() {
  const listening = await Promise.all(BACKEND_PORTS.map(isListening));
  return BACKEND_PORTS.filter((_, i) => listening[i]);
}

async function waitForBackendToStop(timeoutMs) {
  const end = Date.now() + timeoutMs;
  while ((await busyPorts()).length > 0 && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Windows: child.kill() ends only the cmd.exe that `shell: true` puts in between, not
 * mvnw → java, so stop the whole tree (final-review №5).
 */
function killTree(child) {
  spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
}

const children = [];
let stopping = false;

async function stopAll(exitCode, { gracefulBackend }) {
  if (stopping) return;
  stopping = true;
  if (isWindows) {
    if (gracefulBackend) {
      // Ctrl+C reaches every process in this console, so Spring is already shutting down and
      // stops its Postgres. Wait for that: postgres.exe is started by pg_ctl outside the java
      // process tree, so taskkill /T cannot reach it, and killing java first leaves it running.
      console.log("\n[dev] stopping: waiting for the backend to stop Postgres…");
      await waitForBackendToStop(GRACEFUL_STOP_MS);
    }
    for (const child of children) killTree(child);
    const leftover = await busyPorts();
    if (leftover.length > 0) {
      console.error(
        `[dev] port(s) ${leftover.join(", ")} still busy: stop the old postgres.exe / java.exe in Task Manager.`,
      );
    }
  } else {
    for (const child of children) {
      if (child.exitCode === null) child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode), 500);
}

checkJava();
console.log("[dev] backend: http://localhost:8080  frontend: http://localhost:5173");
console.log("[dev] the first start downloads Maven and embedded Postgres; it can take a few minutes.\n");

children.push(
  start(
    "backend",
    mvnw,
    ["spring-boot:run", "-Dspring-boot.run.profiles=dev"],
    backendDir,
  ),
  start("frontend", "npm", ["--workspace", "frontend", "run", "dev", "--", ...process.argv.slice(2)], rootDir),
);

process.on("SIGINT", () => void stopAll(0, { gracefulBackend: true }));
process.on("SIGTERM", () => void stopAll(0, { gracefulBackend: true }));
