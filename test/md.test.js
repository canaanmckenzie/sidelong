// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, inline } from "../src/md.js";

test("paragraphs split on blank lines, single newlines stay inside", () => {
  const b = parse("First point.\n\nSecond line one\nline two.\n\n");
  assert.equal(b.length, 2);
  assert.equal(b[0].type, "p");
  assert.deepEqual(b[1], { type: "p", inline: [{ type: "text", text: "Second line one\nline two." }] });
});

test("fenced code keeps its language and its blank lines", () => {
  const b = parse('Before.\n\n```js\nconst x = 1;\n\nconst y = 2;\n```\n\nAfter.');
  assert.equal(b.length, 3);
  assert.deepEqual(b[1], { type: "code", lang: "js", text: "const x = 1;\n\nconst y = 2;" });
});

test("an unclosed fence mid-stream renders what has arrived", () => {
  const b = parse("Look:\n\n```python\nprint(");
  assert.equal(b.length, 2);
  assert.deepEqual(b[1], { type: "code", lang: "python", text: "print(" });
});

test("headings carry their level", () => {
  const b = parse("## Section\n\nbody");
  assert.equal(b[0].type, "h");
  assert.equal(/** @type {any} */ (b[0]).level, 2);
});

test("consecutive items group into one list; numbers make it ordered", () => {
  const b = parse("- one\n- two\n\n1. first\n2. second");
  assert.equal(b.length, 2);
  assert.equal(b[0].type, "list");
  assert.equal(/** @type {any} */ (b[0]).ordered, false);
  assert.equal(/** @type {any} */ (b[0]).items.length, 2);
  assert.equal(/** @type {any} */ (b[1]).ordered, true);
});

test("blockquote lines merge into one quote block", () => {
  const b = parse("> a thought\n> continued");
  assert.equal(b.length, 1);
  assert.equal(b[0].type, "quote");
});

test("inline spans: code, bold, italic, links, and plain text around them", () => {
  assert.deepEqual(inline("run `npm test` now"), [
    { type: "text", text: "run " },
    { type: "code", text: "npm test" },
    { type: "text", text: " now" },
  ]);
  assert.deepEqual(inline("**bold** and *soft*"), [
    { type: "strong", text: "bold" },
    { type: "text", text: " and " },
    { type: "em", text: "soft" },
  ]);
  assert.deepEqual(inline("see [the docs](https://example.com/x) here"), [
    { type: "text", text: "see " },
    { type: "link", text: "the docs", href: "https://example.com/x" },
    { type: "text", text: " here" },
  ]);
});

test("multiplication signs do not read as emphasis", () => {
  assert.deepEqual(inline("2 * 3 * 4 = 24"), [{ type: "text", text: "2 * 3 * 4 = 24" }]);
});
