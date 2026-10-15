# Session notes — pause after milestone 1 (Oct 14, 2026)

For the next Claude session: read this, then HANDOFF.md. Work happens in
`~/sidelong`. The user does not read TypeScript — that shaped real decisions
below, don't relitigate them.

## State

Milestone 1 of HANDOFF.md is **done and verified**: modules split from the
prototype, 7/7 tests pass (`npm test`), type check clean (`npm run check`),
app confirmed rendering via headless Firefox against `npm run dev`.

**Nothing is committed yet** — git repo initialized, working tree is the
whole project. The user was offered an initial commit and hadn't answered
when the session paused. Ask, or commit if they've said to.

## Decisions already made (with the user, final)

1. **Plain JavaScript, not TypeScript.** `// @ts-check` + JSDoc typedefs,
   `tsc --noEmit` as the gate. Chosen because the user's references are JS
   and Node books. Keep types boring: typedefs in `src/types.js`, no
   generics/clever inference.
2. **Supply-chain hardening** (user raised it explicitly): zero runtime
   deps; dev deps are exactly `typescript` + `@types/node`; `.npmrc` has
   `ignore-scripts=true` + `save-exact=true`; Node's built-in test runner,
   no vitest; no Vite/bundler — native ES modules; zero-dep dev server in
   `tools/serve.js`. Milestone 2's server must stay zero-dep (`node:http`).
3. HANDOFF.md was amended to record 1 and 2 (stack paragraph + milestones
   1–2). The copy in `~/Desktop/sidelong/` matches; repo copy is canonical
   going forward.

## Deviations from the prototype (intentional)

- `jev()` empty-deck case returns a deterministic pale hue (was NaN); tested.
- Dropped `aria-live` from the deck (full re-render would spam screen
  readers); revisit when milestone 3 makes rendering incremental.
- Dropped the `window.claude.hot` artifact-runtime code (prototype-only).

## Known issues / TODOs

- `test/jev.test.js` has a `TODO(milestone 4)`: bag-of-words calls the VLAN
  fixture a new topic (zero shared vocabulary); with embeddings it should
  score near page 1, hue ≈ 196°. Flip the test then.
- Flagged in review, not yet scheduled: strip overflow past ~25 pages
  (handoff defers to milestone 7 but it deserves a design decision sooner);
  the "60° from every page" acceptance criterion is unsatisfiable past 6
  topics; readout should surface verdict changes after re-color.

## Next: milestone 2 (HANDOFF.md)

`server/index.js`, zero-dep `node:http`: `POST /embed` (text → float
vector) and `POST /chat` (messages → SSE token stream, Claude API). Keys
from environment only. CORS for the dev origin. Needs a decision from the
user: which embedding provider (it stays swappable behind `/embed`).

## Environment gotchas learned this session

- `node --test` takes no directory arg on Node 22; bare `node --test`
  auto-discovers `test/`.
- Firefox here is a snap: headless screenshots need profile + output under
  `$HOME`, not `/tmp` (then move the file out and clean up).
- This machine (hob) is a Proxmox guest; see memory `vm-environment` —
  display auto-resize is handled by the `spice-gnomesnap` user service.
