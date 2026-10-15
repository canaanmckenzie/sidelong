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
npm run server  # the API server → http://localhost:8787 (needs keys, below)
npm test        # node's built-in test runner
npm run check   # type-check the JSDoc annotations (tsc --noEmit, nothing compiled)
```

The API server reads keys from the environment only — there is no .env
loader, by design:

```
ANTHROPIC_API_KEY=sk-ant-… VOYAGE_API_KEY=pa-… npm run server
```

`GET /healthz` reports which keys it found. `POST /chat` takes
`{ messages: [{ role, content }] }` and streams back SSE events
(`token`, `stop`, `done`, `error`); `POST /embed` takes
`{ texts: [...] }` and returns `{ model, vectors }` from Voyage AI.
Models default to `claude-opus-5-5` and `voyage-3.5-lite`, overridable
with `ANTHROPIC_MODEL` / `VOYAGE_MODEL`.

## Shape

Plain JavaScript, native ES modules, no framework, no build step, zero runtime
dependencies. Types live in JSDoc comments checked by `// @ts-check` — see
`src/types.js` for the data shapes.

- `src/jev.js` — the classifier and the OKLCH painter; pure functions
- `src/deck.js` — rendering, navigation, the composer
- `src/store.js` — deck state (in memory until milestone 6)
- `src/theme.js` — the b/w and slate palettes
- `src/fixtures.js` — the five seed pages, also used by the tests
- `server/index.js` — the thin API server (`/embed`, `/chat`); zero deps, `node:http` + `fetch`
- `server/sse.js` — SSE parsing and Anthropic-stream translation; pure functions
- `tools/serve.js` — the dev server
- `test/jev.test.js`, `test/sse.test.js` — classifier and stream-parsing tests

Milestone status (see HANDOFF.md): **1–2 done** — scaffold and the thin
server. Next: wire the chat (milestone 3).
