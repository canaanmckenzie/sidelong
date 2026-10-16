// @ts-check
/**
 * Thought-bubble dialogs: the in-theme stand-in for window.confirm and
 * window.alert. A flat --bg cloud with a thick --line outline and a hard
 * offset shadow, built from overlapping circles: a shadow copy first, the
 * outlined bumps next, then fill-only copies of everything to erase the
 * arcs that fall inside the silhouette. Promise-based so callers still
 * pause; <dialog>.showModal() supplies the focus trap and Escape.
 */

const NS = "http://www.w3.org/2000/svg";

/** @type {[number, number, number][]} the cloud's rim bumps (cx, cy, r) */
const BUMPS = [
  [110, 105, 58], [205, 80, 68], [305, 95, 62], [385, 140, 52],
  [350, 200, 55], [255, 225, 60], [150, 215, 58], [75, 165, 50],
];
/** @type {[number, number, number][]} interior circles that keep the cloud solid */
const FILLERS = [[240, 150, 85], [160, 150, 70], [320, 150, 70]];
/** @type {[number, number, number][]} the thought trail, drifting toward the composer */
const TRAIL = [[360, 318, 15], [404, 352, 8]];

/**
 * @param {SVGElement} parent
 * @param {[number, number, number][]} list
 */
function circles(parent, list) {
  for (const [cx, cy, r] of list) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", String(r));
    parent.appendChild(c);
  }
}

function cloudSVG() {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 450 372");
  svg.setAttribute("aria-hidden", "true");
  /** @param {string} cls @param {[number, number, number][]} list */
  const group = (cls, list) => {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", cls);
    circles(g, list);
    svg.appendChild(g);
    return g;
  };
  group("shadow", [...BUMPS, ...FILLERS, ...TRAIL])
    .setAttribute("transform", "translate(6 6)");
  group("outline", BUMPS);
  group("cover", [...BUMPS, ...FILLERS]);
  group("trail", TRAIL);
  return svg;
}

/** @type {HTMLDialogElement | null} */
let dlg = null;
/** @type {HTMLParagraphElement} */
let msgEl;
/** @type {HTMLDivElement} */
let actionsEl;

function ensure() {
  if (dlg) return;
  dlg = document.createElement("dialog");
  dlg.className = "bubble";
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.appendChild(cloudSVG());
  const say = document.createElement("div");
  say.className = "say";
  msgEl = document.createElement("p");
  msgEl.className = "msg";
  actionsEl = document.createElement("div");
  actionsEl.className = "actions";
  say.append(msgEl, actionsEl);
  wrap.appendChild(say);
  dlg.appendChild(wrap);
  document.body.appendChild(dlg);
}

/**
 * Open the bubble and wait for an answer. The first button gets focus,
 * so list the safe choice first; Escape closes with "".
 * @param {string} message
 * @param {[label: string, value: string][]} buttons
 * @returns {Promise<string>} the chosen button's value
 */
function show(message, buttons) {
  ensure();
  const d = /** @type {HTMLDialogElement} */ (dlg);
  msgEl.textContent = message;
  actionsEl.textContent = "";
  for (const [label, value] of buttons) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => d.close(value));
    actionsEl.appendChild(b);
  }
  d.returnValue = "";
  d.showModal();
  return new Promise((resolve) => {
    d.addEventListener("close", () => resolve(d.returnValue), { once: true });
  });
}

/**
 * confirm(), in theme. Resolves true only on the ok choice.
 * @param {string} message
 * @param {{ ok?: string, cancel?: string }} [labels]
 */
export async function bubbleConfirm(message, { ok = "ok", cancel = "cancel" } = {}) {
  return (await show(message, [[cancel, ""], [ok, "ok"]])) === "ok";
}

/**
 * alert(), in theme. Resolves once dismissed.
 * @param {string} message
 * @param {string} [ok]
 */
export async function bubbleNotice(message, ok = "ok") {
  await show(message, [[ok, "ok"]]);
}
