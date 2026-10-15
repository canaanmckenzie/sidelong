# Session notes — pause after milestone 2 (Oct 14, 2026)

For the next Claude session: read this, then HANDOFF.md. Work happens in
`~/sidelong`. The user does not read TypeScript — that shaped real decisions
below, don't relitigate them.

## State

Milestones 1 **and 2** of HANDOFF.md are done and verified end-to-end:

- Milestone 1 (scaffold): committed as `a4e0d98`.
- Milestone 2 (server): `server/index.js`, zero-dep. `POST /chat` spawns
  the Claude Code CLI headless (`claude -p --output-format stream-json
  --include-partial-messages --verbose --disallowedTools "*"
  --strict-mcp-config`, `--resume <sessionId>` for continuity, cwd =
  $HOME) and re-emits simplified SSE: `session`/`token`/`stop`/`done`/
  `error`. `POST /embed` calls local Ollama (`/api/embed`,
  `nomic-embed-text`, 768 dims). `GET /healthz` pings Ollama. Pure
  parsing/translation in `server/sse.js`, tested (17/17 pass, type
  check clean). **Live-verified:** real embed vectors returned; real
  chat turn streamed tokens; `--resume` correctly recalled turn 1 in
  turn 2. Both at zero marginal cost.

## Decisions already made (with the user, final)

1. **Plain JavaScript, not TypeScript.** `// @ts-check` + JSDoc typedefs,
   `tsc --noEmit` as the gate. Keep types boring.
2. **Supply-chain hardening:** zero runtime deps; dev deps are exactly
   `typescript` + `@types/node`; `.npmrc` has `ignore-scripts=true` +
   `save-exact=true`; no bundler; built-in test runner.
3. **Zero marginal cost — no API keys, ever** (user, Oct 14 2026: "I
   don't want to pay anything for this"). Voyage was proposed and
   rejected in favor of **local Ollama embeddings**; chat was moved off
   the Anthropic API onto the **Claude Code CLI, billed to the user's
   existing Max plan**. The user's framing, keep it: sidelong is "not
   standalone, it's just a filter on our normal conversation, just
   formatted in a different way." A deck = one Claude session.
4. **Embedding model:** `nomic-embed-text` via Ollama, swappable via
   `EMBED_MODEL` + the `/embed` route boundary.
5. Git identity set repo-local: `glitch <canaanmckenzie5@gmail.com>`.
6. HANDOFF.md (architecture + milestones 2–3) amended to record all of
   this; repo copy is canonical, Desktop copy synced.

## Environment set up this session

- **Ollama** installed user-locally, no sudo: tarball extracted at
  `~/.local/share/ollama-dist/extracted/`, symlink `~/.local/bin/ollama`
  (v0.40.4). The 1.4G tarball is still at `~/.local/share/ollama-dist/`
  — safe to delete if disk gets tight. Model `nomic-embed-text` pulled.
- `ollama serve` was started ad hoc in the background; it is NOT a
  service. Next session: start it (`~/.local/bin/ollama serve &`) before
  testing /embed, or set up a systemd user unit (ask the user first).
- `~/.local/bin` may not be on PATH in all shells; the npm scripts don't
  need it (server reaches Ollama over HTTP), only manual `ollama` calls.

## Known issues / TODOs

- `test/jev.test.js` has a `TODO(milestone 4)`: bag-of-words calls the VLAN
  fixture a new topic; with embeddings it should score near page 1,
  hue ≈ 196°. Flip the test then; re-fit `k` for nomic-embed-text.
- Flagged in review, not yet scheduled: strip overflow past ~25 pages;
  the "60° from every page" acceptance criterion is unsatisfiable past 6
  topics; readout should surface verdict changes after re-color.
- `/chat` runs the CLI with all tools disallowed (pure chat). Revisit if
  the user wants tool-using turns inside sidelong.
- Headless CLI startup adds ~2–4s before the first token; acceptable for
  v1, but the "page opens before first token" design hides it anyway.

## Added after milestone 2: the usage glyph

User request (Oct 14): limits shown only on demand, "a little icon at the
bottom I can click." Implemented end to end:

- Server: `rate_limit_event` CLI lines → `limit` SSE events
  (`{status, windows: {fiveHour, sevenDay}}`, utilization 0–1, resetsAt
  unix seconds); last reading cached and served on `/healthz` as `limits`.
- Client: `src/limits.js` — a mono `%` button in the composer's right
  corner, panel above it (border-only, design-system styling). Shows both
  windows, "limit reached" when status ≠ allowed, and when the reading
  was taken; persists the last reading in localStorage; fetches /healthz
  on open. `initLimits` returns `{update}` — **milestone 3 must call it
  with each `limit` event off the chat stream** (main.js has the comment).
- Note: `claude -p` does NOT wait at a usage limit; it errors out. The
  deck survives (sessions persist on disk; resubmit with --resume after
  reset). A composer disable/auto-retry on limit is a possible milestone
  3+ nicety, not committed to.

## Next: milestone 3 (HANDOFF.md)

Wire the chat. On submit: create the page, open it (before the first
token), call `POST /chat` with the deck's `sessionId` (undefined for a
new deck; store the one from the `session` SSE event), append streamed
tokens to the answer. Read `/healthz` to decide whether the server is up
(offline bag-of-words fallback is milestone 4's concern but don't paint
yourself into a corner).

## Environment gotchas learned

- `node --test` takes no directory arg on Node 22; bare `node --test`
  auto-discovers `test/`.
- Firefox here is a snap: headless screenshots need profile + output under
  `$HOME`, not `/tmp` (then move the file out and clean up).
- This machine (hob) is a Proxmox guest; see memory `vm-environment`.
- Git identity was unset machine-wide; it is now set repo-locally only.
- Ollama's download URL `ollama.com/download/ollama-linux-amd64.tgz`
  404s; the real asset is `ollama-linux-amd64.tar.zst` on GitHub releases.
- Stray dev servers on :8787 bite — `fuser -k 8787/tcp` before tests.
