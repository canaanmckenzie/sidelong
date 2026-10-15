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
5. Git identity is set repo-local (it was unset machine-wide).
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

## Aesthetic passes 1–2 (user-driven, Oct 14)

Reviewed live by the user against screenshots (~/sidelong-qa*.png):
- Strip spacing bug fixed (vertical-rl axes: the gaps are
  padding-INLINE, centering is padding-BLOCK — don't regress this).
- Collapsed pages: 12px square → 3px full-height color spine on the
  right edge, the deck's ONLY separator (page border-left removed,
  header/composer rules removed, brand text removed).
- Question title at 17px top padding ("a hair below the strip heads"),
  open-page square level with it.
- Composer's first character flush with the open page's left edge —
  computed as active-index × strip width (not measured; lands on the
  post-animation value), transitioned like the deck.
- Crowded decks: container query fades strip text below 23px width →
  pure color (user: "after the words become unreadable, it's just
  colors").
- Usage readout times are 12-hour am/pm.
- HANDOFF.md visual spec amended for all of it.

## Milestone 5 (done)

recolor(p, i) in deck.js: after the stream, embed(q+a) → re-place with
EMB → square cross-fades (existing 400ms transition), verdict may
change; when it does, p.was keeps the old word and the readout shows
"new topic → follow-up". Offline → submit-time placement stands.

## GitHub

Public at https://github.com/canaanmckenzie/sidelong (pushed Oct 14,
2026). MIT licensed. History was rewritten pre-push so all authorship
is the user's noreply address — keep repo-local `user.email` as is;
never commit with the real email. `gh` CLI is authed (HTTPS, token in
plain `~/.config/gh/hosts.yml` — keyring was janky on this box).
Note: `~/.gitconfig` symlinks to `~/lab/dotfiles/git/gitconfig`; the
target was created empty during gh setup (credential helper lives
there now).

## The sardines incident (Oct 14, user bug report)

"random question about sardines" read as a blue follow-up at 88%.
Diagnosis (measured, scripts were in scratchpad; method = embed probe
pairs and compare): nomic-embed-text cannot separate "same thread" from
"same domain" — sardines→sourdough-page 0.535 OUTSCORED the true
follow-up codel→smartq 0.511, and the chatty "testing" page crossed the
floor vs networking (0.499), took blue, and became an attractor for
later chatty questions. Neither nomic task prefixes nor question↔
question scoring fixed the ordering. Bake-off (nomic / mxbai-embed-large
/ embeddinggemma raw) on fixtures + adversarial probes: mxbai separates
(related 0.49–0.64, unrelated topical ≤0.29, cross-domain/meta
0.40–0.41). Switched EMBED_MODEL default to mxbai-embed-large,
EMB = {k: 1.45, floor: 0.42, drop: 0.38}, regression test pinned
("embeddings: cross-domain and meta questions stay new topics").
Warm embed 40–75 ms. nomic-embed-text is still pulled on this machine
(`ollama rm nomic-embed-text` reclaims ~270 MB).
Lesson for future model swaps: calibrate.js fixtures alone overfit —
always probe cross-domain and chatty/meta cases too.

Also this pass: header page count removed (user request); readout
earlier trimmed to verdict + confidence with raw numbers in the
tooltip.

## Next: milestone 6 (HANDOFF.md)

Persistence: IndexedDB for pages behind the existing store functions;
load the last deck on open (restore sessionId with it so the Claude
session resumes); export/import JSON. Mind: evec arrays (768 floats)
serialize fine; vec Maps need structured clone (IndexedDB handles Maps)
or rebuild via reindexPage on load. Then milestone 7 polish (trackpad
scroll steps pages; strip overflow rail past ~30 pages — the container
query already handles legibility).

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
- The dev box is a VM; display quirks are usually viewer-side.
- Ollama's `ollama.com/download/...tgz` URL 404s; the real asset is
  `ollama-linux-amd64.tar.zst` on GitHub releases.
- Stray dev servers on :8787 bite — `fuser -k 8787/tcp` before tests.
