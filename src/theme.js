// @ts-check
/**
 * The two palettes: black-on-white and slate-with-cream. The toggle sets
 * data-theme on the root and is remembered in localStorage; with no explicit
 * choice the OS preference applies. localStorage can throw (private windows,
 * blocked site data), so every touch is wrapped.
 */

/**
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} label
 */
export function initTheme(button, label) {
  const root = document.documentElement;

  function isDark() {
    const t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function relabel() { label.textContent = isDark() ? "slate" : "b/w"; }

  button.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("sidelong-theme", next); } catch { /* per-viewer convenience only */ }
    relabel();
  });

  try {
    const t = localStorage.getItem("sidelong-theme");
    if (t === "dark" || t === "light") root.setAttribute("data-theme", t);
  } catch { /* fall back to the OS preference */ }
  relabel();
}
