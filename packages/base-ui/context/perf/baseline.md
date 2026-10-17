---
tags: [perf, benchmark, baseline, ssr]
sources: [packages/base-ui/test/perf-solid, packages/base-ui/test/perf-solid/ssr/run.mjs, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/utils/native, .github/workflows/base-ui-tests.yml]
verified: 2026-10-17
---

# Perf baseline

On CI run 38882393542 (commit b9b813c9, Solid 2.0.0-rc.15) Solid is 1.67x slower than React to mount, 1.35x slower to unmount, and 0.74x React's time for updates (geomeans).

## Provenance

- Main: "Benchmark tests" job of CI run 38882393542, commit b9b813c9, Solid 2.0.0-rc.15, 8 runs, 2 warmups, throttle 1x, 77 scenarios, 387 steps. No problems; the 15 known differences matched.
- Comparison: CI run 38559281856, commit 27e77167, Solid rc.13, same settings.
- Aggregation (both runs, same rule): steps grouped as mount, unmount, and updates (every other step); a step counts when both sync medians are at least 0.5 ms; geomean of `solid/react` sync ratios; totals sum the medians.
- React's side changed by 20–30% on many steps between the runs with no React change, so compare ratios, not ms.

## Aggregates

| group | steps | geomean b9b813c9 | geomean 27e77167 | sync total ms React / Solid (b9b813c9) | Solid slower |
| --- | --- | --- | --- | --- | --- |
| mount | 75 | 1.67x | 1.83x | 935 / 1713 | 54 |
| unmount | 58 | 1.35x | 1.48x | 256 / 354 | 32 |
| updates | 211 | 0.74x | 0.82x | 22508 / 17751 | 74 |

Heap after mount, 49 scenarios with both sides above 100 KB: React 191869 KB, Solid 278716 KB (1.45x; 1.40x on 27e77167).

## Slowest steps (b9b813c9, sync ratio, delta at least 1 ms)

| step | React ms | Solid ms | ratio | 27e77167 |
| --- | --- | --- | --- | --- |
| static/progress-meter-1000 mount | 16.4 | 127.8 | 7.79x | 9.94x |
| static/use-render-1000 mount | 5.9 | 42.8 | 7.25x | 10.80x |
| popover/roots-500 unmount | 3.3 | 19.7 | 5.97x | 6.13x |
| composition/render-fn-1000 mount | 8.7 | 47.3 | 5.44x | 5.84x |
| preview-card/roots-200 mount | 9.6 | 51.2 | 5.33x | 6.37x |
| static/separator-input-1000 mount | 11.5 | 56.8 | 4.94x | 5.01x |
| toolbar/200 mount | 6.1 | 28.4 | 4.66x | 5.77x |
| popover/roots-500 mount | 32.2 | 149.2 | 4.63x | 4.24x |
| static/button-render-fn-1000 mount | 10.0 | 41.1 | 4.11x | 4.51x |
| number-field/100 mount | 13.0 | 51.7 | 3.98x | 3.47x |
| tooltip/roots-500 mount | 23.9 | 92.3 | 3.86x | 4.78x |
| form/50-fields mount | 5.8 | 22.3 | 3.84x | 3.64x |
| menu/checkbox-radio open | 12.2 | 41.0 | 3.36x | 3.80x |
| combobox/full-1000 clear | 18.0 | 59.7 | 3.32x | 5.82x |

Largest absolute gaps: combobox/5000 open 183 vs 389 ms (2.12x, was 3.08x), menu/many-roots-500 mount 61 vs 181 (2.96x), popover/roots-500 mount 32 vs 149, select/preselected-800 open 42 vs 127 (3.02x, was 3.80x), static/avatar-1000 mount 64 vs 146 (2.27x), select/multiple-1000 open 44 vs 120 (2.73x).

## Material moves since 27e77167

Interaction ratios on the list popups improved most; two mounts got worse.

| step | 27e77167 | b9b813c9 |
| --- | --- | --- |
| autocomplete/1000 type "Item 5" | 3.02x | 1.64x |
| combobox/1000 open | 3.70x | 2.20x |
| combobox/full-1000 reopen again | 5.48x | 3.29x |
| combobox/5000 clear | 1.75x | 1.14x |
| menu/500 open by keyboard | 3.95x | 2.89x |
| select/1000 open | 2.79x | 2.06x |
| select/1000 hover sweep 100 | 1.40x | 1.04x |
| select/full-1000 nav x50 | 1.58x | 1.14x |
| number-field/100 mount | 3.47x | 3.98x |
| popover/roots-500 mount | 4.24x | 4.63x |
| tooltip/roots-500 heap after mount | 0.20x (2216 KB) | 2.14x (23993 KB) |

## Fastest steps (b9b813c9)

combobox/5000 close 0.01x, checkbox/uncontrolled-1000 click 100 0.04x, combobox/full-1000 close by Escape 0.07x, combobox/5000 type 0.12x, toggle-group click 100 0.14x, toast/50 update 50 0.14x, menu/500 click item and escape 0.14x, tooltip/handle-500 unmount 0.17x, radio/300 controlled value 0.19x.

## Heap after mount (b9b813c9)

- Worst: static/use-render-1000 13.84x, static/progress-meter-1000 11.50x, static/separator-input-1000 4.12x, static/button-render-fn-1000 3.55x, static/avatar-1000 3.29x, static/button-nonnative-1000 2.85x, accordion/raw-300 2.82x, dialog/roots-200 2.41x, popover/roots-500 2.33x, tooltip/roots-500 2.14x.
- Best: tooltip/handle-500 0.18x, scroll-area/1000-rows 0.29x, button/button-1000 0.30x, button/raw-1000 0.40x, accordion/300 0.44x, tabs/200 0.44x, switch/1000 0.44x.

## SSR (local, not in CI)

`bun run bench:solid:ssr`, 20 runs, 3 warmups, production builds. Main columns: local, rc.15, 2026-10-16, source at b9b813c9. Comparison: local, rc.13, 2026-10-14, commit 27e77167. One machine, single sessions; server ratios moved up to 1.3x between them in both directions, so treat a change below that as noise.

| fixture | server ms React / Solid | server ratio | server ratio 27e77167 | hydrate script ratio | HTML bytes React / Solid |
| --- | --- | --- | --- | --- | --- |
| select/1000 | 0.22 / 0.36 | 1.60x | 1.88x | 0.04x | 425 / 450 |
| checkbox/1000 | 10.80 / 72.70 | 6.73x | 6.98x | 0.25x | 320949 / 341729 |
| dialog/page | 0.09 / 0.20 | 2.31x | 2.68x | 0.17x | 178 / 186 |
| form/50 | 0.64 / 8.01 | 12.59x | 11.70x | 0.10x | 7660 / 10809 |
| accordion/300 | 3.35 / 32.43 | 9.67x | 8.82x | 0.25x | 96798 / 115453 |
| tabs/200 | 1.50 / 9.89 | 6.59x | 8.50x | 0.15x | 38697 / 46477 |

The hydrate script ratios above came from `ScriptDuration` and a hydrate time that stopped when React's `hydrateRoot` returned, after it had only scheduled its work, so they are not comparable across libraries or with later runs. Since 2026-10-16, hydrate ms runs from the hydrate call to the commit on both sides (see [perf method](method.md)). The identical React fixture read 54 ms and 26 ms total in one run before the change, and 17.0 ms and 16.4 ms after it. The aggregates above use in-page `sync` ratios, which CDP's `ScriptDuration` gap (fixed 2026-10-17; see [perf method](method.md)) does not affect; any `script` figure from these runs left out each step's synchronous work.

### Main-thread hydration time (Mac, 2026-10-17)

`ssr/run.mjs 10 collapsible/300,accordion/300` on the Mac, production builds, at 75bdb4e3 (D11) with the bench's main-thread table: CDP `TaskDuration` up to the commit plus over the two settled frames, which counts script on both sides (React's later tasks and Solid's synchronous hydrate alike). The floor is the hand-written Solid contract floor of the same fixture. React's hydrate ms (to its commit) leaves out much of its own work: accordion/300-open reads 25.5 ms against 48.5 ms of main-thread time.

| fixture | React ms | port ms | floor ms | port / React | port / floor | React hydrate ms |
| --- | --- | --- | --- | --- | --- | --- |
| collapsible/300 | 22.1 | 17.5 | 12.3 | 0.79x | 1.42x | 20.2 |
| accordion/300 | 40.9 | 28.1 | 14.0 | 0.69x | 2.00x | 23.5 |
| collapsible/300-open | 24.4 | 26.5 | 14.2 | 1.09x | 1.87x | 21.3 |
| accordion/300-open | 48.5 | 45.2 | 17.9 | 0.93x | 2.53x | 25.5 |

No variant lays out or recalculates style while hydrating (0 in both steps), so the gap to the floor is script.

## Reactive-node counts

Closed popup root budgets (`closedRoot.cost.test.tsx`, dev mode; "before" is the count before interactions were deferred to first intent): Tooltip 83 (110), Menu 142 (189), ContextMenu 103 (153), Popover 94 (113), PreviewCard 83 (99), Dialog 73 (94), AlertDialog 73 (94), Drawer 101 (125), Select 123 (188), Combobox 149 (210), NavigationMenu 230 (not deferred).

Fast (native) vs slow (`useRenderElement`) path, dev probe, Solid rc.13, 2026-10-14:

| part | fast | slow |
| --- | --- | --- |
| Button | 2 | 11 |
| Toggle | 6 | 27 |
| Checkbox + Indicator | 20 | 55 |
| Switch + Thumb | 13 | 57 |
| Collapsible closed / open | 12 / 18 | 47 / 73 |
| Accordion.Item | 14 | 84 |
| Tabs.Tab | 3 | 27 |
| `{...props}` wrapper: Button / Checkbox | none (refused) | 15 / 58 |

Same probe, slow-path parts: Separator 15, Input 31, Field (Root+Label+Control) 84, Progress (Root+Track+Indicator) 60, Slider 153, NumberField 131, ScrollArea 90; Tooltip closed 81 / open 256, Popover 91 / 365, Dialog closed 71, Menu 136 / 490 (25 per item), Select 121 / 436 (29 per item), Combobox 146 / 459 (27 per item), NavigationMenu closed 227.

Related: [perf method](method.md), [optimization map](optimization-map.md).

## Warnings (census at f27d4702, 2026-10-17)

Console output from every run the Base UI tests workflow makes, the benches and the docs crawl. Unit
suites record through the census (`SOLID_WARNING_CENSUS`, `packages/solid/test/warningCensus.ts`),
which also sees what the harness swallows; `known-warnings.json` stays empty, because the CI-gated
production bench is clean.

| Run | Result | Messages |
| --- | --- | --- |
| jsdom unit suites | 460 files, 10,100 tests passed | 0 |
| Chromium unit suites | 458 files, 11,206 tests passed | 1: a harness-swallowed `FLUSH_IN_EFFECT_CALLBACK` (MenuFilterSubmenuRoot), harness origin |
| Production bench, React and Solid | every scenario | 0 |
| Docs hydration crawl | every page | 0 |
| Development bench (`BENCH_DEV=1`) | 9 scenarios | 50, below |

The development bench is not a CI gate; each finding goes to the unit that fixes it, and none is
listed to pass:

- `HUGE_FAN_IN` in `composition/render-fn-1000` and `static/use-render-1000`: a list's parent
  tracked 3–4 sources per slow-path row. Fixed by plan 3's 4.3d (c996546d): 1 per row, and the
  render-function scenario no longer warns. `static/use-render-1000` still tracks 2 per row because
  its fixture wraps `element()` in a fragment of its own.
- `HUGE_FAN_OUT` in `collapsible/300`: a fixture artifact, not a library cost. The fixture drives
  300 roots from one controlled `open` signal, and each root has 8–9 computations reading it, so
  the one signal has thousands of subscribers; in real use each root has its own `open`, about 9
  subscribers a signal. A memo per root would not cut a re-run, as every root flips together, and
  would add a node and a recompute per root (4.7's probe, 2026-10-17), so none was added.
- `HUGE_FAN_OUT` in `checkbox/controlled-1000`, `static/avatar-1000`, `radio/300` and
  `combobox/full-1000`: fan-out over one shared value. Goes to keyed selection (4.4b's mechanism,
  then 4.11) and per-part read reduction.
- OTPField's `aria-label` warning in `otp-field/6` and `/12`, in both apps: a fixture bug, fixed in
  a87235f9 (a label around the field).
