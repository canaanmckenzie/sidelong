// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { drainEvents, toChatEvent } from "../server/sse.js";

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
