// @ts-check
/**
 * Incremental Server-Sent Events parsing, plus the translation from
 * Anthropic Messages API stream events to the small event set the
 * sidelong client consumes. Pure functions, no I/O, so they are
 * testable without a network.
 */

/** @typedef {{ event: string, data: string }} SSEEvent */

/**
 * @typedef {{ type: "token", text: string }
 *         | { type: "stop", stopReason: string }
 *         | { type: "done" }
 *         | { type: "error", message: string }} ChatEvent
 */

/**
 * Pull complete events off the front of an SSE buffer. Feed it the
 * previous call's `rest` plus the newly decoded chunk; a partial event
 * at the end stays in `rest` until the next chunk completes it.
 * @param {string} buffer
 * @returns {{ events: SSEEvent[], rest: string }}
 */
export function drainEvents(buffer) {
  /** @type {SSEEvent[]} */
  const events = [];
  let rest = buffer;
  for (;;) {
    const gap = rest.match(/\r?\n\r?\n/);
    if (!gap || gap.index === undefined) break;
    const raw = rest.slice(0, gap.index);
    rest = rest.slice(gap.index + gap[0].length);
    let event = "message";
    /** @type {string[]} */
    const data = [];
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length > 0) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

/**
 * Translate one Anthropic stream event into a client event, or null for
 * the ones the client does not care about (pings, block boundaries,
 * thinking deltas).
 * @param {SSEEvent} e
 * @returns {ChatEvent | null}
 */
export function toChatEvent(e) {
  /** @type {any} */
  let d;
  try {
    d = JSON.parse(e.data);
  } catch {
    return { type: "error", message: "unparseable upstream event" };
  }
  switch (e.event) {
    case "content_block_delta":
      return d.delta?.type === "text_delta" ? { type: "token", text: d.delta.text } : null;
    case "message_delta":
      return d.delta?.stop_reason ? { type: "stop", stopReason: d.delta.stop_reason } : null;
    case "message_stop":
      return { type: "done" };
    case "error":
      return { type: "error", message: d.error?.message ?? "upstream error" };
    default:
      return null;
  }
}
