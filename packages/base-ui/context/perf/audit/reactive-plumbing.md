---
tags: [perf, audit, reactivity, store, transitions]
sources: [packages/base-ui/packages/solid/src/solid-helpers.tsx, packages/base-ui/packages/solid/src/solid-1-compat.ts, packages/base-ui/packages/solid/src/utils/native/context.ts, packages/base-ui/packages/solid/src/utils/store/SolidStoreV2.ts, packages/base-ui/packages/solid/src/utils/useTransitionStatus.ts, packages/base-ui/packages/solid/src/utils/useAnimationsFinished.ts, packages/base-ui/packages/solid/src/utils/useOpenChangeComplete.tsx]
verified: 2026-10-16
---

# Audit: reactive plumbing (plan 3, leaves 2.1–2.3)

Scope: `solid-helpers.tsx`, `solid-1-compat.ts`, `utils/native/context.ts`, `SolidStore` (`utils/store/SolidStoreV2.ts`), and the transitions stack (`useTransitionStatus`, `useAnimationsFinished`, `useOpenChangeComplete`, `createEffectGroup`, `runInLazyScope`).

Probes ran on 2026-10-16 under jsdom with the Solid dev runtime, through a temporary `src/utils/zz-probe-reactive.cost.test.tsx` that I have since deleted. Node counts use the `DEV.hooks.onOwner` technique from `native.cost.test.tsx`. Timings are dev and jsdom, so compare them only as ratios. The installed Solid version could not be read directly, because the session's path denylist blocks `node_modules`. The `catalog:` pin and the existing context files both say 2.0.0-rc.15, and the probe behavior matches the rc.15 notes: `ownedWrite`, `REACTIVE_WRITE_IN_OWNED_SCOPE`, and `createProjection` in `solid-js`.

## 1. Inventory: what each helper allocates

Counts are non-test call sites under `packages/solid/src`.

| Helper | Where | Allocates per call | Hydration ids | Call sites |
| --- | --- | --- | --- | ---: |
| `provideContext` | `solid-helpers.tsx:263` | Client: Provider root, `setContext`, lazy `children()` memo, keep-alive render effect. Server/hydration: `<Provider>` JSX. | Yes (root + memo + effect); **two code paths**: client vs server/hydration | 41 |
| JSX `<XContext value>` | 70 sites (AriaCombobox 5, FloatingTree, Menu, Select, RadioGroup, ToggleGroup, NavigationMenu …) | root + `setContext` + `children()` (2 lazy memos) | Yes | 70 |
| `createContextOwner` / `provideNativeContext(s)` | `utils/native/context.ts:20`, `:27`, `:32` | 1 transparent owner + 1 `setContext` per context | None on the client; **the server is unverified** (see §5) | 7 (Accordion, Collapsible, Tabs) |
| `createDepsEffect` | `solid-helpers.tsx:103` | `createMemo(deps, shallowEqual)` + `createEffect` = **2 nodes** (probe) | 2 ids | 72 |
| `createDepsRenderEffect` | `solid-helpers.tsx:131` | memo + render effect = 2 nodes | 2 ids | 35 |
| `createLayoutEffect` | `solid-helpers.tsx:121` | 1 render effect; on the server the node exists with no apply | 1 id | 66 |
| `createDepsMemo` | `solid-helpers.tsx:111` | 1 memo | 1 id | 4 |
| `live` | `solid-helpers.tsx:140` | closure only | none | 38 |
| `useRef` | `solid-helpers.tsx:203` | `{ current }` | none | 157 |
| `omitComponentProps` | `solid-helpers.tsx:159` | `omit` Proxy view | none | 17 |
| `splitComponentProps` | `solid-helpers.tsx:169` | compat `splitProps`: one getter per picked key + `omit` view | none | 170 |
| `defaultProps` | `solid-helpers.tsx:219` | compat `mergeProps` Proxy (reads walk the sources) | none | 17 |
| `ComponentWithPayload` | `solid-helpers.tsx:227` | `children()` (2 memos) + memo + `Show` (3 memos) + optional child memo ≈ 6–7 | Yes | 17 |
| `childrenLazy` | `solid-helpers.tsx:189` | `children()` on first read | Yes (lazy, so ids can drift) | 1 |
| compat `mergeProps` | `solid-1-compat.ts:16` | 1 Proxy; keys fixed at call time | none | 16 (+17 through `defaultProps`) |
| compat `splitProps` | `solid-1-compat.ts:84` | one getter per key + `omit` | none | 19 (+170 through `splitComponentProps`) |
| compat `on` | `solid-1-compat.ts:114` | none beyond its effect; the apply runs untracked | — | 15 |
| compat `createSelector` | `solid-1-compat.ts:143` | none; every reader reruns on every change | — | 0 |
| compat `createStore` | `solid-1-compat.ts:230` | Solid 2 store + path-setter wrapper | — | 1 |
| `SolidStore(...)` | `SolidStoreV2.ts:31` | 1 Proxy, one **ownerless** signal per key read, one key-set signal; bound keys: one transparent writable memo on first read | Ownerless/transparent, so none on the client; bindings compute directly on the server | 28 |
| `store.useState(key)` | `SolidStoreV2.ts:175` | Direct key: 0 nodes. Derived selector: **1 transparent memo per `useState` call site instance**, created on first tracked read | none | 448 |
| `store.useSyncedValue(s)` / `useControlledProp` | `SolidStoreV2.ts:57`, `:71`, `:123` | 1 writable derived signal per key, plus 1 dev effect | none (transparent) | 38 / 10 |
| `store.observe` | `SolidStoreV2.ts:230` | Recording Proxy per notify; 1 effect per watched binding | — | 24 |
| `useTransitionStatus` | `utils/useTransitionStatus.ts:38` | Closed: **2** writable computeds (probe). Open: **3** (+ `createEffectGroup`) | 2 ids (non-transparent `createSignal(fn)`); the group comes through `runInLazyScope` | 17 |
| `useOpenChangeComplete` | `utils/useOpenChangeComplete.tsx:9` | **1 eager effect, even while closed** (probe), plus a frame | 1 id | 25 |
| `useAnimationsFinished` | `utils/useAnimationsFinished.ts:44` | `AnimationFrame` + an owner cleanup; a MutationObserver only while running | none | 9 |
| `createEffectGroup` | `utils/native/effectGroup.ts` | 1 effect + 1 `onCleanup` for N gated parts | 1 id | 4 |
| `runInLazyScope` | `utils/runInLazyScope.ts:17` | 1 owner with an explicit id when the owner has an id | own id namespace | 9 |

Effect totals in non-test source: 117 `createEffect`, 72 `createDepsEffect` (2 nodes each), 35 `createDepsRenderEffect` (2 each), 66 `createLayoutEffect`, 8 raw `createRenderEffect`, 33 `onSettled`. 15 of the effect sites are dev-only (`NODE_ENV !== 'production'`). There are 244 `createMemo` and 181 `createSignal` sites, and 65 signals use `ownedWrite: true`.

## 2. Optimal Solid 2 replacements

### 2a. Context: one transparent owner per root, one record per family

Measured per part in the dev runtime. Each part is a component providing context to a leaf that reads it; `bare` is the leaf alone.

| Shape | Nodes per part | Over bare | 1000-part mount ms |
| --- | ---: | ---: | ---: |
| bare leaf | 4 | 0 | 7.3 |
| JSX `<Ctx value>` | 9 | +5 | 17.3 |
| `provideContext` | 9 | +5 | 9.9 |
| native owner, 1 context | 5 | +1 | 7.9 |
| native owner, 2 contexts | 5 | +1 | 10.3 |
| `provideContext` ×3, nested | 17 | +13 | 21.8 |
| native owner, 3 `setContext` | 5 | +1 | 10.8 |
| native owner, 1 record context holding 3 values | 6 | +2 | 11.6 |

- Node-wise, the native owner is optimal: +1 node regardless of how many contexts it carries. Each additional `setContext` costs about 1–1.5 ms per 1000 parts, because it copies the record (GOTCHA-007). A record context did not beat three `setContext` calls on one owner (11.6 vs 10.8 ms), so **do not merge contexts into records for speed**. Merge them only where it removes a provider owner.
- The target is one owner per part, carrying every context that part provides, on **one code path for client, server and hydration**. Sketch:

```ts
// utils/context.ts (replaces provideContext and the JSX providers)
export function provide<R>(entries: ReadonlyArray<readonly [Context<any>, unknown]>, render: () => R): R {
  const owner = createOwner({ transparent: true });
  for (const [context, value] of entries) setContext(context, value, owner);
  return runWithOwner(owner, render) as R;
}
// usage: return provide([[AccordionItemContext, item], [CollapsibleRootContext, root]], () => <div …/>);
```

- The 41 `provideContext` sites and 70 JSX providers move to `provide`. That is +1 node per provider instead of +5, and +1 per part instead of +13 where three providers nest. It also removes the keep-alive render effect and the client/server split in `provideContext`.
- Gate: §5 risk 1, whether a transparent owner takes no id on the server, must be confirmed first.

### 2b. Effects: one node per effect, and derive instead of write

- **`createDepsEffect` / `createDepsRenderEffect` become one node.** `createEffectGroup` already implements per-part `shallowEqual` gating, cleanup ordering and disposal on a single effect, and a one-part group is exactly `createDepsEffect` at 1 node. Reimplement both helpers on that core: `createDepsEffect(deps, fn) => createEffectGroup([{ deps, apply: fn }])`, plus a render-effect variant. That saves 1 node at each of 107 sites per mounted instance, with no behavior change. The existing effectGroup tests already cover its gating semantics.
- **Signal-writing effects become derivations.** See §3. A signal-writing effect and a memo both cost 1 node (probe), so the gain is not nodes. It removes the extra flush pass, the one-flush stale frame (the "copy in effect" anti-pattern `useTransitionStatus` already documents) and an `ownedWrite` signal. Patterns:

```ts
// store key mirrored from an accessor → binding (exists)
store.useSyncedValue('listId', listId);
// reset-on-input-change → writable memo
const [inert, setInert] = createSignal((prev) => (value(), false));
// pure function of inputs → memo, or a plain accessor when read once
const inputMode = createMemo(() => (platform.os.ios ? (minWithDefault() >= 0 ? 'decimal' : 'text') : undefined));
```

### 2c. Keyed selection on `createProjection`

1000 readers, 50 selection changes. Each reader is a render effect over `isSelected(i)`.

| Shape | Nodes | Computes per change | Applies per change | ms per 50 changes |
| --- | ---: | ---: | ---: | ---: |
| compat `createSelector` (predicate) | 1000 | 1000 | 1000 | 13.3 |
| `createProjection`-keyed | 1001 | **2** | **2** | **1.7** |

Sketch (new `utils/createKeyedSelector.ts`; the compat shim is then deleted):

```ts
export function createKeyedSelector<K extends PropertyKey>(source: () => K | null | undefined) {
  let prev: K | null | undefined;
  const selected = createProjection<Record<PropertyKey, true>>((draft) => {
    const next = source();
    if (prev != null && prev !== next) delete draft[prev];
    if (next != null) draft[next] = true;
    prev = next;
  }, {});
  return (key: K) => selected[key] === true;
}
// Multi-select variant: diff the previous key set against the next one inside the same draft.
```

- Keys must be property keys. Index-keyed highlight (`activeIndex`) works as is. Value-keyed selection with object values or a custom `isItemEqualToValue` (Select, Combobox) needs a stable key per item, for example the item's registration index. Without one, keep the predicate for that comparator only.
- Owner: the projection is one computed, created where the source lives (the list root), not per item.

### 2d. `SolidStore`

- Read cost is already right. A direct-key tracked read costs 0 nodes (10 readers created 10 nodes, the same as 10 plain signals). A derived selector costs 1 transparent memo.
- **Derived-selector memos are per call site instance, not per store.** Every part that calls `store.useState('derivedSelector')` gets its own memo (`SolidStoreV2.ts:194–205`). For per-item selectors, such as `isActive(index)` in lists, that is O(n) memos plus O(n) reruns, which is §2c's problem in another form. The target: per-item selection goes through keyed projections owned by the store. Argument-free derived selectors share one lazily created memo per `(store, selector)`, owned by the store's owner (transparent).
- **Writes are about 40x a plain signal.** 1000 `store.set` calls took 2.09 ms against 0.05 ms for 1000 writes to plain signals. Each write goes through `commit()`: `Reflect.ownKeys(patch)`, a change array, a `filter`, `runWithOwner(null, () => untrack(…))`, the `written` Map, then `notify()`, which copies the listener set with `Array.from`. Sketch of the fast path:

```ts
function set(key, value) {
  if (computedKeys.has(key) || Object.is(latest(key), value)) return;
  written.set(key, value);
  const b = bindings.get(key);
  if (b) b.setValue(value); else writeSlotRaw(key, value); // slot signals are created ownerless + ownedWrite, so no runWithOwner/untrack is needed per write
  if (listeners.size) notify();
}
```

- Keep the React semantics: untracked reads see the latest write, and tracked reads see the committed value. The audit found no reason to change the per-key-signal design. Only the derived-selector sharing and the write path are wrong.

### 2e. Transitions: lazier, and no effect while closed

- `useTransitionStatus` is already lazy for its effects. A closed element still costs **2 computeds** (`mounted` and `transitionStatus`, both `createSignal(fn)`, which take ids). With 300 closed Accordion panels that is 600 nodes. Target: while an element has never been open, `mounted = open` and `transitionStatus = undefined` are plain accessors. The writable computeds are created on first open through `runInLazyScope`, the same mechanism the effect group already uses, so ids stay aligned: the lazy scope carries its own id namespace. An element that starts open creates them eagerly, as today.
- `useOpenChangeComplete` creates **1 effect eagerly, even for a closed element that never opens** (25 sites). Target: create it on first open, inside the same lazy scope as the transition machinery, so a closed popup or panel pays 0 nodes for both.
- `useAnimationsFinished` is fine: it costs only a frame handle and an owner cleanup until it runs.
- `createEffectGroup` is the right primitive for every multi-effect hook. Collapsible already uses it. Popups (Tooltip, Popover, Menu, Dialog) should move their open-only effects into one group created on first open.

## 3. Signal-writing effects that can be derived

I extracted all 188 effect sites (`createEffect` plus `createDepsEffect`) mechanically. A heuristic split by apply body: 30 contain only signal or store writes, 44 write signals and also touch the DOM, timers or subscriptions, and 114 write no signal (DOM, subscriptions, callbacks).

Manual classification of the 30 write-only sites, plus a sample of 11 mixed ones (41 classified). Legend: **D** = derivable (memo, writable memo or store binding); **E** = must stay an effect (timer, DOM read, subscription, external callback); **R** = child-to-parent registration with cleanup; **M** = mount flag.

| # | Site | Class | Replacement |
| --- | --- | --- | --- |
| 1 | `autocomplete/root/AutocompleteRoot.tsx:64` | D | writable memo resetting `inlineInputValue` when controlled or `enableInline` changes |
| 2 | `avatar/fallback/AvatarFallback.tsx:24` | E | timer |
| 3 | `avatar/image/AvatarImage.tsx:90` | E | image load |
| 4 | `combobox/list/ComboboxList.tsx:64` | D | `store.useSyncedValue('listId', listId)` |
| 5 | `combobox/root/AriaCombobox.tsx:1387` | D | derive `activeIndex = null` when the filtered list is empty (writable memo) |
| 6 | `field/control/FieldControl.tsx:133` | E | reads the input's DOM value |
| 7 | `filter-dropdown/empty/FilterDropdownEmpty.tsx:22` | M | `onSettled` (or no flag) |
| 8 | `floating-ui-solid/hooks/useHoverFloatingInteraction.ts:103` | E | reset interaction state; better done in the close handler |
| 9 | `floating-ui-solid/hooks/useHoverReferenceInteraction.ts:157` | D | getter over `props.handleClose?.__options` |
| 10 | `floating-ui-solid/hooks/useRole.ts:54` | D | memo over `floatingElement` (reads `.id` once per element) |
| 11 | `internals/labelable-provider/useAriaLabelledBy.ts:92` | E | MutationObserver |
| 12 | `menu/trigger/MenuTrigger.tsx:488` | E | timer |
| 13 | `navigation-menu/root/NavigationMenuRoot.tsx:194` | D | `createSignal(() => (value(), false))` |
| 14 | `number-field/input/NumberFieldInput.tsx:97` | E | caret DOM (heuristic false positive) |
| 15 | `number-field/root/NumberFieldRoot.tsx:336` | D | writable memo `format(value, locale, format)`, gated by the blur flag |
| 16 | `number-field/root/NumberFieldRoot.tsx:361` | D | pure memo of `min` and platform |
| 17 | `radio-group/RadioGroup.tsx:170` | E | writes a user ref |
| 18 | `select/popup/SelectPopup.tsx:474` | D | `store.useSyncedValue('listboxId', …)` |
| 19 | `select/positioner/SelectPositioner.tsx:94` | D | writable memo that updates only while unmounted |
| 20 | `select/root/SelectRoot.tsx:304` | E | form validation commit |
| 21 | `select/root/SelectRoot.tsx:440` | D | floating-store binding for `positionReference` |
| 22 | `slider/root/SliderRoot.tsx:316` | E | blurs the DOM, then writes |
| 23 | `tabs/root/TabsRoot.tsx:281` | E | the automatic fallback calls `onValueChange` (a public callback) |
| 24 | `utils/popups/usePopupHandleStore.ts:26` | E | subscription |
| 25 | `utils/resolveRenderedId.ts:56` | D | memo `element ? registered() : …` |
| 26 | `utils/store/SolidStoreV2.ts:93` | D | binding (foreign-store fallback path) |
| 27 | `utils/useAnchorPositioning.ts:620` | D | writable memo locking side and align |
| 28 | `utils/useAnchoredPopupScrollLock.ts:20` | E | layout read |
| 29 | `utils/usePopupViewport.tsx:162` | E | captures a DOM node |
| 30 | `utils/usePopupViewport.tsx:437` | D | counter memo keyed on trigger change |
| 31 | `avatar/image/AvatarImage.tsx:71` | E | MutationObserver |
| 32 | `combobox/group-label/ComboboxGroupLabel.tsx:22` | R | binding with cleanup (`useSyncedValueWithCleanup`) |
| 33 | `drawer/virtual-keyboard-provider/DrawerVirtualKeyboardProvider.tsx:176` | E | DOM, frames |
| 34 | `floating-ui-solid/components/FloatingFocusManager.tsx:417` | E | focus listeners |
| 35 | `floating-ui-solid/hooks/useDismiss.ts:946` | E | WeakMap registration |
| 36 | `floating-ui-solid/hooks/useHoverReferenceInteraction.ts:170` | E | event subscription |
| 37 | `menu/positioner/MenuPositioner.tsx:179` | E | event subscription |
| 38 | `navigation-menu/root/NavigationMenuRoot.tsx:267` | E | imperative `actionsRef` |
| 39 | `select/group-label/SelectGroupLabel.tsx:22` | R | binding with cleanup |
| 40 | `toast/root/ToastRoot.tsx:158` | D+E | swipe reset becomes a writable memo keyed on toast id; `recalculateHeight` stays an effect |
| 41 | `utils/store/SolidStoreV2.ts:139` | E | dev-only warning |

Totals:
- Among the 30 write-only sites: 16 D (53%), 13 E, 1 M. Among the 11 mixed: 0.5 D, 2 R, 8.5 E.
- Extrapolated to all 188: about 18–20 derivable sites (about 10%), plus 5 registration sites (the heuristic found `ComboboxGroupLabel:22`, `MenuGroupLabel:22`, `SelectGroupLabel:22`, `toast/utils/useToastLabelPart.ts:45`, `utils/useRegisteredLabelId.ts:13`). The other 114 write no signal at all.
- Conclusion: deriving instead of writing is a **correctness and latency** fix (it removes one flush of stale state) for about 20 sites, not a node-count lever. The node levers are §2a (context: −4 per provider), §2b (`createDepsEffect`: −1 at each of 107 sites), §2c (selection: O(n) to O(1) per change) and §2e (closed transitions: −3 per closed element).

## 4. Probe numbers (raw)

```
CONTEXT {"bare":{"nodes":4,"ms":7.33},"jsxProvider":{"nodes":9,"ms":17.3},"provideContext":{"nodes":9,"ms":9.9},"nativeOwner":{"nodes":5,"ms":7.91},"nativeOwner2ctx":{"nodes":5,"ms":10.3},"provideContext3":{"nodes":17,"ms":21.77},"nativeOwner3ctx":{"nodes":5,"ms":10.77},"oneRecordOwner":{"nodes":6,"ms":11.56}}
SELECTOR {"shim":{"nodes":1000,"computesPerChange":1000,"appliesPerChange":1000,"msPer50":13.33},"projection":{"nodes":1001,"computesPerChange":2,"appliesPerChange":2,"msPer50":1.66}}
HELPERS {"createEffect":1,"createDepsEffect":2,"memo+effect write (signal-writing effect)":1,"derived memo instead":1,"writable derived signal instead":1,"store 10 keys, 10 tracked direct reads":10,"store 10 keys, 10 render effects baseline (no store)":10,"store derived selector, 10 tracked readers":11,"useTransitionStatus closed":2,"useTransitionStatus open":3,"useOpenChangeComplete closed":1}
STOREWRITE {"storeMs":2.09,"plainSignalMs":0.05}
```

Command: `bun run test:solid:jsdom zz-probe-reactive --no-watch` from `packages/base-ui`. The probe file has been deleted.

A side finding for the warning census (plan leaf 1.9): rendering 1000 parts as children of one `<div>` made rc.15 dev emit **`[HUGE_FAN_IN] Computation "div.children" tracked 2000 sources`**. Large lists in the library and in the bench fixtures can trigger this dev warning, so the census should expect it and attribute it.

## 5. SSR and hydration risks

1. **Transparent owners on the server (blocker for §2a).** On the client, `createOwner({ transparent: true })` takes no id. `SolidStoreV2.ts:673` notes that server-derived signals *ignore* `transparent`. Whether the server's `createOwner` honors it is unverified. If it does not, a one-path `provide()` shifts server ids relative to the client. Verify with a test/ssr + hydration case (server HTML keys vs client claims) before migrating any provider.
2. **`provideContext`'s two paths.** Client: Provider plus keep-alive effect. Server and hydration: `<Provider>` JSX. That violates the target's one-path rule. Today hydration matches because both sides use JSX. Moving the client to `provide()` without moving server and hydration with it breaks hydration.
3. **Lazy creation must stay in `runInLazyScope`.** The lazy transition computeds (§2e) and the lazy `useOpenChangeComplete` must be created through `runInLazyScope` (own id namespace) or be `transparent`. Created directly under the owner, they steal the next sibling's id (the documented failure mode). `childrenLazy` (1 site) creates `children()` lazily without a scope, so audit it.
4. **Writable memos replacing effects (§3).** A `createSignal(fn)` takes an id and runs on the server, whereas a `createEffect` runs compute only there. Replacing an effect with a writable memo keeps the node count but changes server behavior: the derivation now runs on the server, which is correct for derived state. Check that each replaced derivation is safe to run on the server (no DOM reads; items 10, 25 and 27 read elements and resolve to `undefined` on the server).
5. **Projection selection under hydration.** `createProjection` is one computed (1 id) created at the list root. Create it unconditionally on both sides, not on first highlight, or use a lazy scope.
6. **The store write fast path (§2d)** must keep `isServer` recording semantics: server writes update `written` and never touch signals.
