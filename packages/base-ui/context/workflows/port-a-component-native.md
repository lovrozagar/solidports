---
tags: [porting, native, perf, workflow, playbook]
sources: [packages/base-ui/packages/solid/src/utils/native/element.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/utils/native/static.cost.test.tsx, packages/base-ui/packages/solid/test/parityHarness.tsx, packages/base-ui/packages/solid/test/defineSsrFixtures.ts, packages/base-ui/scripts/bench-component.mjs, packages/base-ui/scripts/remote-mac.mjs]
verified: 2026-10-18
---

# Port a component to the native path

The living playbook for moving a family onto the native kit (D15): read it before writing a family's leaves, and add to it after every unit what worked, what failed and the recipe that came out of it. A family is done at the exit bar (within 1.25x of the hand-written floor and below React on every metric, closed and open, browser and SSR), not when its parts are native.

## Family order

The slow path is the largest bucket of library time, and only native ports shrink it (core-audit, "The slow path after the core phase"). Within phase 5, take a family's parts in order of their slow-path share in the latest attribution (`attribution.mjs`, the render-element bucket by component): among the list families, Combobox (497 ms expected) and Select (461 ms) come first.

Popup families carry a heap gap the core phase does not close: 500 closed Tooltip roots retain 23.4 MB against React's 11.2 MB (the bench's heap after mount, measured with a full collection). Each popup family's port takes its share of that gap as an exit criterion.

## Unit loop

1. Red: cost tests at the native budget in a `*.cost.test.tsx` (nodes beyond a plain element, `expectNativePath` on every measured part), a `<Family>.parity.test.tsx` through `test/parityHarness.tsx`, and `*.ssr-fixtures.tsx` with a hydration test that updates after hydration and compares with a client render. Run them to see them fail.
2. Prove red on `main`: copy only the new test files into a worktree at `main` (`.tmp/grunt/wt-pilot`), run them, record the failing count, and remove the copies by literal path.
3. Fix through the kit, then green in jsdom (family suites, the hydration fixture sweep, `scripts/base-ui-perf-manifest.test.ts`) and the new files in chromium.
4. Register the cost tests in `test/perf-solid/shared/manifest.ts` (`COST_TESTS`, and out of `PENDING_COST`).
5. Gate of record on the Mac (`test:base-ui:all --only jsdom,chromium` through `scripts/remote-mac.mjs`), and the bench against `main`: `bench:component <names> --save-baseline main-<sha> --at <sha>`, then `--compare main-<sha>` (D13: the targeted metric improves and nothing gated regresses under the rule, D16; keep the default `--runs 12`, which the rule's power needs). A shared-core unit benches `all`.
6. Docs (the component note with nodes and the bench table, render pipeline, method), the context map, a stamp per SHA, push.

## Recipes

- Kit shape: `canRenderNative(props, undefined, true)` (client, server, hydration), a module-level `{ tag, create: () => <div /> }` template, a module-level `OWN_KEYS` set, `literal` for fixed part attributes (consumer keys win), `attributes(set)` for reactive ones, `reactive: false` when nothing can change (no effect at all).
- State attributes: compile the writer once at module level (`compileStateWriter(keys, mapping)`). A part with no state on the slow path passes `state: EMPTY_OBJECT` with `stateAttributes: false`, so `class`/`style` functions receive the same empty state.
- Contexts: `provideNativeContext`, which renders the provider on the server and rebuilds its owners while hydrating.
- A part style below the consumer's goes in `partStyle`; return `undefined`, not `{}`, for no style: an empty object writes `style=""` where React writes nothing.
- Static styles in JSX: a literal object compiles into the template string at no cost; an identifier (`style={visuallyHidden}`) costs a render effect per element.
- Owned children (a part that renders its own nodes after the consumer's): `children: () => [props.children, (cached ??= hint())]`, created once and in document order for hydration.
- Fixtures write props out: a spread makes the props a proxy, which silently takes the slow path (the path assertions catch it).
- Render forms (5.1.2): pass `isNativeRender` (or `isNativeButtonRender`) to `canRenderNative` and render through `renderNativeElement` unchanged; the kit handles a tag, a config and a function. A test that must take the native path passes an identifier or a literal: `render={form.trigger}` compiles to a getter, which is reactive. A fixture or test that must take the slow path spreads an object (the props become a proxy); a reactive `render` no longer forces it in a part with `dynamicRender`, and a JSX `ref` always compiles to a static function.
- Forwarded `render` (5.1.2b): each family's 5.x leaf turns `dynamicRender` on in its parts that take a `render` check (`canRenderNative(props, keys, ssr, check, true)`), with its own red cost cases for a wrapper forwarding `render={props.render}` in every render form and with nothing forwarded (`collapsible.cost.test.tsx`, "forwarded through a wrapper"). The bound is the direct form plus one memo per part and the parent's insert where the static form returns the part's own element. Once every family passes it, the flag goes and a reactive `render` is native everywhere.

## Pitfalls

- In a real browser `toHaveStyle` compares computed values (a `40%` width reads in pixels): assert the inline `element.style` instead, and type query helpers as `HTMLElement`.
- The server prints numbers as written (`inset-inline-start:0`) where the CSSOM reports `0px`: compare hydrated styles through the CSSOM.
- `typecheck` (pre-commit and verify) covers the whole working tree, so uncommitted work can fail an unrelated commit and a rebuilt tree can fail verify: typecheck before rebuilding a commit.
- A tooling change needs its end-to-end path run, not only its unit tests: a `const` shadowing `run()` in `bench:component`'s main passed every unit test and failed on the Mac. `base-ui-bench-component-main.test.ts` and `base-ui-scripts-lint.test.ts` now catch that class locally.
- Pin a cost's mechanism with a direct probe before designing its fix: untrack one candidate input at a time and count recomputes (4.3a found the trigger this way after two guesses from the profile were wrong). Reading the profile alone named the symptom, not the source.
- A cache in front of the props view's per-key reads (4.3b) made every key's read depend on the whole key layout, so adding one attribute re-read every other prop, against `useRenderElement.reactivity`. Per-key granularity needs a projection, which takes a hydration id and so a node on every view. The per-key contract already stops each read at its winning source, so the gain was small, not the estimated half of the read path.
- A change to shared frame, transition or scheduling code (`useAnimationFrame`, `useTransitionStatus`, `createLazyTransitionStatus`, the open-change watchers) gets a Chromium run of `navigation-menu` and of `popover` or `dialog`, each family alone, before its stamp, beside the families it targets. 6c73973b batched every after-paint callback behind one shared timer and was checked on jsdom and its target families only; in Chromium a timer lost on a discarded fake clock held every later callback, and four NavigationMenu tests failed until c61afbc2.
- A generic native lane inside `useRenderElement` breaks its per-key and dynamic-key contracts (D14): port per part.
- A function a part returns for its parent to call (a thunk) is resolved in the parent's one computation for all its children: a sibling's top-level read re-runs it and re-creates its element, and while hydrating it runs under another owner path. A part's own reactive output needs its own memo (5.1.2 measured both).
- Before D16 the rule's tolerance was the summed p90 spreads, which one slow sample per side decides at ten samples: a 2x server drop at 597b2a75 (96.9 to 47.4 ms) read "same". Read verdicts from runs before D16 as unjudged.

## Log

One row per unit. A shared-core unit fills Expected with the profiling pass's estimate (self time × fan-out) and Actual with what the all-family bench measured; a family unit leaves Expected empty.

| Date | Unit | Wall time | Expected | Actual |
| :--- | :--- | ---: | :--- | :--- |
| 2026-10-17 | Separator, Progress and Meter Tracks and Indicators | 75 min to the gate | – | 11–15 nodes to 1–2; progress-meter-1000 mount 6.73x to 4.36x React, heap 25.2 to 14.2 MB; one chromium-only test bug (`toHaveStyle`) caught by the gate |
| 2026-10-17 | 4.3a: `useInteractions` lists compared by entry | 3 h (two wrong guesses before the probe) | 350 ms target, 505 ms bound (both families) | select script −146 ms, sync −613 ms (open/close x20 sync 1066 to 533 ms); combobox unchanged. 42% of target: the target assumed both families shared the mechanism, but no Combobox step moved, so its lists did not re-merge its items on the measured steps. Probe each family a unit's target counts on |
| 2026-10-17 | 5.1.2: render forms on the native path | 4 h (the thunk variant measured and dropped) | Tag, config and component forms at the plain part's cost; a render function at its own element's (the reviewer's first target), then base+1 Trigger and base Panel (the thunk) | Tag, tag config and component config at the plain part's cost (exactly, for a tag); a render function base+2 Trigger, base+1 Panel: the thunk failed sibling isolation (a sibling's top-level read re-ran it, 2 runs to the slow path's 1, and re-created a Panel) and hydration claims, so it keeps a memo. Mac bench pending |
| 2026-10-17 | 4.7: native kit, measured and closed | 1 h (two probes) | 185 ms (checkbox 34, progress 32, accordion 28, radio 23) | 0: the kit's grouped attribute effect is 2% of a 1000-Checkbox mount, the rest DOM writes and the part's own setup (phase 5); dispatch tuples under that, skipped; Collapsible's fan-out is the fixture's one shared signal, and a memo per root would only add work |
| 2026-10-18 | 5.1.4: one writer object per native element (773845cd) | 2 h (sized by heap snapshot first) | −504 B per closed Accordion item (the three `set`/`write` closures per element) | −205 B per item (2,674 to 2,469 B over the floor, −8%): each element now carries a 48 B `ElementWriter`, and the shared scope context lost less than the closures did, because `write` still captures most of it. Size a closure removal by the context it leaves behind, not only by the closures |
| 2026-10-18 | 5.1.4: write as a method of the element's writer (31ef9a40) | 1 h | −384 B per closed Accordion item (3 contexts of 128 B, 3 closures) | −383 B per item (2,833 to 2,450 B over the floor); each ElementWriter 48 to 104 B |
| 2026-10-18 | 5.1.4: module-level handler tables (5ef74af9, ca5754dd) | 3 h | about −336 B per Accordion item (the reviewer's estimate: composeHandler's context and closure) | −589 B per item (2,450 to 1,861 B), −1,213 B per tab and button pair: the gate closures and their `disabled` contexts went too. Count a handler's whole closure chain, gates included |
| 2026-10-18 | 5.1.4: a closed native panel as one object (3e66b101) | 1.5 h | about −368 B per closed panel (setup context, 4 closures, the conditional's context) | −313 B per Accordion item (1,861 to 1,548 B), −202 B per closed Collapsible root; 50 open/close cycles keep nothing |
| 2026-10-18 | Unit 49 fix: plain `isSelectedByFocus` (31a00661) | 4 h (one dropped attempt) | select by Enter and select by click back to 2f54cd00 | select by Enter 4.3 to 3.3 ms and select by click 7.2 to 4.6 ms against the tip; nothing regressed against 2f54cd00. A keyed transition on the second change only moved the cost to the next selection (+1.2 ms), measured and dropped. A cost that appears only with a collection before every step is real; one that vanishes with it is step garbage |
