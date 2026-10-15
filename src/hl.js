// @ts-check
/**
 * Zero-dependency monochrome syntax highlighting. The design system
 * allows no color beyond the topic marks, so code structure is shown the
 * way typography does it: comments muted and italic, strings muted,
 * keywords at medium weight, punctuation dimmed (parens recede, shape
 * pops — the Lisp trick). Pure function; deck.js turns the tokens into
 * spans, everything lands via textContent.
 */

/** @typedef {{ text: string, cls: "com" | "str" | "kw" | "pun" | null }} Tok */

const KW = {
  lisp: "defun defmacro defstruct defvar defparameter defconstant let let* flet labels lambda if when unless cond case loop do dolist dotimes setf setq incf decf push pop mapcar mapc reduce remove-if remove-if-not and or not null eq eql equal progn prog1 return return-from values multiple-value-bind destructuring-bind quote function declare block go catch throw unwind-protect defn def fn defonce ns",
  js: "const let var function return if else for while do class new extends super import export from default async await yield try catch finally throw typeof instanceof void delete of in switch case break continue this null undefined true false static get set struct func type interface impl pub use mut match",
  python: "def return if elif else for while import from as class try except finally with lambda none true false and or not in is pass raise yield global nonlocal del assert async await match case end begin require module",
  bash: "if then else elif fi for do done while until case esac function in echo exit return local export readonly shift set unset trap source alias",
  sql: "select from where insert into update delete join left right inner outer on as and or not group by order having limit offset create table drop alter index values set distinct union all exists between like is null",
};

/** @type {Record<string, { line: string[], block: boolean, sq: boolean, kw: Set<string> }>} */
const LANGS = {};
for (const [fam, langs, line, block, sq] of /** @type {[keyof typeof KW, string[], string[], boolean, boolean][]} */ ([
  // sq: whether ' delimits strings — not in Lisp, where 'foo is a quoted symbol
  ["lisp", ["lisp", "commonlisp", "common-lisp", "elisp", "scheme", "racket", "clojure", "clj"], [";"], false, false],
  ["js", ["js", "javascript", "ts", "typescript", "jsx", "tsx", "json", "java", "c", "h", "cpp", "go", "rust", "swift", "kotlin", "cs", "csharp", "php", "css"], ["//"], true, true],
  ["python", ["python", "py", "ruby", "rb", "perl", "r", "yaml", "yml", "toml", "ini"], ["#"], false, true],
  ["bash", ["bash", "sh", "shell", "zsh", "console", "makefile", "dockerfile"], ["#"], false, true],
  ["sql", ["sql"], ["--"], false, true],
])) {
  const def = { line, block, sq, kw: new Set(KW[fam].split(" ")) };
  for (const l of langs) LANGS[l] = def;
}

const STR = /"(?:[^"\\\n]|\\.)*"?|`(?:[^`\\]|\\.)*`?/.source;
const SQSTR = /'(?:[^'\\\n]|\\.)*'?/.source;
const WORD = /[A-Za-z_$][\w$*?!-]*/.source;
const PUN = /[()[\]{};,]/.source;

/**
 * Tokenize code for display. Unknown languages still get strings and
 * punctuation; keywords and comments need a recognized `lang`.
 * @param {string} code
 * @param {string} [lang]
 * @returns {Tok[]}
 */
export function highlight(code, lang) {
  const def = LANGS[(lang ?? "").toLowerCase()];
  const comments = [
    ...(def?.block ? ["\\/\\*[\\s\\S]*?(?:\\*\\/|$)"] : []),
    ...(def?.line ?? []).map((m) => m.replace(/[/*+?^${}()|[\]\\]/g, "\\$&") + "[^\\n]*"),
  ];
  const str = def?.sq === false ? STR : STR + "|" + SQSTR;
  const re = new RegExp(
    (comments.length ? `(?<com>${comments.join("|")})|` : "") +
      `(?<str>${str})|(?<word>${WORD})|(?<pun>${PUN})`,
    "g",
  );
  /** @type {Tok[]} */
  const out = [];
  let last = 0;
  for (const m of code.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: code.slice(last, i), cls: null });
    const g = m.groups ?? {};
    if (g.com !== undefined) out.push({ text: m[0], cls: "com" });
    else if (g.str !== undefined) out.push({ text: m[0], cls: "str" });
    else if (g.pun !== undefined) out.push({ text: m[0], cls: "pun" });
    else out.push({ text: m[0], cls: def?.kw.has(m[0].toLowerCase()) ? "kw" : null });
    last = i + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), cls: null });
  return out;
}
