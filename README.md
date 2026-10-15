# Sidelong

A chat interface laid out sideways: every question-and-answer pair is a page,
the open page sits in the middle, and older pages collapse into thin vertical
strips on the left. Each page carries a colored square whose hue says what it
is about and whose saturation says how sure the classifier was.

`HANDOFF.md` is the full design document. `prototype/sidelong.html` is the
original one-file prototype this build is split from.

## Running it

```
npm install     # dev deps only: typescript + @types/node; scripts disabled via .npmrc
npm run dev     # zero-dependency static server → http://localhost:5173
npm run server  # the API server → http://localhost:8787 (no keys needed)
npm test        # node's built-in test runner
npm run check   # type-check the JSDoc annotations (tsc --noEmit, nothing compiled)
```

There are no API keys. `POST /chat` takes `{ prompt, sessionId? }` and
streams SSE events (`session`, `token`, `stop`, `done`, `limit`, `error`) by
driving the Claude Code CLI you're already logged into (headless
`claude -p --resume`, billed to the existing Max subscription — a deck
is one Claude session). `POST /embed` takes `{ texts: [...] }` and
returns `{ model, vectors }` from a local Ollama (`ollama serve` with
`nomic-embed-text`; `GET /healthz` reports whether it's reachable).
Overridable via `CLAUDE_BIN`, `OLLAMA_URL`, `EMBED_MODEL`, `PORT`,
`SIDELONG_ORIGIN`.

## Shape

Plain JavaScript, native ES modules, no framework, no build step, zero runtime
dependencies. Types live in JSDoc comments checked by `// @ts-check` — see
`src/types.js` for the data shapes.

- `src/jev.js` — the classifier and the OKLCH painter; pure functions
- `src/deck.js` — rendering, navigation, the composer
- `src/store.js` — deck state (in memory until milestone 6)
- `src/theme.js` — the b/w and slate palettes
- `src/chat.js` — streaming client for the thin server (`serverUp`, `streamChat`)
- `src/limits.js` — the `%` usage glyph and its readout
- `src/fixtures.js` — the five seed pages, also used by the tests
- `server/index.js` — the thin API server (`/embed`, `/chat`); zero deps, `node:http` + `claude -p` + Ollama
- `server/sse.js` — NDJSON/SSE parsing and stream-event translation; pure functions
- `tools/serve.js` — the dev server
- `test/jev.test.js`, `test/sse.test.js` — classifier and stream-parsing tests

Milestone status (see HANDOFF.md): **1–4 done** — scaffold, the thin
server, the wired chat, and the real classifier (squares paint instantly
from bag-of-words, then sharpen from local embeddings ~30 ms later;
offline, the word-match placement stands and the readout says so). Run
`npm run dev`, `npm run server`, and `ollama serve`, then ask away.
Next: re-color after the answer (milestone 5).
