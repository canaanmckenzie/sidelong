// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { paragraphs } from "../src/deck.js";

test("streamed text splits into trimmed paragraphs on blank lines", () => {
  assert.deepEqual(paragraphs("First point.\n\nSecond point.\n\n"), ["First point.", "Second point."]);
  assert.deepEqual(paragraphs("Triple\n\n\nbreak"), ["Triple", "break"]);
});

test("mid-stream fragments render as they stand", () => {
  assert.deepEqual(paragraphs(""), []);
  assert.deepEqual(paragraphs("Partial sent"), ["Partial sent"]);
  assert.deepEqual(paragraphs("Done.\n\nNext para has started but"), ["Done.", "Next para has started but"]);
});

test("single newlines stay inside one paragraph", () => {
  assert.deepEqual(paragraphs("a list:\n- one\n- two"), ["a list:\n- one\n- two"]);
});
