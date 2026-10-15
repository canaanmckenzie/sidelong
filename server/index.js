// @ts-check
/**
 * The thin server. It holds the API keys and does exactly two things:
 * embeds text (POST /embed, Voyage AI) and streams chat completions
 * (POST /chat, Claude API, re-emitted as SSE so the client never sees
 * provider wire formats). Zero dependencies: node:http + fetch.
 *
 * Keys come from the environment only:
 *   ANTHROPIC_API_KEY   required for /chat
 *   VOYAGE_API_KEY      required for /embed
 * Optional:
 *   PORT              default 8787
 *   SIDELONG_ORIGIN   CORS origin, default http://localhost:5173
 *   ANTHROPIC_MODEL   default claude-opus-5-5
 *   VOYAGE_MODEL      default voyage-3.5-lite
 */
import { createServer } from "node:http";
import { drainEvents, toChatEvent } from "./sse.js";

const PORT = Number(process.env.PORT) || 8787;
const ORIGIN = process.env.SIDELONG_ORIGIN ?? "http://localhost:5173";
const CHAT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const EMBED_MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5-lite";
const MAX_BODY = 1 << 20; // 1 MiB

/** @type {Record<string, string>} */
const CORS = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  vary: "origin",
};

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
  res.writeHead(status, { ...CORS, "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleEmbed(req, res) {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return sendJson(res, 503, { error: "VOYAGE_API_KEY is not set" });
  const body = await readJson(req);
  const texts = body?.texts;
  const ok =
    Array.isArray(texts) &&
    texts.length >= 1 &&
    texts.length <= 128 &&
    texts.every((t) => typeof t === "string" && t.length > 0);
  if (!ok) return sendJson(res, 400, { error: "expected { texts: [non-empty strings, 1–128] }" });
  const upstream = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!upstream.ok) {
    return sendJson(res, 502, { error: `voyage ${upstream.status}: ${await upstream.text()}` });
  }
  const data = await upstream.json();
  const vectors = [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  sendJson(res, 200, { model: data.model, vectors });
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleChat(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return sendJson(res, 503, { error: "ANTHROPIC_API_KEY is not set" });
  const body = await readJson(req);
  const messages = body?.messages;
  const ok =
    Array.isArray(messages) &&
    messages.length >= 1 &&
    messages.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0,
    );
  if (!ok) return sendJson(res, 400, { error: "expected { messages: [{ role, content }, …] }" });

  // Stop paying for tokens nobody is reading if the browser goes away.
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // Server-side refusal fallback: on a safety decline the API retries
      // the same request on a fallback model inside the same call.
      "anthropic-beta": "server-side-fallback-2026-07-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 64000,
      stream: true,
      fallbacks: "default",
      ...(typeof body.system === "string" ? { system: body.system } : {}),
      messages,
    }),
    signal: abort.signal,
  });
  if (!upstream.ok || !upstream.body) {
    return sendJson(res, 502, { error: `claude ${upstream.status}: ${await upstream.text()}` });
  }

  res.writeHead(200, { ...CORS, "content-type": "text/event-stream", "cache-control": "no-store" });
  /** @param {import("./sse.js").ChatEvent} ev */
  const send = (ev) => res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const drained = drainEvents(buffer);
    buffer = drained.rest;
    for (const e of drained.events) {
      const ev = toChatEvent(e);
      if (ev) send(ev);
    }
  }
  res.end();
}

createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      return void res.end();
    }
    if (req.method === "GET" && req.url === "/healthz") {
      return sendJson(res, 200, {
        ok: true,
        chat: Boolean(process.env.ANTHROPIC_API_KEY),
        embed: Boolean(process.env.VOYAGE_API_KEY),
      });
    }
    if (req.method === "POST" && req.url === "/embed") return await handleEmbed(req, res);
    if (req.method === "POST" && req.url === "/chat") return await handleChat(req, res);
    sendJson(res, 404, { error: "not found" });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return void res.end();
    if (!res.headersSent) sendJson(res, 500, { error: err instanceof Error ? err.message : "server error" });
    else res.end();
  }
}).listen(PORT, () => {
  console.log(`sidelong server → http://localhost:${PORT} (chat: ${CHAT_MODEL}, embed: ${EMBED_MODEL})`);
});
