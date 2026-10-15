// @ts-check
/**
 * The usage glyph: a quiet "%" in the composer's corner that opens a
 * small readout of the Max plan windows when clicked. Data arrives with
 * each answer (the server forwards the CLI's rate_limit_event as a
 * `limit` SSE event — wired in milestone 3) and the glyph also asks
 * /healthz when opened, which carries the server's last reading. The
 * last reading seen is kept in localStorage so the panel has something
 * to say across reloads.
 */

/**
 * @typedef {{ utilization: number, resetsAt: number }} LimitWindow
 * @typedef {{ status?: string,
 *             windows?: { fiveHour?: LimitWindow, sevenDay?: LimitWindow },
 *             seenAt?: number }} LimitInfo
 */

import { SERVER } from "./chat.js";

const KEY = "sidelong.limits";

/**
 * "9:14 pm" if the moment is within 24 h of now, else "fri 9:14 pm".
 * @param {number} atSeconds unix seconds
 * @param {number} now unix milliseconds
 * @returns {string}
 */
export function fmtTime(atSeconds, now) {
  const d = new Date(atSeconds * 1000);
  const h = d.getHours();
  const hm = (h % 12 || 12) + ":" + String(d.getMinutes()).padStart(2, "0") + " " + (h < 12 ? "am" : "pm");
  const far = Math.abs(d.getTime() - now) >= 24 * 3600 * 1000;
  return far ? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()] + " " + hm : hm;
}

/**
 * The panel's rows as [label, value] pairs; pure for tests.
 * @param {LimitInfo | null} info
 * @param {number} now unix milliseconds
 * @returns {[string, string][]}
 */
export function rows(info, now) {
  const w = info?.windows;
  if (!w || (!w.fiveHour && !w.sevenDay)) return [["usage", "no data yet"]];
  /** @type {[string, string][]} */
  const out = [];
  if (w.fiveHour) {
    out.push(["5-hour", Math.round(w.fiveHour.utilization * 100) + "% · resets " + fmtTime(w.fiveHour.resetsAt, now)]);
  }
  if (w.sevenDay) {
    out.push(["7-day", Math.round(w.sevenDay.utilization * 100) + "% · resets " + fmtTime(w.sevenDay.resetsAt, now)]);
  }
  if (info?.status && info.status !== "allowed") out.push(["status", "limit reached"]);
  if (info?.seenAt) out.push(["seen", fmtTime(info.seenAt / 1000, now)]);
  return out;
}

/**
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} panel
 */
export function initLimits(button, panel) {
  /** @type {LimitInfo | null} */
  let info = load();
  render();

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) void refresh();
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && e.target instanceof Node && !panel.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) close();
  });

  function close() {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  async function refresh() {
    try {
      const r = await fetch(SERVER + "/healthz", { signal: AbortSignal.timeout(1500) });
      const h = await r.json();
      if (h?.limits?.windows) update(h.limits);
    } catch {
      // server not running; keep showing the last stored reading
    }
  }

  function render() {
    panel.textContent = "";
    for (const [k, v] of rows(info, Date.now())) {
      const row = document.createElement("div");
      row.className = "row";
      const kk = document.createElement("span");
      kk.className = "k";
      kk.textContent = k;
      const vv = document.createElement("span");
      vv.className = "v";
      vv.textContent = v;
      row.append(kk, vv);
      panel.appendChild(row);
    }
  }

  /** Called with each `limit` event off the chat stream. @param {LimitInfo} next */
  function update(next) {
    info = { status: next.status, windows: next.windows, seenAt: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(info));
    } catch {
      // private window etc.; the reading just won't survive a reload
    }
    render();
  }

  /** @returns {LimitInfo | null} */
  function load() {
    try {
      const s = localStorage.getItem(KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  return { update };
}
