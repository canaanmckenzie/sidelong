// @ts-check
/**
 * Streaming client for the thin server. Answers arrive as SSE on a POST,
 * which EventSource can't do, so read the fetch body and parse events
 * with the same pure parser the server uses (server/sse.js has no Node
 * dependencies; one parser, one source of truth).
 */
import { drainEvents } from "../server/sse.js";

/** @typedef {import("../server/sse.js").ChatEvent} ChatEvent */

export const SERVER = "http://localhost:8787";

/** Is the thin server reachable? @returns {Promise<boolean>} */
export async function serverUp() {
  try {
    const r = await fetch(SERVER + "/healthz", { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Embed texts via the thin server (local Ollama behind it).
 * @param {string[]} texts
 * @returns {Promise<number[][]>} one vector per text, same order
 */
export async function embed(texts) {
  const res = await fetch(SERVER + "/embed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) throw new Error("embed failed: " + res.status);
  return (await res.json()).vectors;
}

/**
 * Stream one answer. Calls onEvent for each event as it arrives and
 * resolves when the stream closes; throws on network failure or a
 * non-2xx response (the caller decides what the page should say).
 * @param {{ prompt: string, sessionId?: string }} body
 * @param {(ev: ChatEvent) => void} onEvent
 */
export async function streamChat(body, onEvent) {
  const res = await fetch(SERVER + "/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error("server replied " + res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const drained = drainEvents(buffer);
    buffer = drained.rest;
    for (const e of drained.events) {
      /** @type {ChatEvent | null} */
      let ev = null;
      try {
        ev = JSON.parse(e.data);
      } catch {
        // malformed event; skip it rather than kill the stream
      }
      if (ev) onEvent(ev);
    }
  }
}
