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

### D7 — Parent effects that read child registrations run after the children (2026-10-17)

- React runs a parent's layout effects after its children's and after the commit's DOM writes, on mount and on every update. Solid 2.0.0-rc.15 creates effects top-down and applies a flush's render effects in reactive-height order. A parent render effect can therefore apply before its children register, or before their elements are attached.
- The old two-node `createDepsRenderEffect`, a memo feeding the effect, sometimes landed after the children by memo height. A probe shows it fails the mount, added-child and attached-DOM orderings alike. The order it gave was an accident of each hook's shape.
- `createAfterChildrenEffect(deps, effect)` in `solid-helpers.tsx` is the post-children phase: a dependency-gated user effect with one node and one hydration id on both sides. Solid applies user effects after every render effect of the flush, so the parent sees its children's registrations and their DOM. Unlike React, other user effects of the same flush (React's passive effects) may apply before it.
- It is opt-in per site. A deps effect converts when it reads child registrations, and so do the effects declared after it in the same hook, to keep declaration order. `useListNavigation` converts three effects and drops its microtask re-sync for late items. Every other deps effect becomes the single-node gated effect (S3).

### D8 — A floor implements the same contract with the least work Solid allows (2026-10-17)

- A floor is the hand-written Solid equivalent a family is measured against (`packages/solid/test/floor`). It implements the same public contract as the parts: the same DOM and ARIA, and the contexts that other parts rely on. It does that with the least work plain Solid 2 allows. The exit bar is at most the floor plus 25%.
- Accordion's contract includes `CollapsibleRootContext` on every item, as upstream's `AccordionItem` provides it so Collapsible parts work inside an item. The Accordion floor therefore provides two contexts per item.
- The `solid-js` server has no public way to put two contexts on one owner. Its provider is a `createRoot` that sets one context, and `setContext` is not exported. On the server, the parts and the floor both render two nested providers.
- Every floor also hydrates cleanly, checked by a `floor` SSR fixture that the hydration suite claims. The Accordion and Collapsible floors' panels returned a raw conditional, whose open branch missed its hydration key. They now render through a rooted conditional, as the parts do. The bench cases render every panel closed, so no measured floor number changes.

### D9 — A native panel renders its server attributes without its machinery (2026-10-17)

- On the server, an open native Collapsible or Accordion panel built its whole measurement and transition machinery: effect groups, timers, observers and signals. That machinery acts only on a mounted element, and the server needs only the attributes it writes on the first render.
- `useCollapsiblePanel` returns an attributes-only panel on the server for native panels: `hidden`, the persisted `[data-starting-style]`, the suppressed open animation, the transition status and the dimension variables. The render path stays one. The panel hook's server state is specialized, which phase 11's single-path rule allows.
- An initially open root's transition gets the same treatment. On the client, its status machinery is created in a lazy scope, as a root that opens later already does. On the server, a stand-in reports it mounted and `'idle'` while open.
- Ids: a lazy scope (`runInLazyScope`) takes no slot of its owner. A scope's number follows the order scopes are created in that owner, which differs between the server and the client, so nothing a hydration claims may live in a scope: no element, and no computation whose value is serialized. The server creates no scope for either stand-in. Fixtures with an id-taking sibling after an open panel, and after an open root, hydrate cleanly in all three server renders.
- The dimension variables at `auto` are the panel's part style on both sides. React's server renders them, and the client's first render writes them before measuring. A test compares each panel's server attributes with the client's after a flush, open, keepMounted and hiddenUntilFound, for Collapsible and Accordion.

### D10 — Single-node deps effects are parked (2026-10-17)

- Supersedes D7's adoption. D7's single-node `createDepsEffect` and `createDepsRenderEffect` (core spec S3) and `createAfterChildrenEffect` never reached `main`; they stay at commit 26819b60 for a future ordering primitive.
- Single-node deps effects change the order of a parent's effect against its children's effects within one flush. Solid 2.0.0-rc.15 applies a flush's user effects by reactive height, then insertion. The memo in front of the old two-node helper put every deps effect one level lower, which ran parent deps effects after child effects by accident. React runs children's effects first in every commit.
- The proof is upstream's MenuTrigger test "removes the hover mouseup listener when unmounted before mouseup". With single-node effects, the root's `useDismiss` deps effect adds its capture `mouseup` listener before the trigger's own, and the test fails deterministically on Linux. On the Mac the two land in separate flushes, so it passed there.
- Solid 2 has no public one-node way to restore React's child-first order. The savings (3 to 9 nodes per closed popup root) do not justify a hidden order change across 103 sites, so the two-node helpers stay.
- `createAfterChildrenEffect` is not extracted on its own: without single-node effects, the old helper already orders `useListNavigation` correctly, so it fixes no live bug.

### D11 — A panel open since it was created builds its machinery on its first change (2026-10-17)

- An initially open native Collapsible or Accordion panel built its measurement and transition machinery while hydrating: the open hydrate profile was led by the dimension writes, the panel hook's setup and the computed-style read that detects an animation. None of it acts until the panel's state changes, and a page's open panels may never change.
- A panel open since its part was created renders through `DeferredPanel`: the server panel's attributes (D9), with the open animation suppressed as upstream suppresses it until the first close, until the root's state first differs from its initial state. The first read that sees the change creates the machinery in the part's lazy scope and hands it the element. Every reader of the panel's state also reads the root's state, so the change reaches a reader in the same flush. It applies to client renders too, not only hydration. A panel that opens later builds its machinery at once, so its opening animates; one that renders closed (`keepMounted`, `hiddenUntilFound`) needs its `beforematch` listener and the next open's measurement at once.
- Oracle: `CollapsiblePanel.deferred.test.tsx` compares the hydrated native panel frame by frame with the slow path's panel created open (a `render` prop never defers), from the state before the action. The cases are a close (keepMounted and unmounting), a reopen, a hidden-until-found `beforematch`, a controlled flip, and a change made while hydrating with an id-taking sibling after the panel. They pass in jsdom and Chromium. Without the element handover 5 of 6 fail; without the suppression 3 of 5 fail.
- Lazy-scope contract: in Solid 2.0.0-rc.15 a change made inside `hydrate()` (a later element's ref, even with `flush()`) reaches the panel only after `hydrate()` returns, so on these paths the machinery is not built while hydrating. It is still created through `runInLazyScope`, under the development claim guard.
- Measured on the Mac, production builds, 20 runs (`ssr/run.mjs`, which now clicks the first expanded trigger after hydration and records the close's script time): collapsible/300-open hydrate 27.1 to 22.2 ms (React 21.6, floor 11.9), accordion/300-open 42.0 to 35.8 ms (React 25.5, floor 16.1). The first close's script time did not change (0.33 to 0.32 ms, and 0.41 ms). Against the floor, open hydration went from 2.28x to 1.87x (Collapsible) and from 2.61x to 2.22x (Accordion), so the exit bar is not met yet. Accordion's open hydrate script time rose from 4.75 to 5.89 ms while its wall time fell.

### D12 — Browser parity confirms a Solid-only failure by a significance test (2026-10-17)

- Supersedes the rule ff40f283 set (Solid fails all 10 reruns, upstream passes at least one). That rule could not tell a test upstream itself fails 70% of the time from a real Solid break: at 75bdb4e3 it confirmed Popover's Enter-or-Space test on CI's WebKit with Solid failing 10/10 and upstream passing 3/10, a one-sided Fisher exact p of 0.105. Frame counts showed both libraries focus the popup one frame after the open, and Playwright's WebKit presses the next key within that frame, so the failure is a driver race in both suites.
- A failure is confirmed when Solid fails every rerun and the one-sided Fisher exact p of Solid failing more than upstream is under 0.01, or upstream has no such test. Ten reruns first; failures Solid failed every time that are not yet significant rerun 10 more, in one batch of their files, and are decided at 20. Two looks at 0.01 hold the false confirmation of a failure that is not Solid's to about 2% per test.
- A deterministic Solid break on a test upstream passes 63% of the time is confirmed at 20 reruns over 99% of the time. A Solid flake failing 60% of runs passes one of the first 10 reruns 99.4% of the time.

### D13 — Native server templates are removed; perf commits are bench-gated (2026-10-17)

- 7ca01f29 wrote a native element's server markup without `ssrElement`: the hydration key, the attributes object walked as `ssrElement` walks a plain object, the part's markup and a single child, with several children, a deferred child or a hole still handed to `ssrElement` so its node walk resolved them. A 588-row table and every SSR fixture in three server renders held it byte for byte with `ssrElement`, and every correctness gate passed.
- It made the server no faster. Mac, production, 20 runs, server ms before and after: collapsible/300 1.29 to 1.37, collapsible/300-open 2.08 to 2.12, accordion/300 3.12 to 2.81, accordion/300-open 4.41 to 4.29. The readable collapsible/300-open profile went from 2.55 to 2.82 ms and 3074 to 3151 KB per render: most native elements have several children, so `ssrElement` and `resolveSSRNode` still ran, and the template's own walk and escaping were added on top. The approach could save at most the old `ssrElement` and `resolveSSRNode` cost, about 200 µs of 2.55 ms, while copying rc.15 server internals (GOTCHA-018).
- The template path, its tests and GOTCHA-018 are removed; the children escape fix (ae146fd7) and its tests stay. The server gap to the floor is the parts' setup: the server panel and its closures, the root model, ids and memos, and the markup string.
- From now on a perf commit is pushed only after its Mac bench against current `main` shows the targeted metric improved and no gated metric regressed beyond the regression rule's tolerance. This one was pushed on its correctness gates before its bench was read.

### D14 — No generic native lane in `useRenderElement`; static parts get per-part native ports (2026-10-17)

- Optimization-map item 1 proposed that `useRenderElement` take the native binding itself for intrinsic tags with static `render` and sources, so the slow path's simple elements would cost about 9 nodes less without per-part code. One Separator costs 14 nodes beyond a plain `div` on the slow path: the attribute root and structure effect, two per-key value memos and two per-key effects, the `Resolved` and `dynamic` tag roots, the children memo and insert, the dev root and the part's memo.
- Attempt 1 wrote every key from one attribute effect: Separator 14 to 9 nodes, the Progress Root, Track and Indicator 59 to 41, Meter 50 to 35, Input 30 to 22, Avatar Root and Fallback 33 to 27. It broke the per-key reactivity contract, which `useRenderElement.reactivity.test.tsx` ("changing one prop does not re-read the getters of other props", "re-evaluates class and style functions only when state changes") and `popupPropsRebuild.test.tsx` (triggers, popups and a submenu trigger keep their props while they open, close and move the highlight) hold: one effect re-reads every key's getter on any change, and part getters build objects.
- Attempt 2 kept an effect per changing key and dropped the attribute root, the structure effect and the tag root when the key set looked fixed (fixed sources without accessor entries, a fixed state layout, no proxy props). 52 tests failed, among them "swaps mapped state attributes without leaving the stale one", "does not remount children when reactive state field toggles" and nine `Field.Control` tests: keys come and go at runtime even then, so the structure effect is load-bearing.
- What stays safe generically is about 1 node of 14 (creating the element without the `dynamic` root), not worth a core change. The native kit reaches 2 nodes because each part declares its keys, state and literals in a spec, which a generic lane cannot infer: the audit's S1 shape.
- The static family is ported part by part through the kit instead (Separator and the Progress and Meter Tracks and Indicators first, then their Roots, then Avatar and Input, then a narrow `useRender` path), each with red cost tests at the native budget, a parity test against the slow path, SSR and hydration fixtures, and a bench against `main`. The two attempts are kept outside the repo, in `.tmp/grunt/patches/` as diffs against ada05405 (`d14-lane-attempt-1.patch`, `d14-lane-attempt-2.patch`); `d14-lane-attempt-1.py` is the script that produced the first.

### D15 — Shared core first, then one family at a time to the exit bar (2026-10-17)

- The user set the strategy for the rest of plan 3. There is no second implementer, and no ordering of families by their gap to React. Shared hooks and utilities come first, then the families one by one, each taken to the full exit bar (within 1.25x of the hand-written floor and below React on every metric, closed and open, browser and SSR) before the next starts. Each family should go faster than the last.
- Order:
  1. Land the static unit in flight (Separator and the Progress and Meter Tracks and Indicators), then stop new family ports. The Progress and Meter Roots stay parked as a patch until the static family's turn.
  2. Make the SSR instrument able to see a 2x server change. At 597b2a75, progress/1000 went from 96.9 to 47.4 server ms and the 1.6 rule called it "same", with a 72.6 ms tolerance.
  3. Run a profiling pass at `main` that gives each core candidate's self time, fan-out and expected gain.
  4. Land the shared core one unit at a time, each red first and benched across all families (`bench:component all`, the full browser bench plus SSR, against `main`). The candidates are S2 provide() for slow-path providers, the SolidStore write path and shared selectors, the native kit's handler dispatch, S4 keyed selection, S5 lazy popup machinery, the floating store's shared selectors and bindings, CompositeList's incremental registration, and the per-family server renderer shape. File fan-out at 597b2a75 is 123 files with JSX providers plus 36 calling `provideContext`, 99 reading a store, 36 using the native kit, 26 deriving per-item selection, 24 on `useOpenChangeComplete`, 15 on the floating root store and 12 on CompositeList items.
  5. Take the families one by one: Collapsible and Accordion, the static family, toggles, forms, Tabs and ScrollArea, composite lists, popups, toast.
- Engine and warning tooling (plan leaves 1.8 to 1.13) lands during the core phase, while Mac benches run, because the family exit bar includes zero new warnings and the all-engine milestone.
- Learning loop: `workflows/port-a-component-native.md` is a living playbook. It is read before each family's leaves are written and updated after every unit with what worked, what failed and the recipes that came out of it. Each core unit also records its actual gain against the expected one, and the handoff tracks wall time per family.

### D16 — The perf rule decides by rank test, interval margin and false discovery rate (2026-10-17)

- Supersedes leaf 1.6's tolerance in `shared/regression.mjs`. The old rule flagged a shift that exceeded the summed p90 spreads of both sides. At ten samples p90 is the maximum, so one slow sample per side decided it: a collection pause or the first measured run, 50–60 ms on the Mac. At 597b2a75, progress/1000's server time halved (96.9 to 47.4 ms; samples cur [101.8, 46.3, …], base [115.0, 100.8, …]) and the rule said "same" with a 72.6 ms tolerance. On a simulated clock calibrated to those samples (`scripts/perf-noise-model.ts`), it called a 2x slowdown "same" for 20 of 20 seeds.
- The rule now:
  - A pair is regressed when a one-sided Mann–Whitney U test gives p < 0.01 and the bootstrap 95% interval of the median shift lies wholly above the minimum effect: the metric's absolute floor or 3% of the base median, whichever is larger. Improved is the mirror case. The margin applies to the interval, not the point estimate, because at the point estimate a true 1.03x shift flagged on 5 of 20 seeds.
  - A `--compare` run judges all its pairs together (`judgeAll`, browser and SSR). The two-sided p values go through Benjamini–Hochberg at q = 0.05, and the report states the pair count and the threshold.
- Samples:
  - Browser: `bench:component` defaults to `--runs 12` (24 samples a side). At 16 a side, the rank test missed 14 of 100 true 2x regressions among 400 pairs at BH thresholds; at 24 it missed none.
  - SSR: 20 runs, each sample the mean of a batch of renders sized to about 250 ms, with `gc()` before every batch (`ssr/sample.mjs`, `node --expose-gc`).
  - The browser part of a run takes about 1.5x as long.
- Simulated clock (20 seeds):
  - 2x shifts: decided for at least 19 of 20 seeds.
  - 1.03x shifts: "same" for all 20.
  - A/A: "same" for at least 19 of 20.
  - 400-pair A/A runs: at most one false regression on average. The measured count was none.
  - Five true 2x regressions among 400 pairs: all flagged on every seed.
- Real instrument on the Mac at 2d6e053c, eleven SSR cases (progress/1000, input/1000, checkbox/1000, accordion/300 and collapsible/300 with their open and floor twins):
  - A copy of the same build slowed 2x (`SSR_REPEAT=cur:2`) read "regressed" on all 11, ratios 1.64 to 2.06, p 3.4e-8.
  - A/A read "same" on all 11, ratios 0.98 to 1.02.
  - The margin, not alpha alone, carries A/A: progress/1000's A/A pair had p 0.0036, below alpha, but its shift interval (−1.01 to −0.15 ms) stayed inside the 1.37 ms minimum effect, so it read "same".
- Verdicts from runs before this entry are read as unjudged.

