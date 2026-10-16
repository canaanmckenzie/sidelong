// @ts-check
/**
 * Stream plumbing, all pure functions so they are testable without a
 * network or a subprocess:
 *
 *  - drainLines: incremental NDJSON splitting for the Claude Code CLI's
 *    stream-json output (one JSON object per line).
 *  - cliLineToChatEvent: translate one CLI line into the small event set
 *    the sidelong client consumes. The CLI wraps raw Anthropic stream
 *    events in {type:"stream_event"} lines, so the Messages API
 *    translation lives here too (translateStreamEvent).
 *  - drainEvents / toChatEvent: generic SSE parsing, kept for tests and
 *    for any future upstream that speaks SSE directly.
 */

/** @typedef {{ event: string, data: string }} SSEEvent */

/**
 * @typedef {{ utilization: number, resetsAt: number }} LimitWindow
 *
 * @typedef {{ type: "session", sessionId: string }
 *         | { type: "token", text: string }
 *         | { type: "tool", name: string, detail: string }
 *         | { type: "stop", stopReason: string }
 *         | { type: "done" }
 *         | { type: "limit", status: string, windows: { fiveHour?: LimitWindow, sevenDay?: LimitWindow } }
 *         | { type: "error", message: string }} ChatEvent
 */

/**
 * Pull complete lines off the front of an NDJSON buffer. Feed it the
 * previous call's `rest` plus the newly decoded chunk; a partial line at
 * the end stays in `rest` until the next chunk completes it.
 * @param {string} buffer
 * @returns {{ lines: string[], rest: string }}
 */
export function drainLines(buffer) {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.map((l) => l.trim()).filter((l) => l !== ""), rest };
}

/**
 * Translate one parsed Anthropic Messages API stream event into a client
 * event, or null for the ones the client does not care about (pings,
 * block boundaries, thinking deltas).
 * @param {string} name event name, e.g. "content_block_delta"
 * @param {any} d the parsed event payload
 * @returns {ChatEvent | null}
 */
export function translateStreamEvent(name, d) {
  switch (name) {
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

/**
 * Translate one line of `claude -p --output-format stream-json
 * --include-partial-messages --verbose` output into a client event, or
 * null for lines the client does not care about.
 * @param {string} line
 * @returns {ChatEvent | null}
 */
export function cliLineToChatEvent(line) {
  /** @type {any} */
  let d;
  try {
    d = JSON.parse(line);
  } catch {
    return { type: "error", message: "unparseable CLI output line" };
  }
  switch (d.type) {
    case "system":
      return d.subtype === "init" && typeof d.session_id === "string"
        ? { type: "session", sessionId: d.session_id }
        : null;
    case "stream_event":
      return d.event ? translateStreamEvent(d.event.type, d.event) : null;
    case "result":
      return d.is_error
        ? { type: "error", message: typeof d.result === "string" ? d.result : (d.subtype ?? "CLI error") }
        : null; // success is already signalled by message_stop → done
    case "rate_limit_event": {
      const u = d.rate_limit_info?.unifiedWindows;
      if (!u || (!u.five_hour && !u.seven_day)) return null;
      /** @type {{ fiveHour?: LimitWindow, sevenDay?: LimitWindow }} */
      const windows = {};
      if (u.five_hour) windows.fiveHour = { utilization: u.five_hour.utilization, resetsAt: u.five_hour.resetsAt };
      if (u.seven_day) windows.sevenDay = { utilization: u.seven_day.utilization, resetsAt: u.seven_day.resetsAt };
      return { type: "limit", status: d.rate_limit_info.status ?? "unknown", windows };
    }
    default:
      return null; // assistant snapshots, status, …
  }
}

/**
 * One short human-readable line for a tool call's input: the field that
 * names what it touched, whitespace collapsed and capped.
 * @param {any} input
 * @returns {string}
 */
export function toolDetail(input) {
  if (!input || typeof input !== "object") return "";
  const s = input.file_path ?? input.pattern ?? input.path ?? input.command ?? input.query ?? input.url ?? "";
  const str = (typeof s === "string" && s !== "") ? s : JSON.stringify(input);
  const flat = str.replace(/\s+/g, " ").trim();
  return flat.length > 100 ? flat.slice(0, 97) + "…" : flat;
}

/**
 * Translate one CLI line into zero or more client events. Most lines map
 * one-to-one through cliLineToChatEvent; assistant message snapshots add
 * a tool event per tool_use block (full inputs only appear there — the
 * partial stream carries them as json deltas the client never sees).
 * @param {string} line
 * @returns {ChatEvent[]}
 */
export function cliLineToChatEvents(line) {
  /** @type {any} */
  let d = null;
  try { d = JSON.parse(line); } catch { /* cliLineToChatEvent reports it */ }
  if (d?.type === "assistant" && Array.isArray(d.message?.content)) {
    return d.message.content
      .filter((/** @type {any} */ b) => b?.type === "tool_use" && typeof b.name === "string")
      .map((/** @type {any} */ b) => ({ type: "tool", name: b.name.toLowerCase(), detail: toolDetail(b.input) }));
  }
  const ev = cliLineToChatEvent(line);
  return ev ? [ev] : [];
}

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
 * Translate one SSE event (an Anthropic Messages API stream event on the
 * wire) into a client event, or null.
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
  return translateStreamEvent(e.event, d);
}
