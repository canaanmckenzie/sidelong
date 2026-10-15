// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { highlight } from "../src/hl.js";

/** @param {import("../src/hl.js").Tok[]} toks @param {string} text */
const clsOf = (toks, text) => toks.find((t) => t.text === text)?.cls;

test("lisp: keywords bold, comments muted, parens dimmed", () => {
  const toks = highlight("(defun tick (flock) ;; step once\n  (dolist (b flock)))", "lisp");
  assert.equal(clsOf(toks, "defun"), "kw");
  assert.equal(clsOf(toks, "dolist"), "kw");
  assert.equal(clsOf(toks, ";; step once"), "com");
  assert.equal(clsOf(toks, "("), "pun");
  assert.equal(clsOf(toks, "flock"), null);
});

test("js: strings, line and block comments, keywords", () => {
  const toks = highlight('const x = "a // not comment"; // real\n/* block */ return x;', "js");
  assert.equal(clsOf(toks, "const"), "kw");
  assert.equal(clsOf(toks, '"a // not comment"'), "str");
  assert.equal(clsOf(toks, "// real"), "com");
  assert.equal(clsOf(toks, "/* block */"), "com");
  assert.equal(clsOf(toks, "return"), "kw");
});

test("python-family hash comments", () => {
  const toks = highlight("def f():  # docs\n    return None", "python");
  assert.equal(clsOf(toks, "def"), "kw");
  assert.equal(clsOf(toks, "# docs"), "com");
  assert.equal(clsOf(toks, "None"), "kw"); // case-folded keyword match
});

test("unknown language: strings and punctuation only, nothing bolded", () => {
  const toks = highlight('say "hello" (loudly); return', "brainstorm");
  assert.equal(clsOf(toks, '"hello"'), "str");
  assert.equal(clsOf(toks, "("), "pun");
  assert.equal(clsOf(toks, "return"), null); // no keyword set without a lang
  assert.equal(toks.some((t) => t.cls === "com"), false);
});

test("lisp: quoted symbols are not strings", () => {
  const toks = highlight("(mapcar #'boid-pos near)", "lisp");
  assert.equal(toks.some((t) => t.cls === "str"), false);
  assert.equal(clsOf(toks, "boid-pos"), null);
});

test("round-trips the exact source text", () => {
  const src = '(setf x "a;b") ;; tail\nconst y = 1.5;';
  assert.equal(highlight(src, "lisp").map((t) => t.text).join(""), src);
  assert.equal(highlight(src).map((t) => t.text).join(""), src);
});
