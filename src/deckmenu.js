// @ts-check
/**
 * The ⋯ glyph beside the usage %: export the deck as a JSON file, import
 * one, or start fresh. The heavy lifting (shape validation, vec rebuild,
 * persistence) lives in store.js; this is just the panel and the file
 * plumbing.
 */
import { state, serializeDeck, restoreDeck, newDeck } from "./store.js";
import { bubbleConfirm, bubbleNotice } from "./bubble.js";

/**
 * @param {{ button: HTMLButtonElement, panel: HTMLElement, file: HTMLInputElement, onChange: () => void }} els
 */
export function initDeckMenu({ button, panel, file, onChange }) {
  const close = () => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && e.target instanceof Node && !panel.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  /** @param {string} label @param {() => void} fn */
  const item = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => { close(); fn(); });
    panel.appendChild(b);
  };

  const exportDeck = () => {
    const blob = new Blob([JSON.stringify(serializeDeck(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sidelong-deck-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  item("export deck", exportDeck);

  item("import deck", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    file.value = "";
    if (!f) return;
    /** @type {any} */
    let data = null;
    try { data = JSON.parse(await f.text()); } catch { /* falls through to the alert */ }
    if (data && restoreDeck(data)) onChange();
    else bubbleNotice("That file doesn't look like a sidelong deck export.");
  });

  // fresh start that keeps the old deck: the export IS the save, so no
  // confirm — anything cleared here can come back through import
  item("save & reset", () => {
    if (state.pages.length > 0) exportDeck();
    newDeck();
    onChange();
  });

  item("new deck", async () => {
    if (state.pages.length > 0 &&
        !(await bubbleConfirm("Start a new deck? Export first if you want to keep this one.",
          { ok: "start fresh", cancel: "keep deck" }))) return;
    newDeck();
    onChange();
  });
}
