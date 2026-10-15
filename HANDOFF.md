# Sidelong Threads Handoff

Oct 14, 2026 · handoff from the Claude.ai design session

## What this is

Sidelong is a chat interface laid out sideways: every question-and-answer pair is a page, the open page sits in the middle of the screen, and older pages collapse into thin vertical strips on the left so a long session reads as a row of tabs instead of a scroll. Each page carries a small colored square in its corner whose hue says what the page is about and whose saturation says how sure the classifier was, so related follow-ups share a color and a stack of twenty old pages can be scanned by eye.

This document is the handoff for building it. It covers the interaction model, the visual spec, the topic-coloring algorithm (the "jev" hook), the open decisions, the recommended architecture, a milestone plan for Claude Code, and the working prototype (`sidelong.html`), which already implements the layout, both themes, keyboard navigation and a stand-in classifier.

## Interaction model

The unit is a page: one question and its answer. A session is an ordered deck of pages. Exactly one page is open at a time.

- **Deck.** A horizontal row filling the space between the header and the composer. Pages are flex items. The open page takes all remaining width; every other page collapses to a strip 38 px wide (28 px on phones). The width change animates over about 350 ms; it is disabled under `prefers-reduced-motion`.
- **Strips.** (Amended in the Oct 14 aesthetic pass with the user.) A collapsed page carries its topic color as a thin 3 px spine running the full height of its right edge — the deck's only separator; there are no border rules between pages. The strip shows its page number, then its question running top-to-bottom in vertical text, clipped with an ellipsis. When the deck is crowded enough that a strip falls below ~23 px, its text fades out and only the color remains (container query). Hovering a strip tints it; clicking opens it. The full question is in the strip's `title` and `aria-label`.
- **Ordering.** Newest page on the right. When a new question is asked, the current open page collapses leftward and the new page opens in its place. When the user opens an older page, pages on both sides collapse; nothing is ever reordered.
- **Navigation.** Left and right arrow keys move the open page when focus is not in the composer. Clicking any strip opens it. Horizontal trackpad scroll over the deck should also step pages (not in the prototype).
- **Open page.** The question as the heading, a one-line classifier readout beneath it in monospace, then the answer in a 66-character column centered in the page. The page scrolls vertically only if the answer is long; the deck itself never scrolls vertically.
- **Composer.** A single textarea pinned to the bottom, growing to at most 40% of the viewport, its left edge flush with the open page's left edge (it follows the deck, animated). Enter submits; Shift+Enter inserts a newline. Submitting creates and opens the new page immediately, before the model responds, so the square and the question appear at once and the answer streams into the page. A small `%` glyph in its right corner opens the usage readout.
- **Header.** Page count and the arrow-key hint on the right, then the theme toggle. No product name, nothing else.

What this deliberately leaves out: branching (a follow-up to an old page still appends to the end of the deck), multi-page selection, and any sidebar. Keep it to one row of pages.

## Visual spec

Two themes, one toggle, no other color anywhere except the topic squares. The page is black on white by default and slate with cream in dark mode. The toggle sets `data-theme` on the root and is remembered in `localStorage`; with no explicit choice the OS preference applies.

| Token | Light (b/w) | Dark (slate/cream) | Used for |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#2d3540` | page background |
| `--fg` | `#111111` | `#f3ecd9` | text, rules, the theme swatch |
| `--mute` | `#6f6f6f` | `#b7af9c` | strip text, readout, placeholder |
| `--line` | `#111111` | `#f3ecd9` | 1 px rules between pages, header, composer |
| `--faint` | `#ececec` | `#3a4450` | strip hover |
| `--sq-l` | `0.62` | `0.80` | OKLCH lightness of every topic square |

Typography: Newsreader (serif, optical size axis) for questions and answers at 17 px with 1.55 line height; IBM Plex Mono at 11 px, uppercase with 0.06 em tracking, for the header, strips, readout and buttons. Questions are Newsreader 500 at 1.35 rem. Keep running text at 66 characters.

On the open page the topic square is 12 × 12 px, no border, no radius, 12 px from the left and 17 px from the top (level with the question head); on collapsed pages the same color renders as the 3 px right-edge spine instead. Its color is `oklch(var(--sq-l) var(--sq-c) var(--sq-h))` with an `hsl()` fallback declared first for browsers without OKLCH. Hue and chroma come from the classifier (next section); lightness comes from the theme so squares stay legible on both backgrounds.

Rules: none (amended Oct 14 — the page borders and the header/composer rules were removed with the user; the color spines are the only separators, and whitespace does the rest). No shadows, no card styling, no icons. Focus rings are 2 px solid `--fg` with 3 px offset. Side gutter is `max(16px, env(safe-area-inset-*))`; the app is sized with `height: 100%` on `html` and `body`, never `100vh`.

## Topic coloring: the jev hook

`jev(question, pages)` runs the moment a question is submitted and returns a hue angle, a confidence, the nearest page and its score. The page is painted from that before the model has answered. The prototype implements it with bag-of-words cosine; the real build swaps in an embedding model and keeps everything downstream.

**1. Represent.** Every page has a vector built from its question plus its answer. A new question is embedded alone (it is all we have at submit time).

**2. Score.** Similarity to each existing page is cosine:

```latex
\operatorname{sim}(q, p_i) = \frac{q \cdot p_i}{\lVert q \rVert \, \lVert p_i \rVert}
```

**3. Place.** If the best score clears a floor, the new page's position on the hue circle is the similarity-weighted centroid of the pages it resembles, with weights squared so one strong neighbor outweighs two weak ones:

```latex
\vec{x}_{\text{new}} = \frac{\sum_i \operatorname{sim}_i^{2}\, r_i \,(\cos\theta_i, \sin\theta_i)}{\sum_i \operatorname{sim}_i^{2}}, \qquad \theta_{\text{new}} = \operatorname{atan2}(y, x) + \delta
```

where `δ` is a small deterministic jitter of ±4° hashed from the question text, so sibling follow-ups are near but not identical. Pages below 0.03 similarity are excluded from the sum.

**4. Confidence.** The radius is the calibrated best score, and it drives saturation:

```latex
r = 0.3 + 0.7 \cdot \min\!\left(1,\; k \cdot \max_i \operatorname{sim}_i\right), \qquad C = 0.03 + 0.15\, r
```

`k` is a calibration constant: 5 for bag-of-words (a 0.2 cosine is a strong match there), re-fit per embedding model. Measured fit for `nomic-embed-text` (tools/calibrate.js, Oct 2026): related questions score 0.51–0.59 against their pages and unrelated ones top out at 0.41, so `k = 1.5`, floor 0.46, centroid drop 0.42.

**5. New topic.** If the best score is below the floor (0.06 in the prototype), the question is a new topic. It takes the midpoint of the widest empty arc on the hue circle and a radius of 0.25, so it shows up pale. Its hue is therefore relative to the conversation's history, not fixed (see Open decisions).

**6. Paint.** Hue maps directly to OKLCH hue, radius to chroma, lightness is the theme's. OKLCH matters: in HSL a 30° step through yellow is nearly invisible while the same step through blue is large, so "visually similar means topically similar" only holds in a perceptually uniform space. Perceived distance between two squares is approximately

```latex
\Delta E \approx \sqrt{\Delta L^{2} + \Delta C^{2} + (C\,\Delta h)^{2}}
```

**7. Re-color.** Once the answer has streamed, re-embed question plus answer and re-run steps 2 to 4. The answer text is a far better signal than a seven-word question. Animate the square's color over about 400 ms; never move the page.

The readout under each question exposes the inference: `follow-up · nearest #2 0.64 · hue 229° · confidence 96%`. Keep it; it is how the user learns to trust the squares, and how you debug them.

## Open decisions

Three choices change the build and should be settled before milestone 2.

1. **Conversation-local hues or a global legend.** The prototype places a new topic in the widest empty arc, so blue means networking only in this deck. If blue should mean networking in every deck, hue must be anchored to a fixed set of reference embeddings (a dozen seed topics spaced around the circle), with each page placed by its nearest anchor plus a local offset. Local is simpler and matches the stated use (scanning one stack); global is what you want if decks are ever compared. Default: local.
2. **What a page is.** One question-and-answer pair. A follow-up to an old page appends to the end of the deck and is colored by similarity, which is what links it visually. Branching trees were considered and rejected for v1; they turn a row into a graph.
3. **Hue is one dimension and topics are not.** Any projection to a circle will eventually put two unrelated topics at adjacent angles. Accept this for v1. If it becomes a problem, chroma is already spent on confidence, so the next free channel is a second square or a short tick mark, not lightness (lightness belongs to the theme).

Two smaller ones: whether the re-color after the answer should also be allowed to change the verdict from "new topic" to "follow-up" (recommended yes), and whether the embedding call should run on the client with an API key or through a thin server (depends on the architecture choice below).

## Architecture

Build it as a standalone app, not a userscript on top of claude.ai. A userscript can reflow the existing thread into columns, but it cannot run the classifier before the answer exists, cannot read the model's reply as structured data, and breaks whenever the page's internal markup changes. The whole point of the design lives in the moment between submit and first token, which only your own front-end controls.

```
Composer (Enter) -> Embed question [server -> ollama] -> jev(): hue + confidence -> Page opens, square painted
                                                                                          |
Re-color square (verdict may change) <- Re-embed q + a [server -> ollama] <- Answer streams [server -> claude -p]
```

[server] steps run on the thin local server; everything else is the client.

The client owns the deck, the pages, the squares and the two themes. A thin server does two things: embeds text and streams chat completions. There are **no API keys anywhere** (amended Oct 14, 2026 — the maintainer wants zero marginal cost): chat drives the Claude Code CLI the maintainer is already logged into (headless `claude -p --resume`, billed to the existing Max subscription — a deck is one Claude session, so sidelong is a different lens on a normal conversation, not a separate account), and embeddings come from a local Ollama (`nomic-embed-text`, installed user-locally under `~/.local`). Nothing else is server-side; pages are kept in the browser (IndexedDB) for v1, with export to a JSON file.

Stack: a single-page app in vanilla JavaScript, type-checked with `// @ts-check` and JSDoc annotations (the same checker TypeScript uses, but every source file stays plain JavaScript — chosen because the maintainer's references are JS and Node books), with no framework (the prototype is already framework-free and the DOM is small), no build tool — the source is native ES modules, served as written — and a Node server of under 100 lines exposing `POST /embed` and `POST /chat` (server-sent events). Dependency policy, because npm supply-chain attacks are a live threat: zero runtime dependencies; dev dependencies limited to `typescript` and `@types/node`; tests on Node's built-in `node:test`; a zero-dependency static dev server in `tools/`; `.npmrc` sets `ignore-scripts=true` and `save-exact=true`, and the lockfile is committed. Chat goes through the Claude Code CLI (no SDK, no key — see above). Embeddings stay behind the `/embed` route so the provider can be swapped; the hue placement only needs cosine similarity, not any particular model. The OKLCH painting and the `jev()` function are pure functions with no dependencies and port directly from the prototype.

## Implementation plan for Claude Code

Start from the prototype file, not from scratch; it already passes the layout, theme and keyboard requirements. Each milestone is independently shippable.

1. **Scaffold.** Checked JavaScript: `// @ts-check` + JSDoc typedefs with `tsc --noEmit` as the gate, native ES modules with no build step, Node's built-in test runner. Split `sidelong.html` into `index.html`, `src/deck.js` (render, navigation, composer), `src/jev.js` (the classifier and the OKLCH painter, pure functions), `src/theme.js`, `src/store.js`. Keep the CSS in one file; the token block at the top is the design system. Port the five sample pages as fixtures for tests.
2. **Server.** `server/index.js` with `POST /embed` (texts in, float vectors out, via local Ollama) and `POST /chat` (`{prompt, sessionId?}` in, SSE out: `session`/`token`/`stop`/`done`/`limit`/`error`, via headless `claude -p`; the CLI owns conversation history; `limit` carries the plan's usage windows, shown behind the composer's `%` glyph). No keys. CORS to the dev origin.
3. **Wire the chat.** On submit: create the page, open it, call `/chat` (with the deck's `sessionId` after the first page), append tokens to the answer as they arrive. The page must open before the first token.
4. **Real classifier.** Replace the bag-of-words vector with `/embed`. Re-fit `k` so a known follow-up (CoDel after Smart Queues) lands above 0.8 confidence and a known new topic (sourdough) lands below the floor. Keep the bag-of-words version as an offline fallback when the server is unreachable.
5. **Re-color.** After the stream ends, re-embed question plus answer, re-run `jev`, animate the square. Allow the verdict to change.
6. **Persistence.** IndexedDB for pages; load the last deck on open; export and import as JSON.
7. **Polish.** Horizontal trackpad scroll steps pages; strip tooltips; a page count cap or overflow rail once strips would exceed the viewport (about 30 pages at desktop width).

Tests worth writing: `jev` on the five fixtures reproduces the hues within 10°; a new topic takes the widest arc; OKLCH chroma is monotonic in confidence; the deck never scrolls horizontally at 400 px width.

A first prompt for Claude Code: "Read `HANDOFF.md` and `sidelong.html`. Scaffold milestone 1 exactly as the plan describes, keeping the prototype's CSS tokens and `jev()` unchanged, and stop before milestone 2 for review."

## The prototype

`sidelong.html` is one self-contained file: about 180 lines of CSS, 200 of JavaScript, no build step, no dependencies beyond two Google Fonts. Open it in any browser, or run it from the published artifact in this conversation. It is also in the repo this handoff ships with.

What works: the deck and strips, open-page layout, arrow-key and click navigation, the composer, both themes with the toggle and OS fallback, the topic square with OKLCH and `hsl()` fallback, the readout line, and a working `jev()` over bag-of-words cosine with the centroid placement, new-topic arc rule, jitter and confidence-to-chroma mapping described above.

What is stubbed: there is no model. Asking a question creates and opens a page whose answer explains what the classifier just did. The five seed pages carry hand-set hues (the values an embedding model would produce), so their readouts are fixed rather than computed. Nothing persists across reloads except the theme choice.

Two things in the prototype are worth keeping verbatim in the real build: the CSS token block (the design system is those six variables plus two font stacks) and `jev()` with its helpers, which need only the `vec()` function replaced by an embedding call.

## Acceptance criteria

- A new question opens as a page in the center within one frame of pressing Enter, with its square already colored; the answer streams in afterward.
- A follow-up on the same topic gets a square within 15° of hue of the page it follows, at 80% confidence or higher.
- A question on an unrelated topic gets a pale square at least 60° of hue from every existing page.
- Older pages read as strips on the left with square, number and vertical question text; clicking any strip opens it; left and right arrows step through the deck.
- Black on white and slate with cream are the only two palettes; the toggle switches instantly and is remembered; with no choice made, the OS setting applies.
- No vertical scrolling of the deck at any page count; no horizontal scrolling of the page body at 400 px width.
- The readout under each question shows nearest page, score, hue and confidence, and updates after the re-color.
- Reloading restores the deck.
