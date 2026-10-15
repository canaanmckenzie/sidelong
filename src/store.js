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
};

/**
 * Append a page to the deck and index it for the classifier.
 * @param {Page} p
 * @param {boolean} [live] true for pages asked this session
 */
export function addPage(p, live) {
  p.vec = vec(p.q + " " + p.a.join(" "));
  p.live = !!live;
  state.pages.push(p);
}
