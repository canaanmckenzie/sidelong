// @ts-check
/**
 * Deck state. In memory for milestone 1; IndexedDB and export arrive in
 * milestone 6, behind these same two functions.
 */
import { vec } from "./jev.js";

/** @typedef {import("./types.js").Page} Page */

export const state = {
  /** @type {Page[]} */
  pages: [],
  active: 0,
  /**
   * The Claude session behind this deck (the CLI owns the conversation
   * history); set by the first answer's `session` event, passed back as
   * `--resume` on every later question.
   * @type {string | null}
   */
  sessionId: null,
};

/**
 * Append a page to the deck and index it for the classifier.
 * @param {Page} p
 * @param {boolean} [live] true for pages asked this session
 */
export function addPage(p, live) {
  p.vec = vec(p.q + " " + p.a);
  p.live = !!live;
  state.pages.push(p);
}

/**
 * Re-index a page after its answer streamed in, so later questions are
 * scored against the full text, not just the question. (Re-coloring the
 * square from the richer vector is milestone 5, not this.)
 * @param {Page} p
 */
export function reindexPage(p) {
  p.vec = vec(p.q + " " + p.a);
}
