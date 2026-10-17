---
tags: [decisions, log, history]
sources: []
verified: 2026-10-16
---

# Decision log

Append-only record of decisions for the Base UI port: dated `### D<n> — title (YYYY-MM-DD)` entries, newest last; never edit an old entry, supersede it with a new one.

## How to add an entry

- Take the next number and today's date. State the decision, the evidence for it, and what it rules out.
- To change a decision, add a new entry that names the one it supersedes (for example, "Supersedes D2"). Leave the old entry as written.
- Keep each entry to a few bullets. Put mechanism detail in the topic file it concerns and link to it.

## Entries

### D1 — `context/` replaces `.kb/` (2026-10-16)

- `packages/base-ui/.kb/` is replaced by `packages/base-ui/context/`. A dot folder is hidden from ripgrep by default: a search that found 6 hits with `--hidden` found 0 without it, so agents missed the notes.
- `.kb/` had 55 files with about 14 stale or duplicated notes (old snapshots, stubs, merged topics, notes citing finished plans).
- The per-package index (`INDEX.md` at the root of the context folder) is generated from each file's frontmatter and summary by `scripts/context-map.ts`. `bun run test:scripts` fails on a stale index, a missing source path, or a broken link.
- `packages/base-ui/packages/solid/PORT_CLEANUP.md` is deleted. Its TypeScript items are done. Its two `useSwipeDismiss` `const-comparisons` items no longer apply: oxlint's `const-comparisons` rule reports nothing in the current file or in its upstream counterpart. Its oxlint plan is superseded by D2.

### D2 — Base UI lint moves from ESLint to oxlint (2026-10-16)

- Base UI lint moves from ESLint to oxlint.
- Custom rules live in a repo-owned root `lint/` jsPlugin, following the flare pattern with the ESLint-compatible rule API.
- Each rule ships test-first: a failing RuleTester case comes before the rule (the TDD rule in `.claude/rules/standards.md`).
- The migration runs as a separate plan; see [lint and format](../tooling/lint-and-format.md).

### D3 — Performance rewrite charter (2026-10-16)

- The performance work is an optimal Solid-native rewrite done in steps, not a light pass.
- All tests must pass and nothing may break. Unit tests may change only where they probe low-level Solid internals that the step rewrites, and the change must be honest.
- End-to-end, integration, and any test not touching low-level Solid code must pass unchanged. `packages/base-ui/scripts/test-parity.mjs` and `packages/base-ui/scripts/browser-parity.mjs` enforce this.
- An implementor agent and a reviewer agent work as a pair, one step at a time. Every step goes red, fix, green, verify.
- Baseline and target: [perf baseline](../perf/baseline.md) and [target architecture](../perf/target-architecture.md).

### D4 — Engine matrix (2026-10-16)

- Upstream CI runs Chromium and jsdom only. The Base UI tests workflow (`.github/workflows/base-ui-tests.yml`) mirrors those jobs.
- Firefox and WebKit browser parity (`.github/workflows/base-ui-browser-parity.yml`) runs on every push to `main`, measured against upstream's results in the same engine.
- End-to-end and visual regression tests stay on Chromium.

### D5 — Native context uses the provider on the server and while hydrating (2026-10-16)

- On the client, native parts provide context on one transparent owner through the `@solidjs/signals` `setContext`, which is the same core that `solid-js` runs in the browser.
- The server build of `solid-js` keeps its own owners and exports no `setContext`. In production builds, the signals `setContext` writes a minified field that the server never reads, so every native consumer threw "context is missing". The dev builds shared the field name and hid the bug.
- `provideNativeContext` and the Collapsible floor render the context's provider when `isServer || isHydrating()`. Server and hydration create the same owners. `test/ssr/production.test.ts` renders a production server build in a plain Node process.

### D6 — Accordion's server HTML carries the item indexes (2026-10-17)

- With Accordion rendering natively on the server, a native item guesses its index from its creation order there too, so the server HTML has `data-index="0"`, `"1"`, … where upstream React renders `-1` until the client registers the items.
- Kept on purpose: it is the correct markup, the hydrating client guesses the same indexes (no mismatch, no post-hydration write per item), and the list's registration corrects any item rendered conditionally, reordered or behind a client-only branch (`AccordionRoot.hydration.test.tsx`).
- The difference is noted in [the Accordion context](../components/accordion.md).

### D8 — A floor implements the same contract with the least work Solid allows (2026-10-17)

- A floor is the hand-written Solid equivalent a family is measured against (`packages/solid/test/floor`). It implements the same public contract as the parts: the same DOM and ARIA, and the contexts that other parts rely on. It does that with the least work plain Solid 2 allows. The exit bar is at most the floor plus 25%.
- Accordion's contract includes `CollapsibleRootContext` on every item, as upstream's `AccordionItem` provides it so Collapsible parts work inside an item. The Accordion floor therefore provides two contexts per item.
- The `solid-js` server has no public way to put two contexts on one owner. Its provider is a `createRoot` that sets one context, and `setContext` is not exported. On the server, the parts and the floor both render two nested providers.
- Every floor also hydrates cleanly, checked by a `floor` SSR fixture that the hydration suite claims. The Accordion and Collapsible floors' panels returned a raw conditional, whose open branch missed its hydration key. They now render through a rooted conditional, as the parts do. The bench cases render every panel closed, so no measured floor number changes.

### D9 — A native panel renders its server attributes without its machinery (2026-10-17)

- On the server, an open native Collapsible or Accordion panel built its whole measurement and transition machinery: effect groups, timers, observers and signals. That machinery acts only on a mounted element, and the server needs only the attributes it writes on the first render.
- `useCollapsiblePanel` returns an attributes-only panel on the server for native panels: `hidden`, the persisted `[data-starting-style]`, the suppressed open animation, the transition status and the dimension variables. The render path stays one. The panel hook's server state is specialized, which phase 11's single-path rule allows.
- Ids: a native part creates the hook in `runInLazyScope`, and the server creates that scope too, empty. Nothing a hydration claims lives in a lazy scope. A fixture with an id-taking sibling after an open panel hydrates cleanly in all three server renders.
- The dimension variables at `auto` are the panel's part style on both sides. React's server renders them, and the client's first render writes them before measuring. A test compares each panel's server attributes with the client's after a flush, open, keepMounted and hiddenUntilFound, for Collapsible and Accordion.
