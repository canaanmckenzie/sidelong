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

## Milestone 4 + markdown (done this session, after m3)

- **M4 real classifier:** placement logic extracted to
  `place(question, sims, pages, cal)` in jev.js — bag-of-words and
  embeddings share centroid/arc/jitter/confidence. Submit paints
  instantly from bag-of-words (`BOW` cal), then `deck.refine()` embeds
  the question + any pages missing vectors (seeds self-heal) and
  re-places with `EMB`; square color cross-fades 400 ms (reduced-motion
  respected), page never moves. After the stream, evec upgrades to q+a
  (re-color from it = milestone 5). /embed failure → word-match stands,
  readout appends "offline".
- **Calibration is measured, not guessed:** `tools/calibrate.js` prints
  the question→page cosine matrix. nomic-embed-text: related 0.51–0.59,
  unrelated ≤0.41 → `EMB = {k: 1.5, floor: 0.46, drop: 0.42}`. The
  handoff's k≈1.25 guess and the "VLAN ≈196°" TODO were wrong: VLAN
  correctly lands beside Smart Queues (~222°, single qualifying
  neighbor). If EMBED_MODEL changes, re-run the script, refit EMB and
  the pinned sims in test/jev.test.js. Warm embed ≈ 25–55 ms.
- **Markdown (user: "1000% we need markdown"):** `Page.a` is now a raw
  markdown STRING (fixtures join their arrays; persistence will want
  this shape). `src/md.js` = pure zero-dep parser (fences with lang,
  #–#### headings → h3+, ul/ol, blockquotes, inline code/bold/em/links;
  streaming-safe: unclosed fence renders). deck.js builds DOM via
  textContent only — no innerHTML, no injection path. Styles stay in
  the design system (code on --faint, hairline blockquote rule).

## Known issues / TODOs

- Flagged in review, not yet scheduled: strip overflow past ~25 pages;
  "60° from every page" criterion unsatisfiable past 6 topics; readout
  should surface verdict changes after re-color (milestone 5).
- No per-turn timeout on the CLI spawn; a hung turn leaves the composer
  busy until the server is restarted. Revisit if it bites.
- md.js em/strong don't nest (flat tokenization); tables and images
  unsupported. Fine until it visibly bites.

## Next: milestone 5 (HANDOFF.md) + aesthetics

**The user wants an aesthetics session**: "I want this thing to look
and feel good, snappy, clean" — they asked to be invited to give input.
Do that before or alongside milestone 5 (re-color after the answer:
re-run place() from the q+a evec — deck.js finally-block already stores
it — animate the square, allow the verdict to change, surface verdict
changes in the readout).

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
