# Session notes — pause after milestone 3 (Oct 14, 2026)

For the next Claude session: read this, then HANDOFF.md. Work happens in
`~/sidelong`. The user does not read TypeScript — that shaped real decisions
below, don't relitigate them.

## State

Milestones 1–3 of HANDOFF.md are done and verified, plus the usage glyph:

- M1 scaffold (`a4e0d98`), M2 server (`2ecdc94`), usage glyph (`7de5a77`).
- M3 wire-the-chat: `src/chat.js` (`serverUp`, `streamChat` — reads the
  POST /chat SSE body with the same pure parser the server uses, imported
  from `server/sse.js`; one parser, one source of truth). `deck.js` ask()
  now: jev() → page opens painted before any token → tokens stream into
  `p.a` via a targeted answer-only redraw (`renderAnswer`, no full deck
  re-render per token) → `session` event stored in `state.sessionId`
  (passed back as `--resume`; CLI owns history) → `limit` events feed the
  `%` glyph live → non-`end_turn` stops and errors land in `p.note`
  (muted italic) → `reindexPage` after the stream so later questions
  score against the full answer. Composer blocks concurrent submits
  (`busy` + disabled Ask). Boot pings /healthz; offline → composer
  placeholder says "server offline — npm run server, then ask away".
- Verified live: Node ran `src/chat.js` against the real server — all
  five event types, streamed text exact, resumed turn recalled turn 1;
  headless-Firefox screenshots confirm clean boot and the offline
  placeholder. 25/25 tests, type check clean.

## Decisions already made (with the user, final)

1. **Plain JavaScript, not TypeScript.** `// @ts-check` + JSDoc typedefs,
   `tsc --noEmit` as the gate. Keep types boring.
2. **Supply-chain hardening:** zero runtime deps; dev deps are exactly
   `typescript` + `@types/node`; `.npmrc` has `ignore-scripts=true` +
   `save-exact=true`; no bundler; built-in test runner.
3. **Zero marginal cost — no API keys, ever.** Chat = Claude Code CLI on
   the user's Max plan (headless `claude -p --resume`); embeddings =
   local Ollama (`nomic-embed-text`). The user's framing: sidelong is
   "not standalone, it's just a filter on our normal conversation, just
   formatted in a different way." A deck = one Claude session.
4. **Limits on demand only:** the `%` glyph in the composer corner; panel
   shows 5-hour/7-day windows, "limit reached", and reading freshness.
   `claude -p` errors at a limit rather than waiting; deck survives,
   resubmit after reset. Composer disable/auto-retry on limit = possible
   later nicety, not committed to.
5. Git identity set repo-local: `glitch <canaanmckenzie5@gmail.com>`.
6. HANDOFF.md amended for all of this; repo copy canonical, Desktop
   copy synced.

## Known issues / TODOs

- `test/jev.test.js` `TODO(milestone 4)`: bag-of-words calls the VLAN
  fixture a new topic; with embeddings it should score near page 1,
  hue ≈ 196°. Flip the test then; re-fit `k` (≈1.25) for embeddings.
- Answers render as plain-text paragraphs (split on blank lines); the
  CLI returns markdown, so lists/code blocks show raw. Fine for v1;
  worth a design decision eventually (handoff never specified markdown).
- Flagged in review, not yet scheduled: strip overflow past ~25 pages;
  "60° from every page" criterion unsatisfiable past 6 topics; readout
  should surface verdict changes after re-color (milestone 5).
- No per-turn timeout on the CLI spawn; a hung turn leaves the composer
  busy until the server is restarted. Revisit if it bites.

## Next: milestone 4 (HANDOFF.md)

Real classifier. Replace the bag-of-words `vec()` with `POST /embed`
(Ollama vectors, 768 dims): embed the question alone at submit, embed
question+answer after the stream (milestone 5 does the re-color; m4 can
still store the richer vector). Keep bag-of-words as the offline
fallback when `/healthz` says the server or Ollama is down. Re-fit `k`
so CoDel-after-Smart-Queues lands ≥0.8 confidence and sourdough lands
below the floor; flip the VLAN test. Note `jev()` is sync today and
embedding is async — the submit path must stay "page opens within one
frame", so paint from the sync fallback first and re-place from the
embedding when it arrives, or make ask() await /embed before jev (it's
~ms-fast locally; measure before complicating).

## Environment

- **Ollama** user-local, no sudo: `~/.local/bin/ollama` →
  `~/.local/share/ollama-dist/extracted/` (v0.40.4); model
  `nomic-embed-text` pulled. The 1.4G tarball still sits at
  `~/.local/share/ollama-dist/` — deletable. `ollama serve` is ad hoc,
  NOT a service; start it before testing /embed (systemd user unit =
  ask the user first).
- Running the app = three processes: `npm run dev` (5173),
  `npm run server` (8787), `ollama serve` (11434).

## Environment gotchas learned

- `node --test` takes no directory arg on Node 22; bare `node --test`
  auto-discovers `test/`.
- Firefox here is a snap: headless screenshots need profile + output
  under `$HOME`, not `/tmp` (then move the file out and clean up).
- This machine (hob) is a Proxmox guest; see memory `vm-environment`.
- Git identity was unset machine-wide; now set repo-locally only.
- Ollama's `ollama.com/download/...tgz` URL 404s; the real asset is
  `ollama-linux-amd64.tar.zst` on GitHub releases.
- Stray dev servers on :8787 bite — `fuser -k 8787/tcp` before tests.
