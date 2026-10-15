# Session notes — pause after milestone 2 (Oct 14, 2026)

For the next Claude session: read this, then HANDOFF.md. Work happens in
`~/sidelong`. The user does not read TypeScript — that shaped real decisions
below, don't relitigate them.

## State

Milestones 1 **and 2** of HANDOFF.md are done:

- Milestone 1 (scaffold): committed as `a4e0d98`. Modules split from the
  prototype, tests on `node:test`, `tsc --noEmit` clean.
- Milestone 2 (server): `server/index.js` (zero-dep, `node:http` + `fetch`)
  with `POST /embed` (Voyage AI), `POST /chat` (Claude API, raw HTTP —
  no SDK, per the zero-runtime-deps policy — re-emitted as simplified SSE:
  `token` / `stop` / `done` / `error`), `GET /healthz`, CORS for the dev
  origin. Pure SSE parsing lives in `server/sse.js` and is tested.
  13/13 tests pass, type check clean, endpoints smoke-tested with curl
  (preflight, validation, missing-key 503s, 404).

**Not yet verified live:** no API keys exist on this machine (`ant` CLI not
installed, nothing in env), so `/chat` and `/embed` have not run against the
real APIs. First thing next session: user supplies `ANTHROPIC_API_KEY` and
`VOYAGE_API_KEY`, run `npm run server`, curl one real chat stream and one
embed before building on them.

## Decisions already made (with the user, final)

1. **Plain JavaScript, not TypeScript.** `// @ts-check` + JSDoc typedefs,
   `tsc --noEmit` as the gate. Keep types boring.
2. **Supply-chain hardening:** zero runtime deps; dev deps are exactly
   `typescript` + `@types/node`; `.npmrc` has `ignore-scripts=true` +
   `save-exact=true`; no bundler; built-in test runner. The server
   therefore calls the Claude API over raw HTTP (`fetch`), not the SDK.
3. **Embedding provider: Voyage AI** (user chose it Oct 14, 2026), model
   `voyage-3.5-lite` by default, swappable via `VOYAGE_MODEL` and the
   `/embed` route boundary.
4. **Chat model:** `claude-opus-5-5` (current default Opus), overridable
   via `ANTHROPIC_MODEL`. Request includes the server-side refusal
   fallback (`fallbacks: "default"` + beta header
   `server-side-fallback-2026-07-01`) — on a safety decline the API
   retries on a fallback model in the same call. Thinking is adaptive
   (always on for this model); the server forwards only text deltas.
5. Git identity set repo-local: `glitch <canaanmckenzie5@gmail.com>`.

## Known issues / TODOs

- `test/jev.test.js` has a `TODO(milestone 4)`: bag-of-words calls the VLAN
  fixture a new topic; with embeddings it should score near page 1,
  hue ≈ 196°. Flip the test then.
- Flagged in review, not yet scheduled: strip overflow past ~25 pages;
  the "60° from every page" acceptance criterion is unsatisfiable past 6
  topics; readout should surface verdict changes after re-color.
- `/chat` currently hardcodes `max_tokens: 64000` and no system prompt
  unless the client sends one; revisit when wiring the UI.

## Next: milestone 3 (HANDOFF.md)

Wire the chat. On submit: create the page, open it (before the first
token), call `POST /chat`, append streamed tokens to the answer. The
client should read `/healthz` to decide whether the server is up (the
offline bag-of-words fallback is milestone 4's concern but don't paint
yourself into a corner).

## Environment gotchas learned

- `node --test` takes no directory arg on Node 22; bare `node --test`
  auto-discovers `test/`.
- Firefox here is a snap: headless screenshots need profile + output under
  `$HOME`, not `/tmp` (then move the file out and clean up).
- This machine (hob) is a Proxmox guest; see memory `vm-environment`.
- Git identity was unset machine-wide; it is now set repo-locally only.
