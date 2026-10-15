// @ts-check
/**
 * jev — the classifier and the OKLCH painter. Pure functions only: no DOM,
 * no state. Ported verbatim from the prototype, with one addition: an empty
 * deck gets a deterministic pale hue instead of NaN (the prototype always
 * booted with seeds, so it never hit that case; persistence will).
 * Milestone 4 replaces vec() with an embedding call and keeps everything else.
 */

/** @typedef {import("./types.js").Page} Page */
/** @typedef {import("./types.js").JevResult} JevResult */

const STOP = new Set(("a an the and or but if then so of to in on at for from by with without into over under about as is are was were be been being do does did have has had it its this that these those i me my we our you your they them their he she his her what which who whom whose why how when where would should could can will shall may might must also just very really not no yes than too any some all each every both either neither one two more most much many few less least own same other another such only there here up down out off again further once ever never always".split(" ")));

/** @param {string} text */
export function tokens(text) {
  return text.toLowerCase().replace(/[’']/g, "").split(/[^a-z0-9_]+/)
    .filter(w => w.length > 1 && !STOP.has(w))
    .map(w => w.replace(/(ing|ers|er|es|s)$/, (m) => (w.length > 4 ? "" : m)));
}

/** @param {string} text @returns {Map<string, number>} */
export function vec(text) {
  const v = new Map();
  for (const t of tokens(text)) v.set(t, (v.get(t) || 0) + 1);
  return v;
}

/** @param {Map<string, number>} a @param {Map<string, number>} b */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, x] of a) { na += x * x; const y = b.get(k); if (y) dot += x * y; }
  for (const [, y] of b) nb += y * y;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** @param {string} s @returns {number} 0..1, deterministic */
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/**
 * Classify a question against the deck: hue, confidence, nearest page.
 * Runs the moment a question is submitted, before the answer exists.
 * @param {string} question
 * @param {Page[]} pages
 * @returns {JevResult}
 */
export function jev(question, pages) {
  const jitter = (hash(question) - 0.5) * 8;       // siblings should not land on the identical hue
  if (pages.length === 0) {
    // fresh deck: nothing to be similar to, so a deterministic pale start
    return { ang: (hash("seed:" + question) * 360 + jitter + 360) % 360, r: 0.25, near: null, sim: 0, novel: true };
  }
  const qv = vec(question);
  const sims = pages.map(p => cosine(qv, p.vec ?? new Map()));
  let best = -1, bestSim = 0;
  sims.forEach((s, i) => { if (s > bestSim) { bestSim = s; best = i; } });
  const conf = Math.min(1, bestSim * 5);           // crude calibration: 0.2 cosine on bag-of-words is a strong match
  if (bestSim < 0.06 || best < 0) {
    // new topic: take the widest empty arc on the hue circle, sit in the middle of it, pale
    const angs = pages.map(p => p.ang).sort((x, y) => x - y);
    let gapStart = angs[angs.length - 1], gapSize = 360 - gapStart + angs[0];
    for (let i = 0; i < angs.length - 1; i++) { const g = angs[i + 1] - angs[i]; if (g > gapSize) { gapSize = g; gapStart = angs[i]; } }
    return { ang: (gapStart + gapSize / 2 + jitter + 360) % 360, r: 0.25, near: best >= 0 ? best : null, sim: bestSim, novel: true };
  }
  let x = 0, y = 0, w = 0;
  sims.forEach((s, i) => {
    if (s < 0.03) return;
    const k = s * s, t = pages[i].ang * Math.PI / 180;
    x += k * pages[i].r * Math.cos(t); y += k * pages[i].r * Math.sin(t); w += k;
  });
  const ang = (Math.atan2(y / w, x / w) * 180 / Math.PI + jitter + 360) % 360;
  return { ang, r: 0.3 + 0.7 * conf, near: best, sim: bestSim, novel: false };
}

/**
 * The square's paint: hue and chroma from the classifier, lightness from the
 * theme. Returns the custom properties the stylesheet reads, including the
 * hsl() fallback saturation for browsers without OKLCH.
 * @param {Pick<Page, "ang" | "r">} p
 * @returns {Record<string, string>}
 */
export function squareVars(p) {
  return {
    "--sq-h": p.ang.toFixed(1),
    "--sq-c": (0.03 + 0.15 * p.r).toFixed(3),
    "--sq-s": Math.round(20 + 70 * p.r) + "%",
  };
}
