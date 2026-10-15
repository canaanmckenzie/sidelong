// @ts-check
/**
 * A small markdown reader for answers: fenced code, headings, lists,
 * blockquotes, paragraphs; inline code, bold, italic, links. Zero
 * dependencies, pure data out (the DOM is deck.js's job, built with
 * textContent — no HTML injection path), and written for streaming: the
 * whole accumulated text is re-read on every token, so an unclosed
 * fence or half-typed emphasis renders sensibly mid-stream.
 */

/**
 * @typedef {{ type: "text" | "code" | "strong" | "em", text: string }
 *         | { type: "link", text: string, href: string }} Inline
 *
 * @typedef {{ type: "p", inline: Inline[] }
 *         | { type: "h", level: number, inline: Inline[] }
 *         | { type: "code", lang: string, text: string }
 *         | { type: "list", ordered: boolean, items: Inline[][] }
 *         | { type: "quote", inline: Inline[] }} Block
 */

const INLINE = /(`+)([\s\S]+?)\1|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
const ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;

/** Tokenize one run of text into inline spans. @param {string} text @returns {Inline[]} */
export function inline(text) {
  /** @type {Inline[]} */
  const out = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "text", text: text.slice(last, i) });
    if (m[2] !== undefined) out.push({ type: "code", text: m[2].trim() });
    else if (m[3] !== undefined) out.push({ type: "link", text: m[3], href: m[4] });
    else if (m[5] !== undefined) out.push({ type: "strong", text: m[5] });
    else out.push({ type: "em", text: m[6] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Read markdown into blocks. @param {string} text @returns {Block[]} */
export function parse(text) {
  /** @type {Block[]} */
  const blocks = [];
  const lines = text.split("\n");
  /** @type {string[]} */
  let para = [];
  const flush = () => {
    const t = para.join("\n").trim();
    if (t) blocks.push({ type: "p", inline: inline(t) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const lang = line.replace(/^\s*`+/, "").trim();
      /** @type {string[]} */
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      // running off the end means the fence is still streaming; show what we have
      blocks.push({ type: "code", lang, text: buf.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); blocks.push({ type: "h", level: h[1].length, inline: inline(h[2]) }); continue; }
    const li = line.match(ITEM);
    if (li) {
      flush();
      /** @type {Inline[][]} */
      const items = [inline(li[3])];
      let next;
      while (i + 1 < lines.length && (next = lines[i + 1].match(ITEM))) { items.push(inline(next[3])); i++; }
      blocks.push({ type: "list", ordered: li[2] !== undefined, items });
      continue;
    }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) {
      flush();
      const buf = [q[1]];
      let more;
      while (i + 1 < lines.length && (more = lines[i + 1].match(/^\s*>\s?(.*)$/))) { buf.push(more[1]); i++; }
      blocks.push({ type: "quote", inline: inline(buf.join("\n").trim()) });
      continue;
    }
    if (line.trim() === "") { flush(); continue; }
    para.push(line);
  }
  flush();
  return blocks;
}
