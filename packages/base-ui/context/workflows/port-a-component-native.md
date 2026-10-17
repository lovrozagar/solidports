---
tags: [porting, native, perf, workflow, playbook]
sources: [packages/base-ui/packages/solid/src/utils/native/element.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/utils/native/static.cost.test.tsx, packages/base-ui/packages/solid/test/parityHarness.tsx, packages/base-ui/packages/solid/test/defineSsrFixtures.ts, packages/base-ui/scripts/bench-component.mjs, packages/base-ui/scripts/remote-mac.mjs]
verified: 2026-10-17
---

# Port a component to the native path

The living playbook for moving a family onto the native kit (D15): read it before writing a family's leaves, and add to it after every unit what worked, what failed and the recipe that came out of it. A family is done at the exit bar (within 1.25x of the hand-written floor and below React on every metric, closed and open, browser and SSR), not when its parts are native.

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

## Pitfalls

- In a real browser `toHaveStyle` compares computed values (a `40%` width reads in pixels): assert the inline `element.style` instead, and type query helpers as `HTMLElement`.
- The server prints numbers as written (`inset-inline-start:0`) where the CSSOM reports `0px`: compare hydrated styles through the CSSOM.
- `typecheck` (pre-commit and verify) covers the whole working tree, so uncommitted work can fail an unrelated commit and a rebuilt tree can fail verify: typecheck before rebuilding a commit.
- A tooling change needs its end-to-end path run, not only its unit tests: a `const` shadowing `run()` in `bench:component`'s main passed every unit test and failed on the Mac. `base-ui-bench-component-main.test.ts` and `base-ui-scripts-lint.test.ts` now catch that class locally.
- A generic native lane inside `useRenderElement` breaks its per-key and dynamic-key contracts (D14): port per part.
- Before D16 the rule's tolerance was the summed p90 spreads, which one slow sample per side decides at ten samples: a 2x server drop at 597b2a75 (96.9 to 47.4 ms) read "same". Read verdicts from runs before D16 as unjudged.

## Log

One row per unit. A shared-core unit fills Expected with the profiling pass's estimate (self time × fan-out) and Actual with what the all-family bench measured; a family unit leaves Expected empty.

| Date | Unit | Wall time | Expected | Actual |
| :--- | :--- | ---: | :--- | :--- |
| 2026-10-17 | Separator, Progress and Meter Tracks and Indicators | 75 min to the gate | – | 11–15 nodes to 1–2; progress-meter-1000 mount 6.73x to 4.36x React, heap 25.2 to 14.2 MB; one chromium-only test bug (`toHaveStyle`) caught by the gate |
