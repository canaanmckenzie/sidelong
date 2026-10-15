// @ts-check
/**
 * Deck state, persisted to IndexedDB (milestone 6). The DB is only
 * touched inside functions and only after loadDeck() has run, so this
 * module imports cleanly in Node for tests, and pages like docs/demo.html
 * that seed their own content never overwrite the real deck.
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

let persistOn = false;

/** @returns {Promise<IDBDatabase>} */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sidelong", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("decks");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Restore the last deck (pages, session, open page) from IndexedDB, and
 * switch saving on either way. Resolves false when there is nothing
 * stored or storage is unavailable (private windows run in memory).
 * @returns {Promise<boolean>}
 */
export async function loadDeck() {
  try {
    const db = await openDB();
    /** @type {any} */
    const got = await new Promise((resolve, reject) => {
      const req = db.transaction("decks").objectStore("decks").get("current");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    persistOn = true;
    // an empty-but-saved deck is a deliberate "new deck", not a first run
    if (got && Array.isArray(got.pages)) {
      state.pages = got.pages;
      state.sessionId = typeof got.sessionId === "string" ? got.sessionId : null;
      state.active = got.pages.length ? Math.min(Number(got.active) || 0, got.pages.length - 1) : 0;
      return true;
    }
  } catch {
    // no IndexedDB here; the deck lives for the tab
  }
  return false;
}

/** @type {ReturnType<typeof setTimeout> | undefined} */
let saveTimer;

/**
 * Persist the deck, debounced. Page objects pass through structured
 * clone whole (the bag-of-words Maps included); a no-op until loadDeck
 * has run, so demo pages and tests never write.
 */
export function saveDeck() {
  if (!persistOn) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const db = await openDB();
      db.transaction("decks", "readwrite")
        .objectStore("decks")
        .put({ pages: state.pages, sessionId: state.sessionId, active: state.active, savedAt: Date.now() }, "current");
    } catch {
      // storage refused the write; the in-memory deck is unaffected
    }
  }, 400);
}

/**
 * The deck as a JSON-safe object (the vec Maps are dropped and rebuilt
 * on import; embedding vectors travel as plain arrays).
 */
export function serializeDeck() {
  return {
    sidelong: 1,
    exportedAt: new Date().toISOString(),
    sessionId: state.sessionId,
    active: state.active,
    pages: state.pages.map(({ q, a, ang, r, near, sim, novel, note, evec }) =>
      ({ q, a, ang, r, near, sim, novel, note, evec })),
  };
}

/**
 * Replace the deck from a parsed export. Returns false (and changes
 * nothing) when the data doesn't look like one.
 * @param {any} data
 */
export function restoreDeck(data) {
  const pages = data?.pages;
  const ok =
    Array.isArray(pages) &&
    pages.length > 0 &&
    pages.every((p) => p && typeof p.q === "string" && typeof p.a === "string" &&
      typeof p.ang === "number" && typeof p.r === "number");
  if (!ok) return false;
  state.pages = [];
  for (const p of pages) {
    addPage({
      q: p.q, a: p.a, ang: p.ang, r: p.r,
      near: typeof p.near === "number" ? p.near : null,
      sim: typeof p.sim === "number" ? p.sim : null,
      novel: !!p.novel,
      note: typeof p.note === "string" ? p.note : undefined,
      evec: Array.isArray(p.evec) ? p.evec : undefined,
    });
  }
  state.sessionId = typeof data.sessionId === "string" ? data.sessionId : null;
  state.active = Math.min(Number(data.active) || state.pages.length - 1, state.pages.length - 1);
  saveDeck();
  return true;
}

/** Empty deck, no session; the first question starts a fresh one. */
export function newDeck() {
  state.pages = [];
  state.sessionId = null;
  state.active = 0;
  saveDeck();
}
