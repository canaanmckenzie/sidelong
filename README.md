# Sidelong

A chat interface laid out sideways. Every question-and-answer pair is a
page; the open page sits in the middle of the screen, and older pages
collapse into thin vertical strips on the left, so a long session reads
as a row of tabs instead of a scroll. Each page carries a colored mark —
hue says what the page is about, saturation says how sure the classifier
was — so related follow-ups share a color and a stack of twenty old
pages can be scanned by eye.

![Sidelong: strips on the left, the open page in the middle](docs/screenshot.png#gh-light-mode-only)
![Sidelong: strips on the left, the open page in the middle](docs/screenshot-dark.png#gh-dark-mode-only)

It runs entirely on things you already have. Chat drives the Claude Code
CLI you're logged into, so turns are billed to your existing Claude
subscription (Pro/Max) exactly like your normal `claude` sessions — a
deck *is* one Claude session, resumed turn by turn. Topic embeddings
come from a small local Ollama model. There are **no API keys anywhere**
and no accounts beyond the ones you already have.

## Quick start

You need two things installed first (one-time, a few minutes):

1. **[Claude Code](https://claude.com/claude-code)** — install it, then
   run `claude` once in a terminal and log in with your Claude account.
   That's the only account sidelong ever uses: the server runs the CLI
   headless (`claude -p`), so chat is billed to your subscription like
   any normal `claude` session, against the same usage limits (the `%`
   glyph in the composer shows where you stand).
2. **[Ollama](https://ollama.com)** — embeddings run on it, locally and
   free. macOS/Windows: install the app from
   [ollama.com/download](https://ollama.com/download). Linux:
   `curl -fsSL https://ollama.com/install.sh | sh` (or unpack the
   release tarball anywhere and put `bin/ollama` on your PATH — no root
   needed). You do **not** need to pull any model — the launcher does
   that itself.

Then, with Node.js 22+:

```
git clone https://github.com/canaanmckenzie/sidelong.git
cd sidelong
npm install     # dev-only deps (typescript + @types/node); install scripts are disabled
npm start
```

`npm start` checks everything and tells you exactly what's missing if
something is: it verifies the `claude` CLI, starts Ollama if it's
installed but not running, **pulls the embedding model automatically on
first run** (~670 MB, with progress), and launches both servers. When it
prints `sidelong → http://localhost:5173`, open that and ask something.

Arrow keys move between pages when the composer isn't focused; clicking
any strip opens it. If the server or Ollama ever goes down, asking still
paints colors from an offline word-match fallback and the readout
appends `offline`.

<details>
<summary>Running the pieces by hand instead</summary>

```
ollama serve       # embeddings       → localhost:11434
npm run server     # the thin server  → localhost:8787
npm run dev        # the app          → localhost:5173
```

Three processes, any order; `ollama pull mxbai-embed-large` once
beforehand.
</details>

## How to read a page

The color is the point. Every page carries one mark — a square on the
open page, a thin spine on collapsed strips — and its **hue is the
topic**: a new question is placed on the color wheel near the pages it
resembles, so follow-ups inherit their thread's color and an unrelated
question lands in the emptiest part of the wheel. **Saturation is
confidence**: a vivid mark means the classifier was sure of the match, a
pale one means a fresh or uncertain topic. Scanning the strips by color
tells you where every conversation thread lives without reading a word.

The placement happens three times, each with better information. The
instant you press Enter, a word-match classifier colors the page so it
never appears blank. About 30 ms later the real embedding of your
question settles the color (a quick cross-fade — the page never moves).
And once the answer has streamed in, the page is re-scored against the
question *plus* the answer, which is a far better signal than a
seven-word question.

The small line under each question is the classifier owning up to its
verdict: `follow-up · 90%` — what it decided, and how confident it was.
`new topic` means nothing scored above the similarity floor (no
percentage, since there's no match to be confident in). If the
post-answer re-score changed its mind, the line keeps the history:
`new topic → follow-up · 84%`. Hover the line for the raw numbers
(nearest page, cosine similarity, hue) if you want to see the gears.

### Configuration (environment, all optional)

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `8787` | thin-server port |
| `SIDELONG_ORIGIN` | `http://localhost:5173` | CORS origin for the app |
| `CLAUDE_BIN` | `claude` | the CLI the chat rides |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | where embeddings live |
| `EMBED_MODEL` | `mxbai-embed-large` | swap it, then re-fit: `node tools/calibrate.js <model>` prints the similarity matrix for re-tuning `EMB` in `src/jev.js` (smaller models were tried and couldn't separate "same thread" from "same broad domain") |

## Shape

Plain JavaScript, native ES modules, no framework, no build step, and
**zero runtime dependencies** — the npm supply chain stays out of it
(`.npmrc` disables install scripts and pins exact versions; dev deps are
exactly `typescript` and `@types/node`). Types live in JSDoc comments
checked by `tsc --noEmit` (`npm run check`); tests run on Node's
built-in runner (`npm test`).

- `src/jev.js` — the classifier and the OKLCH painter; pure functions,
  one `place()` shared by the word-match and embedding paths
- `src/deck.js` — rendering, navigation, the composer, streaming
- `src/md.js` — zero-dependency markdown reader (pure parser; the DOM is
  built via `textContent`, no injection path)
- `src/chat.js` — streaming client for the thin server
- `src/limits.js` — the `%` usage glyph and its readout
- `src/store.js` — deck state (in memory until milestone 6)
- `src/theme.js` — the black-on-white and slate-with-cream palettes
- `src/fixtures.js` — the five seed pages, also used by the tests
- `src/types.js` — the data shapes (JSDoc typedefs; the checker's contract)
- `server/index.js` — the thin server: `POST /chat` spawns `claude -p`
  (stream-json → simplified SSE), `POST /embed` calls Ollama,
  `GET /healthz`; `node:http` + `fetch`, nothing else
- `server/sse.js` — stream parsing and translation; pure functions
- `tools/start.js`, `tools/serve.js`, `tools/calibrate.js` — the
  one-command launcher, the dev server, the calibration script

`HANDOFF.md` is the full design document (interaction model, visual
spec, the classifier math, acceptance criteria). `SESSION-NOTES.md`
tracks the build session to session. `prototype/sidelong.html` is the
original one-file prototype.

Milestone status (see HANDOFF.md): **1–5 done** — scaffold, server,
wired chat, real classifier, re-color. Next: persistence (milestone 6:
IndexedDB, reload restores the deck) and polish (milestone 7).

## License

[MIT](LICENSE)
