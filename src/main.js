// @ts-check
/** Boot: load the seed deck, wire the modules to the DOM. */
import { initDeck } from "./deck.js";
import { initTheme } from "./theme.js";
import { initLimits } from "./limits.js";
import { serverUp } from "./chat.js";
import { state, addPage } from "./store.js";
import { SEED } from "./fixtures.js";

/** @param {string} id @returns {HTMLElement} */
function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
}

// copies, so the exported fixtures stay pristine for tests
for (const p of SEED) addPage({ ...p });
state.active = state.pages.length - 1;

const limits = initLimits(/** @type {HTMLButtonElement} */ (must("limits")), must("limitsPanel"));
const input = /** @type {HTMLTextAreaElement} */ (must("q"));

initDeck({
  deck: must("deck"),
  form: /** @type {HTMLFormElement} */ (must("composer")),
  input,
  onLimit: (ev) => limits.update(ev),
});
initTheme(/** @type {HTMLButtonElement} */ (must("theme")), must("themeLabel"));

// Say so up front if the thin server isn't running, in the one spot the
// eye already goes; asking still works the moment it comes up.
void serverUp().then((up) => {
  if (!up) input.placeholder = "server offline — npm run server, then ask away";
});
