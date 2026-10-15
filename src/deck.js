// @ts-check
/**
 * Deck rendering, navigation, and the composer. Milestone 3 replaces the
 * stub answer in ask() with the streaming chat call; the page must still
 * open, square painted, before the first token arrives.
 */
import { jev, squareVars } from "./jev.js";
import { state, addPage } from "./store.js";

/** @typedef {import("./types.js").Page} Page */

/**
 * @param {{ deck: HTMLElement, count: HTMLElement, form: HTMLFormElement, input: HTMLTextAreaElement }} els
 */
export function initDeck({ deck, count, form, input }) {

  /** @param {HTMLElement} el @param {Page} p */
  function paint(el, p) {
    for (const [k, v] of Object.entries(squareVars(p))) el.style.setProperty(k, v);
  }

  /** The classifier readout under the question. @param {Page} p @param {number} i */
  function readout(p, i) {
    if (i === 0 && p.near === null) return "first page · hue " + Math.round(p.ang) + "°";
    const nearest = p.near === null || p.sim === null ? "" : "nearest <b>#" + (p.near + 1) + "</b> " + p.sim.toFixed(2);
    const verdict = p.novel || (p.sim !== null && p.sim < 0.06) ? "new topic" : p.r > 0.8 ? "follow-up" : "related";
    return verdict + " · " + nearest + " · hue " + Math.round(p.ang) + "° · confidence " + Math.round(p.r * 100) + "%";
  }

  function render() {
    deck.textContent = "";
    state.pages.forEach((p, i) => {
      const page = document.createElement("article");
      page.className = "page" + (i === state.active ? " active" : "");
      paint(page, p);

      const sq = document.createElement("span");
      sq.className = "sq";
      sq.setAttribute("aria-hidden", "true");

      const strip = document.createElement("button");
      strip.type = "button";
      strip.className = "strip";
      strip.title = p.q;
      strip.setAttribute("aria-label", "Open page " + (i + 1) + ": " + p.q);
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = String(i + 1).padStart(2, "0");
      strip.append(n, document.createTextNode(p.q));
      strip.addEventListener("click", () => { state.active = i; render(); });

      const full = document.createElement("div");
      full.className = "full";
      const col = document.createElement("div");
      col.className = "col";
      const h = document.createElement("h2");
      h.className = "q";
      h.textContent = p.q;
      const j = document.createElement("p");
      j.className = "jev";
      j.innerHTML = readout(p, i); // numbers and page indexes only, never user text
      const a = document.createElement("div");
      a.className = "a";
      p.a.forEach((t, k) => {
        const para = document.createElement("p");
        if (p.live && k === p.a.length - 1) para.className = "note";
        para.textContent = t;
        a.appendChild(para);
      });
      col.append(h, j, a);
      full.appendChild(col);

      page.append(sq, strip, full);
      deck.appendChild(page);
    });
    count.textContent = state.pages.length + (state.pages.length === 1 ? " page" : " pages");
  }

  /** @param {string} text */
  function ask(text) {
    const r = jev(text, state.pages);
    const a = [
      "This is the milestone 1 scaffold, so nothing answers yet. In milestone 3 the model's reply streams in here, and the page you are reading is the only thing on screen.",
      "The square in the corner was decided the moment you pressed Ask: " + (r.novel
        ? "no page scored above the floor, so it took the emptiest arc of the hue circle and stayed pale."
        : "it was pulled toward page " + ((r.near ?? 0) + 1) + " with cosine " + r.sim.toFixed(2) + ", and its saturation is that confidence.")
    ];
    addPage({ q: text, a, ang: r.ang, r: r.r, near: r.near, sim: r.sim, novel: r.novel }, true);
    state.active = state.pages.length - 1;
    render();
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    ask(text);
    input.value = "";
    grow();
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.4) + "px";
  }
  input.addEventListener("input", grow);

  document.addEventListener("keydown", e => {
    if (e.target === input) return;
    if (e.key === "ArrowLeft" && state.active > 0) { state.active--; render(); }
    if (e.key === "ArrowRight" && state.active < state.pages.length - 1) { state.active++; render(); }
  });

  render();
  return { render, ask };
}
