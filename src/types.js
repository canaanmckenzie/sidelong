// @ts-check
/**
 * Shared data shapes. No runtime code lives here; this file is the contract
 * the checker enforces everywhere a Page crosses a boundary.
 *
 * @typedef {object} Page
 * @property {string} q               the question
 * @property {string} a               the answer, markdown text
 * @property {number} ang             topic hue, degrees on the OKLCH hue circle
 * @property {number} r               confidence radius, 0..1; drives chroma
 * @property {number | null} near     index of the most similar page, null when none
 * @property {number | null} sim      cosine similarity to that page
 * @property {boolean} [novel]        true when the page opened a new topic
 * @property {boolean} [live]         true for pages asked this session
 * @property {string} [note]          status line under the answer (errors, early stops), muted italic
 * @property {Map<string, number>} [vec]  bag-of-words vector; set by the store
 * @property {number[]} [evec]        embedding vector (question alone until the answer lands, then question+answer)
 * @property {boolean} [offline]      embedding placement failed; the square stands on the word-match fallback
 *
 * @typedef {object} JevResult
 * @property {number} ang
 * @property {number} r
 * @property {number | null} near
 * @property {number} sim
 * @property {boolean} novel
 */
export {};
