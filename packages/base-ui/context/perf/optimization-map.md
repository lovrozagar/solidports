---
tags: [perf, native, optimization, planning]
sources: [packages/base-ui/packages/solid/src/utils/useRenderElement.tsx, packages/base-ui/packages/solid/src/utils/native/index.ts, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useInteractions.ts, packages/base-ui/packages/solid/src/floating-ui-solid/hooks/useFloatingRootContext.ts, packages/base-ui/packages/solid/src/internals/composite/list/CompositeList.tsx, packages/base-ui/packages/solid/src/internals/composite/item/useCompositeItem.ts, packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/toast/store.ts, packages/base-ui/packages/solid/src/utils/popups/useInteractionIntent.ts]
verified: 2026-10-17
---

# Optimization map

Ten ranked opportunities from the 2026-10-14 audit, re-checked at b9b813c9: the automatic native lane comes first, and item 10 has shipped except for NavigationMenu. This is input for the perf-rewrite plan, not the plan.

Line numbers were read at b9b813c9. Benchmark ratios are `solid/react` sync from CI run 38882393542; node counts are dev-mode (see [baseline](baseline.md) for provenance). Gains are expected directions from node counts and the [target architecture](target-architecture.md), not measurements.

## 1. Automatic native lane inside `useRenderElement`

- Where: `packages/base-ui/packages/solid/src/utils/useRenderElement.tsx`: attribute root `:598`, structure effect `:631`, per-key effects `:676`, source memos `:200`, `:388`, `:430`, children memos `:781`, `:823`, ref layout effect `:480`; `utils/propsView.ts`. The native building block is `renderNativeElement` / `NativeElementSpec` in `utils/native/element.ts` (`:124`, `:29`).
- What: when the tag is intrinsic, `render` and sources are static, and the render is a non-hydrating client render, take the native path inside `useRenderElement` itself, so the 150 files that never call the kit benefit.
- Evidence: Button 11 nodes slow vs 2 native. Slowest mounts are all slow-path: static/progress-meter-1000 7.79x, static/use-render-1000 7.25x, static/separator-input-1000 4.94x, static/button-render-fn-1000 4.11x, toolbar/200 4.66x; heap 3–14x on the same scenarios.
- Expected: about 9 fewer nodes per simple element; the largest mount and heap gain in the map.
- Outcome (2026-10-17, D14): rejected. A shared binding either re-reads every key's getter on any change or drops the structure effect that runtime key sets need, and both break `useRenderElement`'s tested contracts; about 1 node of 14 is safe to save generically. The static family is ported part by part through the native kit instead.

## 2. Accept proxied props in `canRenderNative`

- Where: `utils/native/index.ts:65` (the `$PROXY` check refuses any Solid proxy).
- What: read a consumer spread once (`isStatic` per key, key-set check) and accept it instead of falling back.
- Evidence: Button direct 2, wrapper without spread 6, wrapper with `{...props}` 15; Checkbox direct 20, `{...props}` wrapper 58.
- Expected: design-system wrappers get native-path cost.

## 3. Delegate Select and Combobox item handlers

- Where: `floating-ui-solid/hooks/useInteractions.ts:36` merges every hook's prop lists in one `createMemo` without an equality check, so a flip of one input re-merges every item's props. Select's typeahead `enabled` getter (`select/root/SelectRoot.tsx:523`) flips with `open()`. `SelectItem.tsx` itself no longer reads typeahead state.
- What: one delegated handler per list instead of per-item `getItemProps()` objects.
- Evidence: select/1000 open 2.06x, select/multiple-1000 open 2.73x, select/preselected-800 open 3.02x, combobox/1000 open 2.20x, combobox/5000 open 2.12x; Select.Item budget 27 nodes.
- Expected: open and hover-sweep cost per item drops to the row's own nodes.

## 4. Keyed highlight selector

- Where: `internals/composite/item/useCompositeItem.ts:15` (`isHighlighted` reads `highlightedIndex()`) and its `tabindex` getter `:32`; `solid-1-compat.ts:142` (`createSelector` shim re-runs every reader).
- What: keyed selection on `createProjection`, two updates per change instead of one per item.
- Evidence: each arrow key or hover is O(n) in items; select/1000 nav x50 1.09x, menu/500 nav x50 above React.
- Expected: nav and hover sweeps become O(1) per step.
- Status (plan 3, 4.9): done for the Select, Combobox and Menu stores (`keyedSelector` on `activeIndex`, Select's `selectedIndex`); a 2026-10-17 jsdom count had 1,000 `isActive` re-runs per move at 1,000 items. The composite roots' `isHighlighted` and the native Tabs and Radio copies remain (4.11).

## 5. Native list items and incremental registration

- Re-measured 2026-10-17 (plan 3, 4.9, jsdom counts on the combobox and select benches): one flush per mounting step, none on a move, and the sort is near linear; registration is not where the list time goes.

- Where: `internals/composite/list/CompositeList.tsx:273` re-sorts all automatic items by document position per batch; `:96` copies metadata per item.
- What: native list items (`utils/native/listItem.ts`), creation-order guess plus binary-search fix-up.
- Evidence: late-registered items cost O(n² log n); per-item open costs Menu 25, Select 29, Combobox 27 nodes.
- Expected: open of 1000-item lists scales linearly.

## 6. Floating store dedupe; binding instead of effect sync

- Where: `createMemo(() => store().select(...))` in floating-ui-solid `useRole`, `useClientPoint`, `useListNavigation`, `useDismiss`, `useTypeahead` and `FloatingFocusManager`, plus `menu/trigger/MenuTrigger.tsx` and `dialog/trigger/DialogTrigger.tsx`; `floating-ui-solid/hooks/useFloatingRootContext.ts:73` syncs elements into the store from an effect.
- What: share one selector per popup; derive instead of syncing.
- Evidence: open popups cost 256 (Tooltip) to 490 (Menu) nodes.
- Expected: fewer nodes per open popup; steadier open steps.

## 7. Native context; derived signals instead of signal-writing effects

- Where: `solid-helpers.tsx:263` `provideContext` (41 call sites: owner, lazy memo, keep-alive effect each); `solid-helpers.tsx:103` `createDepsEffect` (71 call sites, memo plus effect); 117 `createEffect(` in non-test source.
- What: `utils/native/context.ts` pattern (one transparent owner plus `setContext`); replace effects that only write signals with derived values.
- Expected: about two nodes fewer per provider (three nodes become one transparent owner), and fewer extra flush passes.

## 8. Native SSR and hydration path

- Where: `canRenderNative` refuses `isServer || isHydrating()`; the kit's plain `createRenderEffect` (`utils/native/index.ts:224`) takes hydration ids.
- What: one component path on client, server and hydration (`ssrElement` on the server, transparent bindings on the client).
- Evidence: server render 2.3–12.6x React on 5 of 6 SSR fixtures (local, rc.15, 2026-10-16).
- Risk: highest in the map. Gate every step on `test/hydration`, `*.hydration.test.tsx`, `test/ssr` and the docs hydration crawl.

## 9. Toast per-toast metadata

- Where: `toast/store.ts:49` `createToastMetadata` rebuilds a `Map` over all toasts; called at `:192`, `:236`, `:595`.
- What: per-toast signals for offsets and indexes.
- Evidence: O(n) per change, O(n²) for n adds; toast/50 add 50 is already 0.54x React.
- Expected: small; matters only for large toast stacks.

## 10. Defer trigger hooks to first intent (shipped, except NavigationMenu)

- Where: `utils/popups/useInteractionIntent.ts`: one capture listener per event type and document; a closed root builds its interactions on first intent.
- Status: done for Tooltip, Menu, ContextMenu, Popover, PreviewCard, Dialog, AlertDialog, Drawer, Select and Combobox (closed-root budgets fell 16–35%). NavigationMenu still builds hover and click hooks up front (budget 230).
- Remaining evidence: popover/roots-500 mount 4.63x, tooltip/roots-500 3.86x, menu/many-roots-500 2.96x; these now point at items 1, 6 and 7.

## Cross-cutting rules for the plan

- Every step keeps all suites green; see the test policy in [parity](../testing/parity.md).
- Lower cost budgets in the same commit as the change that earns them.
- Measure with interleaved A/B (`VARIANTS`, [perf method](method.md)) before and after each step.
