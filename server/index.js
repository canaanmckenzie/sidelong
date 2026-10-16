// @ts-check
/**
 * The thin server. No API keys anywhere: chat rides the Claude Code CLI
 * the user is already logged into (Max plan, headless `claude -p`), and
 * embeddings come from a local Ollama. Zero dependencies: node:http,
 * node:child_process, fetch.
 *
 *   POST /chat   { prompt, sessionId? } → SSE: session/token/stop/done/error.
 *                The CLI owns conversation history; pass the sessionId
 *                from the first turn's `session` event to continue a deck.
 *   POST /embed  { texts: [...] } → { model, vectors } via Ollama.
 *   GET  /healthz
 *
 * Optional environment:
 *   PORT              default 8787
 *   SIDELONG_ORIGIN   CORS origin, default http://localhost:5173
 *   CLAUDE_BIN        default "claude"
 *   OLLAMA_URL        default http://127.0.0.1:11434
 *   EMBED_MODEL       default nomic-embed-text
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { drainLines, cliLineToChatEvents } from "./sse.js";

const PORT = Number(process.env.PORT) || 8787;
const ORIGIN = process.env.SIDELONG_ORIGIN ?? "http://localhost:5173";
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "mxbai-embed-large";
const MAX_BODY = 1 << 20; // 1 MiB
const STALL_MS = Number(process.env.SIDELONG_STALL_MS) || 120_000;
// the deck's tool allowlist — read-only and local on purpose: this server
// takes unauthenticated POSTs and the CLI runs headless with nobody
// watching, so anything beyond look-and-answer belongs to a deliberate
// override, not a default
const TOOLS = process.env.SIDELONG_TOOLS ?? "Read Glob Grep";

/**
 * The CLI reports plan usage on every turn; keep the last reading so
 * /healthz can hand it to the client's usage glyph between turns.
 * @type {import("./sse.js").ChatEvent | null}
 */
let lastLimit = null;

// localhost and 127.0.0.1 are the same machine but different origins;
// accept either spelling so a typed-in address doesn't silently break CORS
const ORIGINS = new Set([ORIGIN, ORIGIN.replace("localhost", "127.0.0.1"), ORIGIN.replace("127.0.0.1", "localhost")]);

/**
 * CORS headers for this response's request.
 * @param {import("node:http").ServerResponse} res
 * @returns {Record<string, string>}
 */
function cors(res) {
  const o = res.req.headers.origin;
  return {
    "access-control-allow-origin": o && ORIGINS.has(o) ? o : ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<any>} parsed JSON body (any: callers validate shape)
 */
async function readJson(req) {
  /** @type {Buffer[]} */
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  res.writeHead(status, { ...cors(res), "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleEmbed(req, res) {
  const body = await readJson(req);
  const texts = body?.texts;
  const ok =
    Array.isArray(texts) &&
    texts.length >= 1 &&
    texts.length <= 128 &&
    texts.every((t) => typeof t === "string" && t.length > 0);
  if (!ok) return sendJson(res, 400, { error: "expected { texts: [non-empty strings, 1–128] }" });
  /** @type {Response} */
  let upstream;
  try {
    upstream = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    });
  } catch {
    return sendJson(res, 503, { error: `ollama unreachable at ${OLLAMA_URL}` });
  }
  if (!upstream.ok) {
    return sendJson(res, 502, { error: `ollama ${upstream.status}: ${await upstream.text()}` });
  }
  const data = await upstream.json();
  sendJson(res, 200, { model: data.model ?? EMBED_MODEL, vectors: data.embeddings });
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleChat(req, res) {
  const body = await readJson(req);
  const prompt = body?.prompt;
  const sessionId = body?.sessionId;
  if (typeof prompt !== "string" || prompt.trim() === "") {
    return sendJson(res, 400, { error: "expected { prompt: non-empty string, sessionId? }" });
  }
  if (sessionId !== undefined && typeof sessionId !== "string") {
    return sendJson(res, 400, { error: "sessionId must be a string" });
  }

  const args = [
    "-p", prompt,
    "--output-format", "stream-json",
    "--include-partial-messages",
    "--verbose",
    // read-only local tools: it can look at files to answer, never run,
    // write, or reach the network. Headless mode auto-denies anything not
    // on this list; the system prompt must say exactly what is available,
    // or the model reaches for missing tools and the turn crawls.
    "--allowedTools", TOOLS,
    "--strict-mcp-config",
    "--append-system-prompt",
    `This is a conversation with read-only tools: ${TOOLS}. You may read the user's files to answer questions about them. You cannot run commands, write or edit files, or access the network — never attempt those or output a tool call as text; say plainly what you'd need. Otherwise answer directly in prose.`,
  ];
  if (sessionId) args.push("--resume", sessionId);

  // The deck is a plain conversation, so run the CLI from the user's home,
  // not this repo — same place their normal sessions live.
  const child = spawn(CLAUDE_BIN, args, { cwd: homedir(), stdio: ["ignore", "pipe", "pipe"] });
  res.on("close", () => child.kill("SIGTERM")); // reader gone → stop the turn

  // stall guard: a hung turn used to hold the composer busy until the
  // server was restarted. The CLI emits lines steadily while healthy, so
  // two minutes of silence means wedged — kill it and tell the client.
  let stalled = false;
  /** @type {ReturnType<typeof setTimeout>} */
  let stallTimer;
  const armStall = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stalled = true;
      child.kill("SIGTERM");
    }, STALL_MS);
  };
  armStall();

  res.writeHead(200, { ...cors(res), "content-type": "text/event-stream", "cache-control": "no-store" });
  /** @param {import("./sse.js").ChatEvent} ev */
  const send = (ev) => res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);

  let buffer = "";
  let sawError = false;
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (/** @type {string} */ chunk) => {
    armStall();
    buffer += chunk;
    const drained = drainLines(buffer);
    buffer = drained.rest;
    for (const line of drained.lines) {
      for (const ev of cliLineToChatEvents(line)) {
        if (ev.type === "error") sawError = true;
        if (ev.type === "limit") lastLimit = ev;
        send(ev);
      }
    }
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (/** @type {string} */ chunk) => {
    stderr += chunk.slice(0, 4096);
  });
  child.on("close", (code) => {
    clearTimeout(stallTimer);
    if (stalled && !res.closed) {
      send({ type: "error", message: `turn stalled — no output for ${STALL_MS / 1000}s, gave up (ask again to retry)` });
    } else if (code !== 0 && !sawError && !res.closed) {
      send({ type: "error", message: `claude exited ${code}: ${stderr.trim().slice(-500)}` });
    }
    res.end();
  });
  child.on("error", (err) => {
    if (!res.closed) send({ type: "error", message: `could not start ${CLAUDE_BIN}: ${err.message}` });
    res.end();
  });
}

/**
 * @param {import("node:http").ServerResponse} res
 */
async function handleHealth(res) {
  let embed = false;
  try {
    const ping = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(1000) });
    embed = ping.ok;
  } catch {
    embed = false;
  }
  sendJson(res, 200, { ok: true, chat: "claude-cli", embed, embedModel: EMBED_MODEL, limits: lastLimit });
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors(res));
      return void res.end();
    }
    if (req.method === "GET" && req.url === "/healthz") return await handleHealth(res);
    if (req.method === "POST" && req.url === "/embed") return await handleEmbed(req, res);
    if (req.method === "POST" && req.url === "/chat") return await handleChat(req, res);
    sendJson(res, 404, { error: "not found" });
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: err instanceof Error ? err.message : "server error" });
    else res.end();
  }
  // loopback only: this port speaks for the user's Claude plan and reads
  // their files — it must never be reachable from the network
}).listen(PORT, "127.0.0.1", () => {
  console.log(`sidelong server → http://localhost:${PORT} (chat: ${CLAUDE_BIN} -p, tools: ${TOOLS}, embed: ${EMBED_MODEL} @ ${OLLAMA_URL})`);
});
