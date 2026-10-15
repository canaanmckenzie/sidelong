// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { state, addPage, serializeDeck, restoreDeck } from "../src/store.js";

/** @param {string} q @param {string} a */
const page = (q, a) => ({ q, a, ang: 100, r: 0.8, near: null, sim: null, evec: [0.1, 0.2] });

test("export drops the word-match Maps, import rebuilds them", () => {
  state.pages = [];
  addPage(page("how do smart queues work?", "they shape traffic"), true);
  state.sessionId = "sess-123";
  state.active = 0;

  const out = serializeDeck();
  assert.equal(out.sidelong, 1);
  assert.equal(out.sessionId, "sess-123");
  assert.equal("vec" in out.pages[0], false);
  assert.deepEqual(out.pages[0].evec, [0.1, 0.2]);
  assert.equal(JSON.parse(JSON.stringify(out)).pages[0].q, "how do smart queues work?"); // JSON-safe

  state.pages = [];
  state.sessionId = null;
  assert.equal(restoreDeck(JSON.parse(JSON.stringify(out))), true);
  assert.equal(state.pages.length, 1);
  assert.equal(state.sessionId, "sess-123");
  assert.ok(state.pages[0].vec instanceof Map, "vec rebuilt on import");
  assert.deepEqual(state.pages[0].evec, [0.1, 0.2]);
});

test("garbage imports are refused and change nothing", () => {
  state.pages = [];
  addPage(page("keep me", "around"));
  for (const bad of [null, {}, { pages: [] }, { pages: [{ q: 1 }] }, { pages: [{ q: "x" }] }]) {
    assert.equal(restoreDeck(bad), false, JSON.stringify(bad));
  }
  assert.equal(state.pages.length, 1);
  assert.equal(state.pages[0].q, "keep me");
});
