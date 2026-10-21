---
tags: [decisions, log, history]
sources: []
verified: 2026-10-17
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


### D17 — The browser bench times warmed cycles and reads the heap in cycles of its own (2026-10-17)

- Supersedes the per-run sequence of `test/perf-solid/run.mjs`. Each measured cycle collected the whole heap (`HeapProfiler.collectGarbage`), read it, timed the mount, collected and read again, and timed the rest. Timing a mount right after a forced full collection measured a state no app mounts in.
- Harness modes, D16-judged at 12 runs (24 samples a side):
  - Linux, toolbar/200, A/A of one build: the old cycle flagged 4 false regressions; with no collection at all (sync IQR 9–19%) or warmed (collect, untimed mount and unmount, then timed; IQR 4–17%), none.
  - Mac (scratch 5d306ce1, load 2.1–3.0), toolbar/200, tooltip/handle-500 and tooltip/roots-500, A/A twice per mode: warmed with no collection after the timed mount flagged 1 false verdict (toolbar close menu script 2.3 → 2.1 ms; sync IQR median 4.9%); warmed with a collection after the timed mount, none in either round (median 4.0% and 4.7%).
- The bench now runs two cycles (`shared/cycles.mjs`, `scripts/base-ui-perf-cycles.test.ts`):
  - Timing: collect, mount and unmount untimed, the timed mount, collect untimed, then the other steps timed.
  - Heap: collect, read, mount, collect, read, unmount; nothing timed. `HEAP_RUNS` (default 6) per page, so 12 heap samples a side, above `MIN_SAMPLES` (10). In the warmed cycle the reading before the mount would include the warm-up's garbage. The heap cycles read the same verdict in both Mac rounds (tooltip/roots-500 23,783 → 22,824 KB for 4.4a).
  - The gate smoke in `test:base-ui:all` runs `HEAP_RUNS=1`.
- This is the reference instrument from here. Unit verdicts from the old cycle are re-judged on it.
- Re-judged on it (Mac, chain session at 9c1f9bc8), 44b kept the old cycle's tooltip/handle-500 unmount regression (+0.9 ms) and lost its popover/handle-20 unmount and preview-card/roots-200 move-across and hover-open regressions, which only the old cycle had. An A/A control at the start of that session (5330e011 against itself, 32 pairs) had no verdicts.
- 4.4a (lazy store key signals, d44668ae against 5330e011) on the Mac regressed toolbar/200 under both warmed modes, all four passes: mount +6–13%, ArrowRight x100 +4–9%; it improved tooltip/roots-500 mount by about 10%. Its Linux "same" in the warmed probe did not hold, so the regression is the library's, not the old cycle's, and 4.4a stays unpushed until it is fixed.

### D19 — A floor models the mechanism of every observable branch its component supports (2026-10-17)

- Rule: a hand-written floor models the mechanism for every observable branch its component supports, not only the branch the bench's CSS takes. A part cannot know which branch it is on before it reads, so the floor reads the same way. The floor builds that mechanism where hand-written code would, eagerly at mount; it does not build lazy scopes.
- What React does on an open (Chromium, vitest browser mode as in the parity harness; one item clicked open, `data-starting-style` sampled before paint, after the frame and in the task after, with a MutationObserver):
  - Collapsible: Root and Trigger hold it through the frame and drop it in the task after, as `CollapsibleRootState` carries `transitionStatus`. The Panel never paints it without motion.
  - Accordion: Item, Header and Trigger never carry it. `AccordionItemState` is `hidden`, `index` and `open` plus the root's state, with no `transitionStatus`, although `accordionStateAttributesMapping` spreads `transitionStatusMapping`.
  - Accordion Panel without motion: inserted with the attribute, which is removed before paint. `useCollapsiblePanel`'s opening layout effect, on `open && transitionStatus === 'starting'` with `getAnimationType` 'none', calls `setForcePanelIdle(true)`, which re-renders the panel `'idle'` before paint. So the no-motion branch paints nothing.
  - Accordion Panel with `transition: height 200ms`: holds the attribute through the frame and drops it in the task after.
  - The port matched every sample in all three cases. Wrapping React's probe in `act()` held its frame updates until `act` returned, so the attribute looked stuck; the readings above ran without it.
- The floors (`packages/solid/test/floor/`, the helpers in `motion.ts`):
  - Collapsible Root: its status is the function form of `createSignal`, following `open`. That is one computation, created at mount. A value signal cannot see a controlled `open` change.
  - Root and Trigger hold `'starting'` for the frame and the task after, on the shared frame scheduler.
  - Every opening panel reads its motion once before paint, one computed-style read, as upstream's opening pass does. With none it drops the attribute at once; otherwise it holds through the frame and the task after.
  - Accordion: each opened panel holds its own plain signal.
  - The port may not read more often than once per opening panel.
- The bench's raw floors get the same mechanism in both frameworks with no library code (`test/perf-solid/shared/raw-motion.ts`). `accordion/motion-300` (controlled, 300 panels with a 200 ms height transition, open all and close all waiting for the transitions) measures the motion branch against React instead of inferring it.
- Budgets: two per family, each at most the floor's plus 25%:
  - the closed mount;
  - the mount plus the first open, summed.
  The parts' lazy creation (S5) moves cost from mount to first open, so the pair neither punishes laziness nor hides its first-open cost.
  - Collapsible: 16 + 5 = 21 nodes against the floor's 20 + 3 = 23.
  - Accordion: 32 + 5 = 37 against 30 + 3 = 33.
- Tests:
  - "the floor's starting-style timeline matches Collapsible's / Accordion's, without and with motion" pins each part's timeline to the Chromium readings and holds the floor to it. Three of the four failed on the old floors; the Accordion no-motion case passed there, since neither side paints anything.
  - The two budget tests.
- The size variables are part of the mechanism. `height: var(--accordion-panel-height)` is the documented pattern, and a motion open depends on it.
  - React, read in Chromium: without motion the variables stay `auto` throughout.
  - With motion they hold the measured `scrollHeight` and `scrollWidth` in px through the frame. Upstream's `resetLayoutStyles` (`align-*`/`justify-*: initial !important`) is set while measuring and lifted on the next frame. `useOpenChangeComplete` releases the variables to `auto` once the panel's animations finish.
  - The floors do the same. A panel that mounts open alone gets `animation-name: none`, as the parts do; the old floors set it on every open.
- Reads per opening panel (`getComputedStyle`, `scrollHeight`, `scrollWidth`):
  - React: 2/1/1 on both branches. The second `getComputedStyle` is its opening layout effect running again on the idle pass, not behavior.
  - Floor: 1/0/0 without motion, 1/1/1 with it. A no-motion open leaves the variables at `auto`, so a measurement there is a forced layout nothing observes.
  - Port at this entry: 3/2/2 without motion and 2/1/1 with it. 5.1.3 a-2 rewrites the measurement pass and pins the port at the floor's counts.
- The timeline tests sample the panel's whole inline style as well as the attribute. On the floors without the measurement, all four cases failed.
- Floor figures from before this entry (node counts, the hydration table's floor ms) used floors without this mechanism.

### D20 — D19 extension: the list-highlight floor is the keyed selector; direct is reported (2026-10-20)

- Rule: a list whose items ask "is my key the active one" (Select, Combobox, Menu, and every keyed highlight after them) is held to one floor, `keyedHighlight` in `packages/solid/test/floor/listHighlight.ts`, on every metric of that one mechanism. It is Solid 1's `createSelector` shape in plain Solid 2: one effect follows the active key, and each read key holds one signal, made by its first reader under the selector's owner and dropped by its last reader's cleanup. Readers subscribe to their key's signal from mount, so the first move re-runs one reader and every later move two.
- `directHighlight` (each reader compares the active key itself) is reported beside it, ungated, as the record of the trade.
- Why one mechanism and not the cheaper of the two per metric: direct wins heap after mount and keyed wins every move, so a per-metric minimum is a floor no single implementation reaches.
- The raw bench pair (`select/raw-list-1000-direct` and `-keyed`, 1,000 options, 10 runs, Linux Chromium, interleaved with React):
  - heap after mount: direct 323.0 KB, keyed 518.0 KB, React 640.1 KB;
  - first move sync: direct 0.7 ms, keyed 0.1 ms, React 0.3 ms;
  - move x50 sync: direct 11.5 ms, keyed 0.6 ms, React 8.1 ms;
  - the first move retains 54.9 KB on direct and −15.4 KB on keyed.
- A keyed library highlight matches the keyed floor within 1.25x on heap after mount, the first move, move x50 and retainedKB. At this entry the port (4657916f's projection-keyed selector) creates its per-key slots and re-runs every reader on the first change of the active index, so it loses every first move (menu/500 open by keyboard +2.2 ms locally, Select select by click +1.5 ms script) and holds about 100 B per item from that move on.
- A release shared per key instead of one per read measured 19.5 KB more heap after mount at 1,000 items, one reader a key, so the floor keeps the per-read cleanup.

### D21 — D20 amended: the library's keyed highlight is pushed by its writers (2026-10-20)

- The keyed floor's effect, which relays the active key into one signal per key, is a valid cost floor only where no part also reads the active key directly. A part that reads both sees the new key with its stale membership for one flush. In the library, a Tab reads the selected value through `useControlled` and through its membership, and Solid's dev diagnostics reported `EFFECT_RELAY_TEAR` on every switch ("Tabs stay silent while switching tabs").
- The library's keyed highlight, `createIdSelector`, holds one boolean signal per id a reader asks about. The writer of the source value pushes the new id in the same batch, so the old and the new id flip with the change and no effect relays it. The writers are the `SolidStore` commit hook (the list stores' `isActive`), the composite root's highlighted-index change, the Tabs value writes and the RadioGroup setter. A catch-all effect still applies a change no writer pushed. Dev builds count each such relay, and the test setup fails any test that makes one. A relay shows one stale pass before paint, not a painted frame.
- The signals live in a root in a lazy scope of the selector's owner (no hydration id of the owner's). An id's signal is released with its last reader, and the root is disposed with the last id, so a churn of unique values keeps no memory. The list stores start the selector at the first tracked read. Popup trigger selectors start it when readers first ask about a second id.
- A value with no writer in the library uses `createDerivedIdSelector` instead: one `createProjection` that holds at most the current id's property and rewrites it in place, in the same flush as the change. That covers a controlled Tabs or RadioGroup value, Combobox's active index, and every store keyed selector whose key reads a bound key or a getter, which changes with no write to push it (a popup's trigger selectors read `triggerIdProp`, bound to the prop; Menu binds `activeIndex` to null while closed). The store probes a key function's reads when its selector starts. Dev builds report a pushed selector that reads such a key later: through a branch its creation did not take, or a binding made after it.
- The relay count is zero in the jsdom, Chromium, Firefox and WebKit suites, which all load the test setup that fails a test on a relay. jsdom alone missed the popup and Menu relays: its items unmount with the popup, while a browser keeps them mounted through the exit animation.
- Tabs keeps its mounted panels in per-key signals, not a store, because sequential store draft writes that add keys cost O(N²).
- A read makes one signal per read id, the same cost class as the keyed floor's signal per key. The keyed floor stays the gated target on every metric, measured on `select/raw-list-1000-library`: the floor's list, read through the library's keyed selector and built from each variant's source. Within 1.25x of `select/raw-list-1000-keyed` is the bar. A first move costs at most two index reads in the list stores' tests.

### D22 — The benches run their variants in a balanced order, and SSR verdicts need both load orders (2026-10-20)

- Reason: on the Mac (performance mode, on AC), 9f962cc1 against itself plus one unrelated byte (the two server bundles differ at one character; collapsible, server only, 20 runs, four halves) judged rows of identical code regressed.
  - csbnoise, every run in the same variant order: `collapsible/300-open-floor` +0.182 ms, CI [0.173, 0.188], regressed; `collapsible/300-open` up to +0.106 ms. The floor imports nothing from the library.
  - csbnoise2, the order alternated run by run: `collapsible/300-open` within -0.091 to +0.057 ms, but `collapsible/300-open-floor` +0.152 ms, CI [0.147, 0.169], regressed again in one half, and `collapsible/300-floor` -0.072 and -0.074 ms in both halves that listed the copy first.
  - All 20 samples of a bundle moved together (CI width 0.02 ms), and the sign followed the order of `SSR_VARIANTS`: an offset between the bundles of one Node process that follows their load order. Alternating the runs removes a run position's cost, and more runs cannot remove a per-process offset.
- Rule: the SSR server sampling and the hydration loop take each run's variant order, and the browser bench each round's, from one balanced (Williams) design (`test/perf-solid/shared/order.mjs`). Every variant holds every place equally often and follows every other variant equally often: AB, BA for two variants, six orders for three.
- The browser bench keeps two rounds for one or two variants and runs one round per order for more, with the runs and heap runs split over the rounds so each variant keeps twice `RUNS` (and twice `HEAP_RUNS`) samples.
- `bench:component --compare` runs its SSR cases in two processes, the second with the variant order reversed. An SSR row counts once in Benjamini–Hochberg, at the larger of its two orders' p values, and is regressed or improved only when both orders clear the margin in the same direction. The report gives the two orders' mean delta, which cancels an additive load-order offset, and each order's delta, so a shift in one order stays visible.
- Check (csbnoise3, the same pair twice, each an A,B and a B,A process judged together): no row of identical code regressed or improved. The means stayed within -0.054 to +0.001 ms, while single orders still read up to 0.099 ms.
- The minimum effect is unchanged.

### D23 — The roving tab stop floors are the keyed highlight, and the gate takes reviewed allowances (2026-10-21)

- Rule: the toggle-group and radio raw floors (`toggle-group/raw-300`, `radio/raw-300`) read their roving tab stop through `keyedHighlight`, as D20 holds every composite list's highlight. The direct compare they used made the floor claim a per-item slot was not required, while the port's composite highlight is keyed by D20.
- Measured on the Mac (2026-10-21, performance mode, on AC, 10 runs, balanced harness), heap after mount: toggle-group/raw-300 React 122.4 KB, direct floor 304.2, keyed floor 375.0 (+70.8 KB, about 236 B a toggle); radio/raw-300 React 396.8, direct 543.6, keyed 610.6 (+67.0 KB, about 223 B a radio). The port's toggle-group/300-single is 1,184.2 KB against React's 1,895.5 (0.62x), +42.3 KB over 3eef0aca: about 141 B a toggle, 0.60x the keyed floor's per-key cost.
- The gate takes reviewed allowances (`test/perf-solid/shared/allowances.mjs`): a row, a metric, the largest shift allowed and the decision that allows it. `bench:component --compare` lists an allowed regression apart and fails only on the rest; a shift past the bound, another metric or another row still fails. An allowance needs the row's gated floor to require the cost and the shift within 1.25x the floor's own increment. The gate checks the rest itself: the row's median must stay below React's median in the same session, and every entry names when it lapses (`until`: the plan leaf that removes it, or a decision that says when); `scripts/base-ui-perf-allowances.test.ts` fails an entry without one or whose decision the log does not hold.
- The first allowance is toggle-group/300-single's heap after mount, up to 88.5 KB (1.25x the keyed floor's 70.8 KB), until leaf 5.3. The bound is measured against 3eef0aca, this regate's base; the next regate re-derives it from the floor against its own base.

### D24 — The gate allows a measured trade, bounded and expiring (2026-10-21)

- Rule: a regression may be allowed as a trade when the commit that causes it wins over 10x the loss in the same family on the Mac, no JavaScript frame accounts for the loss after a diagnostic round, and the row keeps its React rule. A row below React at the base must stay below React (D23). A row already above React at the base may move by its bound and no more: the entry is marked `baseAboveReact`, and the gate applies the mode only while the base is above React in the same session. `cur / react ≤ base / react + maxDelta / react` is the same as `cur − base ≤ maxDelta`. Each bound is the largest upper end of the shift's 95% CI from 3eef0aca over the sessions that measured it.
- preview-card/roots-200 move across 20, +1.7 to 2.3 ms sync and +1.03 to 1.53 script from d4e50c03 (the keyed popup trigger selectors), bound 2.7 sync and 1.91 script, until leaf 5.7. Same commit: tooltip/handle-500 hover across 50 −49.6 ms (76.1 to 26.5). React 31.5 against the tip's 27.0 (kpmac4).
- menu/500 open by keyboard, +1.5 to 1.8 ms sync from 4657916f (the keyed list highlight), bound 2.5 sync and 2.58 script, `baseAboveReact`, until leaf 5.6.0. Same family: menu/500 nav x50 −11.2 ms (18.9 to 7.7) and hover sweep 100 −12.6 ms (26.1 to 13.5). React 11.4 against 22.1 at 3eef0aca (1.94x) and 23.7 at the tip (2.08x). Reverting would give the 1.6 ms back and lose about 24 ms. Leaf 5.6.0 runs first after the push. The next regate after it must show the row at or under its base, or the entry fails.
- The diagnostics (Mac, 2026-10-21). Bisect (chain-mac42): the menu row moves at 4657916f, the preview-card row at d4e50c03. Counts: on both rows the fixed tip makes fewer calls than the row's baseline (menu 854,042 against 878,708, preview-card 603,612 against the selector revert's 606,991). Unminified builds show no gap (mackbd, macmprof). On minified builds, V8 shows the same megamorphic sites and fewer deopts for preview-card (macicmin). Menu's extra megamorphic events are Solid store internals through the projection, which bounds itself at about 0.6 ms (macnoproj). The minified, source-mapped self-time profile (macprofmin) names no frame on either row. No JavaScript function moves more than 0.3 ms a run, and preview-card's gap is all native "(program)" time, 21.6 to 30.2 ms a run.
- Fixed in the same round, not allowed: the preview-card trigger rebuilt its inline-rect handlers on every active-trigger change (97233f45).

### D25 — The regate's remaining rows: floor heap, same-family trades, and residuals without mechanism (2026-10-21)

- Context: scoped5 (ccb8432d against 3eef0aca, the families with open rows, the same session as React, Mac, guarded) left 22 regressions past D23 and D24. Each was bisected (macrbis, macfine), counted by name, and fixed where a mechanism was found: 97233f45 (the preview-card trigger's inline-rect props), ccb8432d (a toggle's pressed state keyed, click 100 −14.7 and −13.8 ms). The rest are allowed under three rules, each encoded in `test/perf-solid/shared/allowances.mjs` and checked by the gate.
- The D23 rule, heap the keyed floor requires per key (236 B, `toggle-group/raw-300`), bounded at 1.25x the floor's increment for the row's keys, the row below React:
  - toggle-group/300-multiple heap after mount: +79.4 KB, 265 B a toggle (the keyed highlight slot and the keyed pressed leaf), bound 88.5 KB, React 1,895 KB.
  - composition/direction-500 heap after mount: one ToggleGroup of 500 toggles, +142.5 KB, 285 B a toggle, bound 147.5 KB, React 3,379.6 KB.
  - combobox/full-1000 replace items while open, retained: +73.8 KB, 74 B for each new item's highlight slot (e726bd36), bound 295 KB, React 3,953.7 KB.
- The D24 rule, a trade: the same family's wins from the same commit at least 10x the loss, the bound the largest upper end of the shift's 95% CI from 3eef0aca (regate4, macfine, scoped5):
  - toolbar/200 open menu via toolbar button (e726bd36): +0.2 sync and +0.84 to 0.95 script, the base above React. e726bd36's toolbar ArrowRight x100 is −22.1 ms against +1.34 ms of losses on the row's family (open, close, unmount), 16x.
  - toggle-group/300-multiple controlled value (e726bd36, then ccb8432d): +0.6 sync and +0.57 script, below React (0.8 against 2.0 ms), against the family's click 100 −13.8 ms and ArrowRight x50 −13.1 ms.
  - tooltip/handle-500 unmount (d4e50c03): +0.25 to 0.3 ms, below React (3.8 against 32.9 ms), against the same commit's hover across 50 at −49.6 ms.
- A new class, the residual without mechanism: a row qualifies only if (a) its call counts equal those of the commit before the shift; (b) at least one experiment that restores the suspected change recovers nothing; (c) the shift is at most 0.5 ms at the CI's upper end; (d) it keeps the React rule (below React, or the base above React with the D24 bound); and (e) `until` names the family's leaf. Each entry carries (a) and (b) as `evidence`, and `validateAllowances` rejects one without them or over 0.5 ms. An unexplained 0.3 ms cannot block a batch with 331 improvements, but neither can it hide: it is listed by name with its evidence and an expiry.
  - context-menu/200 right-click open (+0.30 sync, base above React; +0.29 script), select item (+0.17 script, below React) and reopen + escape (+0.28 script, below React), since b75c8bd5. (a) maccnt4: right-click open makes 66,186 calls at the tip against 65,764 at a04e4dfb. (b) pcmemo2 (provideContext's children memo) and ctxjsx (ContextMenuRoot's JSX providers restored) change no time row. Until leaf 5.6.
  - toggle-group/300-single and 300-multiple unmount (e726bd36, then ccb8432d): +0.2 ms, the base above React (0.5 against 0.4 ms), against the same family's click 100 and ArrowRight x50 wins. One cleanup per keyed read: the keyed floor's own unmount cost (raw-list-1000-keyed unmounts in 1.30 ms against the direct floor's 0.70).
  - composition/direction-500 unmount (e726bd36, then ccb8432d): +0.3 ms, 1.00 against React 0.70, the base equal to React (sync 0.70 against 0.70 at the sync column's 0.1 ms resolution; script 0.78 against 0.71). Parity is not winning: the React rule exists so an allowance never makes the port lose to React where it was winning, so `baseAboveReact` now means a base at or above React's median, and a base below React by any margin still requires the row below React. The trade: the family's ArrowLeft x20 (rtl) −15.0 ms against +0.3, 50x. The sync bound is the keyed floor's own unmount increment at 500 keys, 1.25 × 0.3 = 0.375 ms; the script bound the CI's upper end, 0.31. Skipping the per-reader slot release when the selector's owner disposes measured nothing (macrel: 171 pairs judged, none moved), so it was dropped.
