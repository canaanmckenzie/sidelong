// @ts-check
/**
 * Deck rendering, navigation, and the composer. On submit the page is
 * created and opened, square already painted, before the first token;
 * the answer then streams into it from the thin server.
 */
import { jev, place, cosineVec, squareVars, EMB } from "./jev.js";
import { state, addPage, reindexPage } from "./store.js";
import { streamChat, embed } from "./chat.js";
import { parse } from "./md.js";

/** @typedef {import("./types.js").Page} Page */

/** Inline markdown spans into an element, all via textContent. @param {HTMLElement} el @param {import("./md.js").Inline[]} parts */
function fillInline(el, parts) {
  for (const t of parts) {
    if (t.type === "text") {
      el.appendChild(document.createTextNode(t.text));
    } else if (t.type === "link") {
      const a = document.createElement("a");
      a.textContent = t.text;
      a.href = t.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      el.appendChild(a);
    } else {
      const span = document.createElement({ code: "code", strong: "strong", em: "em" }[t.type]);
      span.textContent = t.text;
      el.appendChild(span);
    }
  }
}

/**
 * @param {{ deck: HTMLElement, count: HTMLElement, form: HTMLFormElement, input: HTMLTextAreaElement,
 *           onLimit?: (ev: { status: string, windows: object }) => void }} els
 */
export function initDeck({ deck, count, form, input, onLimit }) {

  /** @param {HTMLElement} el @param {Page} p */
  function paint(el, p) {
    for (const [k, v] of Object.entries(squareVars(p))) el.style.setProperty(k, v);
  }

  /** The classifier readout under the question. @param {Page} p @param {number} i */
  function readout(p, i) {
    if (i === 0 && p.near === null) return "first page · hue " + Math.round(p.ang) + "°";
    const nearest = p.near === null || p.sim === null ? "" : "nearest <b>#" + (p.near + 1) + "</b> " + p.sim.toFixed(2);
    const verdict = p.novel ? "new topic" : p.r > 0.8 ? "follow-up" : "related";
    return verdict + " · " + nearest + " · hue " + Math.round(p.ang) + "° · confidence " + Math.round(p.r * 100) + "%"
      + (p.offline ? " · offline" : "");
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
      fillAnswer(a, p);
      col.append(h, j, a);
      full.appendChild(col);

      page.append(sq, strip, full);
      deck.appendChild(page);
    });
    count.textContent = state.pages.length + (state.pages.length === 1 ? " page" : " pages");
  }

  /** The answer as rendered markdown plus the status note, rebuilt in place. @param {Element} a @param {Page} p */
  function fillAnswer(a, p) {
    a.textContent = "";
    for (const b of parse(p.a)) {
      if (b.type === "code") {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        if (b.lang) code.dataset.lang = b.lang;
        code.textContent = b.text;
        pre.appendChild(code);
        a.appendChild(pre);
      } else if (b.type === "list") {
        const list = document.createElement(b.ordered ? "ol" : "ul");
        for (const item of b.items) {
          const li = document.createElement("li");
          fillInline(li, item);
          list.appendChild(li);
        }
        a.appendChild(list);
      } else if (b.type === "quote") {
        const bq = document.createElement("blockquote");
        const para = document.createElement("p");
        fillInline(para, b.inline);
        bq.appendChild(para);
        a.appendChild(bq);
      } else {
        // answers start under an h2 question, so markdown # maps to h3
        const el = document.createElement(b.type === "h" ? "h" + Math.min(6, b.level + 2) : "p");
        fillInline(el, b.inline);
        a.appendChild(el);
      }
    }
    if (p.note) {
      const para = document.createElement("p");
      para.className = "note";
      para.textContent = p.note;
      a.appendChild(para);
    }
  }

  /** Redraw only one page's answer, so streaming doesn't rebuild the deck. @param {number} i */
  function renderAnswer(i) {
    const a = deck.children[i]?.querySelector(".a");
    const p = state.pages[i];
    if (a && p) fillAnswer(a, p);
  }

  const askBtn = /** @type {HTMLButtonElement | null} */ (form.querySelector("#ask"));
  let busy = false;

  /**
   * Re-place the square from real embeddings; bag-of-words already painted
   * it, so this only sharpens hue and confidence (the square's color
   * animates, the page never moves). Earlier pages missing an embedding —
   * born offline, or seeds — get theirs in the same request.
   * @param {Page} p @param {number} i
   */
  async function refine(p, i) {
    try {
      const earlier = state.pages.slice(0, i);
      const missing = earlier.filter(pg => !pg.evec);
      const vectors = await embed([p.q, ...missing.map(pg => pg.q + " " + pg.a)]);
      missing.forEach((pg, j) => { pg.evec = vectors[j + 1]; });
      const sims = earlier.map(pg => (pg.evec ? cosineVec(vectors[0], pg.evec) : 0));
      const r = place(p.q, sims, earlier, EMB);
      p.ang = r.ang; p.r = r.r; p.near = r.near; p.sim = r.sim; p.novel = r.novel;
      p.evec = vectors[0]; // question alone for now; question+answer after the stream
      render();
    } catch {
      p.offline = true; // the readout says the square stands on word-match
      render();
    }
  }

  /** @param {string} text */
  async function ask(text) {
    // Paint first: the square and the question appear the moment Enter
    // lands, placed by bag-of-words — instant and offline. The embedding
    // verdict follows a beat later and repaints without moving anything.
    const r = jev(text, state.pages);
    /** @type {Page} */
    const p = { q: text, a: "", ang: r.ang, r: r.r, near: r.near, sim: r.sim, novel: r.novel };
    addPage(p, true);
    const i = state.pages.length - 1;
    state.active = i;
    render();
    void refine(p, i); // runs while the answer streams

    busy = true;
    if (askBtn) askBtn.disabled = true;
    try {
      await streamChat(
        { prompt: text, ...(state.sessionId ? { sessionId: state.sessionId } : {}) },
        (ev) => {
          if (ev.type === "token") {
            p.a += ev.text;
            renderAnswer(i);
          } else if (ev.type === "session") {
            state.sessionId = ev.sessionId;
          } else if (ev.type === "stop" && ev.stopReason !== "end_turn") {
            p.note = "(stopped: " + ev.stopReason + ")";
            renderAnswer(i);
          } else if (ev.type === "limit") {
            onLimit?.(ev);
          } else if (ev.type === "error") {
            p.note = "(error: " + ev.message + ")";
            renderAnswer(i);
          }
        },
      );
    } catch {
      p.note = "(server unreachable — start it with npm run server, then ask again)";
      renderAnswer(i);
    } finally {
      busy = false;
      if (askBtn) askBtn.disabled = false;
      reindexPage(p); // later questions score against the full answer
      // upgrade the embedding the same way (re-coloring from it is milestone 5)
      void embed([p.q + " " + p.a]).then(v => { p.evec = v[0]; }).catch(() => {});
    }
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    void ask(text);
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
