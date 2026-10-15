// @ts-check
/** Boot: load the seed deck, wire the modules to the DOM. */
import { initDeck } from "./deck.js";
import { initTheme } from "./theme.js";
import { state, addPage } from "./store.js";
import { SEED } from "./fixtures.js";

/** @param {string} id @returns {HTMLElement} */
function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
}

// copies, so the exported fixtures stay pristine for tests
for (const p of SEED) addPage({ ...p, a: [...p.a] });
state.active = state.pages.length - 1;

initDeck({
  deck: must("deck"),
  count: must("count"),
  form: /** @type {HTMLFormElement} */ (must("composer")),
  input: /** @type {HTMLTextAreaElement} */ (must("q")),
});
initTheme(/** @type {HTMLButtonElement} */ (must("theme")), must("themeLabel"));
