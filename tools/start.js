// @ts-check
/**
 * One-command launcher: `npm start`. Checks every prerequisite with an
 * actionable message, starts Ollama if it's installed but not running,
 * pulls the embedding model on first run (with progress), then launches
 * the thin server and the static dev server. Zero dependencies.
 */
import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "mxbai-embed-large";
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
const PORT = Number(process.env.PORT) || 8787;
const DEV_PORT = 5173;

const here = new URL(".", import.meta.url);
const ok = (/** @type {string} */ s) => console.log("  ✓ " + s);
let good = true;
const fail = (/** @type {string} */ s) => { console.error("  ✗ " + s); good = false; };

/** @param {string} url */
async function up(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1200) })).ok;
  } catch {
    return false;
  }
}

/** The ollama binary, wherever it is. @returns {string | null} */
function ollamaBin() {
  for (const bin of ["ollama", homedir() + "/.local/bin/ollama"]) {
    if (spawnSync(bin, ["--version"], { stdio: "ignore" }).error === undefined) return bin;
  }
  return null;
}

/** Pull a model through Ollama's API, streaming progress. @param {string} model */
async function pull(model) {
  const res = await fetch(OLLAMA_URL + "/api/pull", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok || !res.body) return false;
  const decoder = new TextDecoder();
  let buf = "", last = "", failed = false;
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      /** @type {any} */
      let d;
      try { d = JSON.parse(line); } catch { continue; }
      if (d.error) { console.error("\n  ✗ " + d.error); failed = true; }
      const pct = d.total ? " " + Math.round(((d.completed ?? 0) / d.total) * 100) + "%" : "";
      const msg = (d.status ?? "") + pct;
      if (msg && msg !== last) { process.stdout.write("\r  … " + msg.padEnd(56)); last = msg; }
    }
  }
  console.log("");
  return !failed;
}

console.log("sidelong preflight:");

// 0. node itself (engines warns on npm install, but warnings get skimmed)
const major = Number(process.versions.node.split(".")[0]);
if (major >= 22) ok("node " + process.versions.node);
else fail("node " + process.versions.node + " — sidelong needs Node 22+ (https://nodejs.org)");

// 1. the Claude Code CLI — chat rides it, billed to the user's subscription
const cv = spawnSync(CLAUDE_BIN, ["--version"], { encoding: "utf8" });
if (cv.status === 0) ok("claude CLI " + cv.stdout.trim());
else fail(`\`${CLAUDE_BIN}\` not found — install Claude Code (https://claude.com/claude-code), run \`claude\` once to log in, then rerun`);

// 2. ollama — start it ourselves if it's installed but not serving
if (await up(OLLAMA_URL + "/api/version")) {
  ok("ollama serving at " + OLLAMA_URL);
} else {
  const bin = ollamaBin();
  if (!bin) {
    fail("ollama not found — install it from https://ollama.com/download (Linux: `curl -fsSL https://ollama.com/install.sh | sh`), then rerun");
  } else {
    const child = spawn(bin, ["serve"], { detached: true, stdio: "ignore" });
    child.unref();
    let started = false;
    for (let i = 0; i < 20 && !started; i++) { await sleep(400); started = await up(OLLAMA_URL + "/api/version"); }
    if (started) ok("ollama started (left running in the background)");
    else fail("ollama would not start — run `" + bin + " serve` yourself, then rerun");
  }
}

// 3. the embedding model — pull it on first run
if (good) {
  try {
    const tags = /** @type {any} */ (await (await fetch(OLLAMA_URL + "/api/tags")).json());
    const have = (tags.models ?? []).some((/** @type {any} */ m) => String(m.name ?? "").startsWith(EMBED_MODEL));
    if (have) {
      ok("embedding model " + EMBED_MODEL);
    } else {
      console.log("  … pulling " + EMBED_MODEL + " (one-time download)");
      if (await pull(EMBED_MODEL)) ok("pulled " + EMBED_MODEL);
      else fail("pull failed — run `ollama pull " + EMBED_MODEL + "` yourself, then rerun");
    }
  } catch {
    fail("could not list ollama models at " + OLLAMA_URL);
  }
}

if (!good) {
  console.error("\nfix the above, then `npm start` again.");
  process.exit(1);
}

// 4. the two node processes (skip any that are already up)
if (await up(`http://localhost:${PORT}/healthz`)) {
  ok(`api server already on :${PORT}`);
} else {
  const srv = spawn(process.execPath, [new URL("../server/index.js", here).pathname], { stdio: ["ignore", "ignore", "inherit"] });
  srv.on("exit", (code) => { console.error("api server exited (" + code + ")"); process.exit(1); });
  for (let i = 0; i < 20 && !(await up(`http://localhost:${PORT}/healthz`)); i++) await sleep(250);
  ok(`api server on :${PORT}`);
}
if (await up(`http://localhost:${DEV_PORT}/`)) {
  ok(`app already on :${DEV_PORT}`);
} else {
  const dev = spawn(process.execPath, [new URL("serve.js", here).pathname, String(DEV_PORT)], { stdio: ["ignore", "ignore", "inherit"] });
  dev.on("exit", (code) => { console.error("dev server exited (" + code + ")"); process.exit(1); });
  for (let i = 0; i < 20 && !(await up(`http://localhost:${DEV_PORT}/`)); i++) await sleep(250);
  ok(`app on :${DEV_PORT}`);
}

console.log(`\n  sidelong → http://localhost:${DEV_PORT}\n\nCtrl+C stops it (ollama stays up).`);
