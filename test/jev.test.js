// @ts-check
/**
 * Classifier tests over the five fixture pages (src/fixtures.js). The
 * fixtures' hand-set hues are what an embedding model would produce; the
 * bag-of-words stand-in reproduces most of them, and where it can't, the
 * test asserts the documented limitation rather than the aspiration.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jev, vec, squareVars } from "../src/jev.js";
import { SEED } from "../src/fixtures.js";

/** @typedef {import("../src/types.js").Page} Page */

/** @param {Page} p @returns {Page} */
const withVec = (p) => ({ ...p, vec: vec(p.q + " " + p.a.join(" ")) });
const fixtures = SEED.map(withVec);

/** Smallest angular distance between two hues. @param {number} a @param {number} b */
const angDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** jev for fixture i against all earlier fixtures. @param {number} i */
const run = (i) => jev(SEED[i].q, fixtures.slice(0, i));

test("follow-ups reproduce their hand-set hues within 10°", () => {
  for (const i of [1, 3, 4]) { // CoDel, sourdough, fq_codel target
    const r = run(i);
    assert.ok(angDist(r.ang, SEED[i].ang) <= 10,
      `page ${i + 1}: got ${r.ang.toFixed(1)}°, want ${SEED[i].ang}° ±10`);
  }
});

test("follow-ups find the right nearest page", () => {
  const codel = run(1);
  assert.equal(codel.near, 0);
  assert.equal(codel.novel, false);
  const target = run(4);
  assert.equal(target.near, 1);
  assert.equal(target.novel, false);
});

test("an unrelated question is a new topic and lands pale", () => {
  const sourdough = run(3);
  assert.equal(sourdough.novel, true);
  assert.equal(sourdough.r, 0.25);
});

// TODO(milestone 4): with embeddings, the VLAN question should score near
// page 1 (hand-set sim 0.31, hue 196°). Bag-of-words shares no vocabulary
// with the Smart Queues page, so today it must read as a new topic. When
// the embedding model lands, flip this to assert near === 0 and hue ≈ 196.
test("known limitation: bag-of-words calls the VLAN question a new topic", () => {
  const vlan = run(2);
  assert.equal(vlan.novel, true);
  assert.equal(vlan.sim, 0);
});

test("a new topic takes the midpoint of the widest empty arc", () => {
  /** @param {number} ang @param {string} words @returns {Page} */
  const mk = (ang, words) => withVec({ q: words, a: [words], ang, r: 0.9, near: null, sim: null });
  const pages = [mk(0, "alpha beta gamma delta"), mk(90, "epsilon zeta eta iota")];
  const r = jev("completely unrelated question about watercolor pigments", pages);
  assert.equal(r.novel, true);
  // widest gap is 90° → 360°, midpoint 225°; jitter is ±4°
  assert.ok(angDist(r.ang, 225) <= 5, `got ${r.ang.toFixed(1)}°, want 225° ±5`);
});

test("chroma is monotonic in confidence", () => {
  let prev = -Infinity;
  for (const r of [0, 0.25, 0.5, 0.75, 1]) {
    const c = Number(squareVars({ ang: 0, r })["--sq-c"]);
    assert.ok(c > prev, `chroma ${c} at r=${r} should exceed ${prev}`);
    prev = c;
  }
});

test("an empty deck gets a finite, pale, deterministic hue", () => {
  const a = jev("first question ever", []);
  const b = jev("first question ever", []);
  assert.ok(Number.isFinite(a.ang) && a.ang >= 0 && a.ang < 360);
  assert.equal(a.r, 0.25);
  assert.equal(a.novel, true);
  assert.equal(a.ang, b.ang); // deterministic
});
