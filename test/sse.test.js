// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { drainEvents, toChatEvent, drainLines, cliLineToChatEvent } from "../server/sse.js";

test("NDJSON lines split incrementally, partial line kept in rest", () => {
  const first = drainLines('{"type":"system","subtype":"init","session_id":"abc"}\n{"type":"stre');
  assert.equal(first.lines.length, 1);
  assert.equal(first.rest, '{"type":"stre');
  const second = drainLines(first.rest + 'am_event"}\n');
  assert.deepEqual(second.lines, ['{"type":"stream_event"}']);
  assert.equal(second.rest, "");
});

test("CLI init line yields the session id", () => {
  assert.deepEqual(
    cliLineToChatEvent('{"type":"system","subtype":"init","session_id":"abc-123","tools":[]}'),
    { type: "session", sessionId: "abc-123" },
  );
});

test("CLI stream_event lines translate like raw API events", () => {
  assert.deepEqual(
    cliLineToChatEvent(
      '{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}}',
    ),
    { type: "token", text: "hi" },
  );
  assert.deepEqual(
    cliLineToChatEvent('{"type":"stream_event","event":{"type":"message_stop"}}'),
    { type: "done" },
  );
  assert.deepEqual(
    cliLineToChatEvent(
      '{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn"}}}',
    ),
    { type: "stop", stopReason: "end_turn" },
  );
});

test("rate limit lines become limit events; empty ones are dropped", () => {
  assert.deepEqual(
    cliLineToChatEvent(
      '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","unifiedWindows":{"five_hour":{"utilization":0.12,"resetsAt":1792045800},"seven_day":{"utilization":0.09,"resetsAt":1792458000},"seven_day_overage_included":{"utilization":0.17,"resetsAt":1792458000}}}}',
    ),
    {
      type: "limit",
      status: "allowed",
      windows: {
        fiveHour: { utilization: 0.12, resetsAt: 1792045800 },
        sevenDay: { utilization: 0.09, resetsAt: 1792458000 },
      },
    },
  );
});

test("CLI housekeeping lines are dropped; error results surface", () => {
  assert.equal(cliLineToChatEvent('{"type":"rate_limit_event","rate_limit_info":{}}'), null);
  assert.equal(cliLineToChatEvent('{"type":"assistant","message":{}}'), null);
  assert.equal(cliLineToChatEvent('{"type":"result","subtype":"success","is_error":false}'), null);
  assert.deepEqual(
    cliLineToChatEvent('{"type":"result","subtype":"error_during_execution","is_error":true,"result":"boom"}'),
    { type: "error", message: "boom" },
  );
  assert.deepEqual(cliLineToChatEvent("not json"), {
    type: "error",
    message: "unparseable CLI output line",
  });
});

test("a complete event parses into name and data", () => {
  const { events, rest } = drainEvents('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  assert.equal(rest, "");
  assert.deepEqual(events, [{ event: "message_stop", data: '{"type":"message_stop"}' }]);
});

test("an event split across chunks stays in rest until completed", () => {
  const first = drainEvents('event: content_block_delta\ndata: {"type":"content_bl');
  assert.equal(first.events.length, 0);
  const second = drainEvents(
    first.rest + 'ock_delta","delta":{"type":"text_delta","text":"hi"}}\n\nevent: ping\ndata: {"type":"ping"}\n\n',
  );
  assert.equal(second.rest, "");
  assert.equal(second.events.length, 2);
  assert.equal(second.events[0].event, "content_block_delta");
});

test("CRLF separators parse the same as LF", () => {
  const { events, rest } = drainEvents('event: ping\r\ndata: {"type":"ping"}\r\n\r\n');
  assert.equal(rest, "");
  assert.deepEqual(events, [{ event: "ping", data: '{"type":"ping"}' }]);
});

test("multiple data lines join with newlines", () => {
  const { events } = drainEvents("event: x\ndata: a\ndata: b\n\n");
  assert.deepEqual(events, [{ event: "x", data: "a\nb" }]);
});

test("text deltas become token events; other deltas are dropped", () => {
  assert.deepEqual(
    toChatEvent({
      event: "content_block_delta",
      data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}',
    }),
    { type: "token", text: "hi" },
  );
  assert.equal(
    toChatEvent({
      event: "content_block_delta",
      data: '{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":""}}',
    }),
    null,
  );
});

test("stop reason, stream end, errors and pings translate correctly", () => {
  assert.deepEqual(
    toChatEvent({ event: "message_delta", data: '{"delta":{"stop_reason":"end_turn"}}' }),
    { type: "stop", stopReason: "end_turn" },
  );
  assert.deepEqual(toChatEvent({ event: "message_stop", data: '{"type":"message_stop"}' }), {
    type: "done",
  });
  assert.deepEqual(
    toChatEvent({ event: "error", data: '{"error":{"message":"overloaded"}}' }),
    { type: "error", message: "overloaded" },
  );
  assert.equal(toChatEvent({ event: "ping", data: '{"type":"ping"}' }), null);
  assert.deepEqual(toChatEvent({ event: "message_stop", data: "not json" }), {
    type: "error",
    message: "unparseable upstream event",
  });
});
