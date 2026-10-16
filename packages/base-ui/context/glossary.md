---
tags: [glossary, terms, reference]
sources: []
verified: 2026-10-16
---

# Glossary

Project vocabulary for the Base UI Solid port, sorted alphabetically; each entry names where the term lives in code or which context file covers it.

## `animationType`

The collapsible panel's detected motion mode: `'css-transition'`, `'css-animation'`, or `'none'`. `getAnimationType` reads `getComputedStyle` on the panel when it opens or closes and picks the open/close flow (`packages/base-ui/packages/solid/src/collapsible/panel/useCollapsiblePanel.ts:29`, `:620`). See [transitions](architecture/transitions.md).

## `beforematch`

Browser event fired when find-in-page reveals a `hidden="until-found"` element. The collapsible panel listens for it and opens immediately with a forced `0s` duration, bypassing the trigger handler (`useCollapsiblePanel.ts`).

## Closed-root budget

The ceiling on reactive nodes one extra closed popup root (root, trigger, unopened popup parts) may add, counted with Solid's dev `onOwner` hook. Budgets live in `packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx`; each entry keeps its pre-deferral count in a comment. A change that adds a node fails the test. NavigationMenu is the one root whose trigger hooks are not deferred. Native parts have sibling budgets in `utils/native/*.cost.test.tsx`. See [primitive costs](solid/primitive-costs.md).

## `data-open` / `data-closed`

State attributes mapped from `open`, mutually exclusive. Popups use `utils/popupStateMapping.ts`; collapsible and accordion panels use `utils/collapsibleOpenStateMapping.ts`, and their triggers get `data-panel-open` instead.

## `data-starting-style` / `data-ending-style`

Attributes the runtime sets from `transitionStatus` (`utils/styleHookMapping.ts`) so consumer CSS can style enter and exit frames. They are plain attributes, not browser animation signals.

## Fast path

See native lane.

## Generated docs

`packages/base-ui/docs/solid` is generated output. `scripts/docs/generate.mjs` copies pages from `docs/react/src/app/(docs)/react/` to `docs/solid/src/app/(docs)/solid/`, and `scripts/docs/react-to-solid.mjs` rewrites React code and wording to Solid. Fix docs in the generator or `scripts/docs/templates/`, then run `bun run docs:generate` and `bun run docs:validate`; never hand-edit the output. The docs-infra runtime in `scripts/docs/templates/docs-infra/src` is the hand-kept exception. See [docs pipeline](tooling/docs-pipeline.md).

## `hiddenUntilFound`

Collapsible and Accordion option. The closed panel stays mounted with `hidden="until-found"` so find-in-page can reveal it through `beforematch`. It overrides `keepMounted={false}` with a dev warning (`collapsible/panel/CollapsiblePanel.tsx:50`).

## `keepMounted`

Option on panels and popups. The closed element stays in the DOM, hidden, instead of unmounting. It changes render gating only, not the animation flow.

## `mounted`

Internal state from `useTransitionStatus` (`utils/useTransitionStatus.ts:58`) that says whether the element may exist in the DOM. It differs from `open` because exit animations need the element to outlive the close.

## Native lane

The Solid-native render path: a part renders its element with direct JSX through the kit in `packages/base-ui/packages/solid/src/utils/native/` instead of `useRenderElement`, owning at most one attribute effect. A part takes it only when `canRenderNative` (`utils/native/index.ts:65`) passes: client render, not hydrating, props not a store proxy (so a `{...props}` wrapper fails), no `render` prop, a static `ref`, and any part-specific static keys. Families on it: Accordion, Button, Checkbox, CheckboxGroup, Collapsible, Radio, RadioGroup, Switch, Tabs, Toggle, ToggleGroup. Also called the fast path. See [render pipeline](architecture/render-pipeline.md).

## `open`

The logical, public state of a disclosure or popup. It is the source of truth that `mounted` and `transitionStatus` follow.

## Panel

The disclosable element of Collapsible and Accordion. The runtime inspects its computed styles to pick `animationType` and measures it to set the height and width CSS variables.

## Slow path

The generic render path through `packages/base-ui/packages/solid/src/utils/useRenderElement.tsx`: merged props views, an attribute root and render effects, source memos, a children memo and a ref effect per element. Every part outside the native lane, every SSR or hydrating render, and every native part whose props fail `canRenderNative` uses it. A Button costs 11 reactive nodes here against 2 on the native lane (dev probe 2026-10-14, rc.13).

## Snapshot tree

A read-only upstream copy replaced on each version bump: `packages/base-ui/packages/react` (`@base-ui/react`), `packages/base-ui/packages/utils` (`@base-ui/utils`), and `packages/base-ui/docs/react` (upstream `docs/` at the same tag). Port changes go to `packages/solid` or the docs generator; never edit a snapshot to match Solid. See [layout](architecture/layout.md) and [upstream sync](workflows/upstream-sync.md).

## Sync vs paint (bench)

Columns of the Solid-vs-React benchmark in `packages/base-ui/test/perf-solid`. `sync` is the time from step start through the step's work and a `flush()`; `paint` adds the wait for the next paint; `script` is the change in Chrome's `ScriptDuration` metric over the step (`test/perf-solid/shared/harness.ts:63-65`, `run.mjs:107`). Values are medians over the measured runs, and the `solid/react sync` ratio compares `sync`. See [perf method](perf/method.md).

## `transitionStatus`

Phase value `'starting' | 'ending' | 'idle' | undefined` owned by `useTransitionStatus` (`utils/useTransitionStatus.ts:8`). It drives `data-starting-style` and `data-ending-style`.

## Verify stamp

`bun run verify` (`scripts/verify.ts`) runs `fmt:check`, `lint`, `typecheck`, `test`, and the repo gates from `standards.gates` in the root `package.json`. It refuses a dirty tree. When all pass it writes `standards-verified/<sha>` in the common git dir. The pre-push hook (`scripts/pre-push.ts`) refuses any pushed commit without a stamp. See [standards](tooling/standards.md).
