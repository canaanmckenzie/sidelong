// @ts-check
/** Boot: restore the last deck (or seed the first run), wire the modules to the DOM. */
import { initDeck } from "./deck.js";
import { initTheme } from "./theme.js";
import { initLimits } from "./limits.js";
import { initDeckMenu } from "./deckmenu.js";
import { serverUp } from "./chat.js";
import { state, addPage, loadDeck } from "./store.js";
import { SEED } from "./fixtures.js";

/** @param {string} id @returns {HTMLElement} */
function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
}

if (!(await loadDeck())) {
  // first run: seed with the sample deck (copies, fixtures stay pristine)
  for (const p of SEED) addPage({ ...p });
  state.active = state.pages.length - 1;
}

const limits = initLimits(/** @type {HTMLButtonElement} */ (must("limits")), must("limitsPanel"));
const input = /** @type {HTMLTextAreaElement} */ (must("q"));

const deckUI = initDeck({
  deck: must("deck"),
  form: /** @type {HTMLFormElement} */ (must("composer")),
  input,
  onLimit: (ev) => limits.update(ev),
});
initDeckMenu({
  button: /** @type {HTMLButtonElement} */ (must("deckmenu")),
  panel: must("deckPanel"),
  file: /** @type {HTMLInputElement} */ (must("importFile")),
  onChange: () => deckUI.render(),
});
initTheme(/** @type {HTMLButtonElement} */ (must("theme")), must("themeLabel"));

// Say so up front if the thin server isn't running, in the one spot the
// eye already goes; asking still works the moment it comes up.
void serverUp().then((up) => {
  if (!up) input.placeholder = "server offline — npm run server, then ask away";
});
