---
tags: [perf, audit, composite, floating, lists]
sources: [packages/base-ui/packages/solid/src/internals/composite, packages/base-ui/packages/solid/src/utils/native/listItem.ts, packages/base-ui/packages/solid/src/floating-ui-solid, packages/base-ui/packages/solid/src/utils/popups/useInteractionIntent.ts]
verified: 2026-10-16
---

# Audit: composite lists and floating (plan 3, leaves 2.1–2.3)

Scope: `internals/composite/**`, `utils/native/listItem.ts`, `floating-ui-solid/**`, `utils/popups/useInteractionIntent.ts`. Paths are under `packages/base-ui/packages/solid/src/`. Solid 2.0.0-rc.15 is installed for both `solid-js` and `@solidjs/signals`, checked with `require(...).version`. Line numbers are from HEAD (04cdb214 tree).

## 1. Cost model today

### Registration (`CompositeList`)

- Every flush rebuilds the whole snapshot.
  - `flush` at `internals/composite/list/CompositeList.tsx:168` calls `getCompositeListSnapshot` (`:239`). That walks the full map, sorts every automatic item by document position (`:273`), and re-sorts by index whenever any item is reserved (`:285`).
  - `syncRefs` (`:85`) then empties and refills `elements` and `labels`, and builds a new `Map` with a spread copy of each item's metadata (`:96`). Labels read `textContent` per item (`:107`).
  - So one flush costs O(n log n) plus n allocations plus n DOM reads, regardless of how many items changed.
- Batches multiply that cost. `scheduleMapUpdate` (`:44`) coalesces registrations within one flush only, so items that mount over k separate flushes cost k full rebuilds (O(k · n log n)). Lazy items, a combobox clear back to the full list, and "replace items while open" all hit this.
- Every change fans out to every listener. `flush` calls each listener (`:194`) and each item does a `map.get` (`useCompositeListItem.ts:140`, `listItem.ts:65`), so a single insertion costs n listener calls plus n `setIndex` writes for the items after the insertion point.
- Per slow item (`useCompositeListItem.ts`): one index signal (`:48`), one registration effect comparing four fields (`:105`), one layout effect for the subscription (`:135`), and the subscription. That is 2 computations plus the dev component root.
- Per native item (`utils/native/listItem.ts`): one signal, the subscription, and one effect only when the metadata is reactive (`:57`). This is the shape to keep.

### Highlight fan-out

- In the composite roots, `useCompositeItem.ts:15` derives `isHighlighted = highlightedIndex() === index()`, and the `tabindex` getter at `:32` reads it. The native copies (`tabs/tab/TabsTab.tsx:338`, `RadioRoot.tsx:519`) repeat the same predicate. Every item binding re-evaluates on each highlight move.
- In Select, `select/store.ts:80` has `isActive: (state, index) => state.activeIndex === index()`. Each `SelectItem` reads it through `store.useState('isActive', listItem.index)` (`select/item/SelectItem.tsx:63`). That creates one transparent memo per item (`utils/store/SolidStoreV2.ts:202`) on a store slot signal with `equals: false` (`:462`).
- The probe confirms the fan-out: one highlight move in a 100-item open Select runs the `isActive` selector 102 times (section 4). The memo equality stops the downstream rerun, so only about 2 bindings change, but the n memo recomputations are unavoidable with the predicate shape. Menu (`menu/item/MenuItem.tsx:53`) and Combobox have the same shape.
- `useListNavigation.ts:651` (`props.listRef.indexOf(event.currentTarget)`) is O(n) per item focus or mousemove.

### `getItemProps` merge churn (`floating-ui-solid/hooks/useInteractions.ts`)

- `lists` (`:36`) is a single memo with no equality, and it reads every hook's `reference`/`floating`/`item`/`trigger` getter. Any change rebuilds all four arrays.
- Each `getItemProps()` returns `merge(() => mergeProps([...lists().item, …]))` (`:66`, `:77`). A function-source `merge` allocates a memo per view (primitive costs: 209 ns, one node). So each item holds one memo that depends on `lists()`.
- The trigger: Select passes its four hooks through `deferred(key)` getters (`select/root/SelectRoot.tsx:557`), so `lists()` tracks `interactions()` and every hook's gated getters. Typeahead's `enabled` (`SelectRoot.tsx:523`: `!disabled() && (open() || (!readOnly() && !multiple()))`) flips with `open()` for multiple or read-only selects. Its `reference`/`floating` getters then flip, `lists()` re-runs, and all n item views re-merge, even though `lists().item` (list navigation's static `item` object, `useListNavigation.ts:658`) did not change.
- The first activation of the deferred interactions also re-runs every view once.

### Store selector duplication (floating root)

- There are 18 `createMemo(() => store().select(...))` nodes in the hooks:
  - `useRole.ts:40-43` (4)
  - `useDismiss.ts:190-193` (4)
  - `useListNavigation.ts:257-259` (3)
  - `useClientPoint.ts:111-113` (3)
  - `FloatingFocusManager.tsx:281-283` (3)
  - `useTypeahead.ts:85` (1)

  Plus `menu/trigger/MenuTrigger.tsx:86`, `:139` and `dialog/trigger/DialogTrigger.tsx:50`, `:94`.
- In the floating root store (`floating-ui-solid/components/FloatingRootStoreV2.ts:38-46`), `open` and `floatingId` are direct-key selectors, so a memo over them only mirrors an already change-notifying slot signal. That is pure overhead: one owned node and one hydration id each. The element selectors (`floatingElement`, `domReferenceElement`, `referenceElement`) are derived, returning `null` while `elementsMounted` is false, so they do need one memo, but only one per root, not one per hook. An open Select or Combobox carries about 14 of these memos, 6 for `open` alone.
- The memo does give one thing: isolation when `store()` swaps, which only happens for NavigationMenu (`navigation-menu/root/NavigationMenuRoot.tsx:116`).

### Effect sync into the root store

`useFloatingRootContext.ts:73-99` writes `referenceElement`, `domReferenceElement` and `floatingElement` from a `createEffect` that also reads `props.open`. The cost per open/close is one effect plus a store write and its observers re-running a flush later. Readers can see the new `open` with stale elements for one flush, which the comment at `:65` works around for `open` and `floatingId` only.

### Closed-root deferral (`utils/popups/useInteractionIntent.ts`)

This is sound. One capture listener per event type and document (`listenForIntent`), and `useDeferredInteractions` (`:74`) creates hooks on first intent. Two costs remain:
- Each root still allocates its signal and one layout effect (`:90`), plus another layout effect per trigger (`:118`) or (`:134`).
- `activateOnIntent` calls `flush()` synchronously when it runs ownerless (`:100`).

## 2. Optimal Solid 2 shape

### Registration: incremental, DOM ordered

```ts
// One list record; items get a stable slot object, not a Map copy per flush.
interface ListSlot<M> { el: Element; meta: M; index: number /* plain */; setIndex(i: number): void }

function createListRegistry<M>(opts: { onChange?(slots: readonly ListSlot<M>[]): void }) {
  const slots: ListSlot<M>[] = [];          // kept in DOM order
  let dirtyFrom = Infinity;                  // lowest index whose position changed
  function insert(slot: ListSlot<M>) {
    // Guess from creation order (append), verify against neighbours; only on a miss
    // binary-search with compareDocumentPosition. O(1) append, O(log n) otherwise.
    const at = locate(slots, slot.el);       // fast path: at === slots.length
    slots.splice(at, 0, slot);
    dirtyFrom = Math.min(dirtyFrom, at);
    schedule();
  }
  function remove(slot) { const at = slots.indexOf(slot); slots.splice(at, 1); dirtyFrom = Math.min(dirtyFrom, at); schedule(); }
  function commit() {                        // one queued pass per batch
    for (let i = dirtyFrom; i < slots.length; i++) if (slots[i].index !== i) slots[i].setIndex(i);
    elements.length = slots.length; for (let i = dirtyFrom; i < slots.length; i++) elements[i] = slots[i].el;
    dirtyFrom = Infinity; opts.onChange?.(slots);
  }
}
```

- Cost per batch: O(changed suffix) index writes plus O(log n) per misplaced insert. An append-only open of 1000 items does 1000 O(1) inserts and one pass with zero corrections, because the guessed indexes are already right.
- Labels are read lazily (`labelAt(i)`) by typeahead on its first keystroke, not on every flush.
- Reserved indexes (Slider thumbs, OTP slots) stay a separate dense array, without the second full sort.
- The `MutationObserver` reorder check stays, scoped to the parents the list already observes.
- Native items already match the slot shape: `index` becomes the slot's signal, and `subscribeMapChange` and its per-item listener go away (the registry calls `setIndex` directly).

### Keyed highlight and selection

```ts
// One projection per list: readers subscribe to their own key; a move touches 2 keys.
const highlighted = createProjection<Record<number, true>>((draft) => {
  const next = activeIndex();
  for (const k in draft) if (+k !== next) delete draft[k];
  if (next != null && next >= 0) draft[next] = true;
}, {});
const isHighlighted = (i: number) => highlighted[i] === true;   // item binding reads this
```

- The same primitive covers `isSelected` (keyed by value string for single select, a set for multiple), `isSelectedByFocus`, Tabs' and Radio's roving `tabindex`, and Accordion's `isOpen` (keyed by item value; see section 3).
- Put it on the store as a keyed selector kind, for example `store.useKeyed('activeIndex')`, so `SelectItem` and `MenuItem` change one line each.
- Drop `solid-1-compat.ts:143` (`createSelector`, no call sites).

### One delegated handler per list

- List navigation's `item` handlers (`useListNavigation.ts:658`: `onFocus`, `onClick`, `onMouseMove`, `onPointerLeave`) are identical for every item. Move them to the list container:
  - one `focusin`/`click`/`mousemove`/`pointerleave` listener (with `pointerout` plus `relatedTarget` for leave);
  - each event resolves the item with `event.target.closest('[data-composite-item]')` and its index through a `WeakMap<Element, ListSlot>` from the registry, which replaces `listRef.indexOf`.
- `getItemProps` then returns only per-item static props, and `useInteractions` no longer builds item views. Each item drops its `merge` memo, and an `enabled` flip cannot fan out.
- `useInteractions` itself: keep separate memos per list kind (`reference`, `floating`, `trigger`), each with shallow array equality, so a typeahead flip re-merges only the two views that contain typeahead.

### One shared selector set per popup

```ts
// Built once per FloatingRootStore, lazily, as plain accessors on the store's slot signals.
interface RootReads { open(): boolean; floating(): HTMLElement | null; domReference(): Element | null; reference(): ReferenceType | null; floatingId(): string | undefined }
store.reads ??= { open: store.useState('open'), floating: store.useState('floatingElement'), … };
```

- Hooks read `store().reads.open()`. Direct-key `useState` accessors create no node (`SolidStoreV2.ts:186`), so `open` and `floatingId` cost 0. Each derived element read is one lazy transparent memo per root (`:202`), shared by every hook. The 18 per-hook memos become at most 3 per popup.
- For NavigationMenu's swapping store, one memo of `store()` per hook keeps the swap isolation, instead of one memo per key.

### Derive, don't sync

- `useFloatingRootContext` binds `referenceElement`, `domReferenceElement` and `floatingElement` with `store.useSyncedValue(key, () => props.elements?.x ?? store.peek(key))`, the same mechanism already used for `open` and `floatingId` (`:67-68`), and drops the effect at `:73`.
- `onOpenChange` and `nested` become context getters, not effect writes. The elements then update in the same flush as `open`, with no stale read.
- React's "rewrite on every render", which drops elements set elsewhere, becomes "the binding wins until something sets the key", which is the writable-memo semantics `useSyncedValue` already has. Check it against the existing hook tests in `test/floating-ui-tests`.

## 3. What Accordion needs from this layer

- Accordion uses `CompositeList` only to give each item an index (`accordion/root/AccordionRoot.tsx:48`, `:83`; `accordion/item/AccordionItem.tsx:37` native, `:61` slow). The index feeds `state.index`. There is no highlight state, and no `getItemProps` or floating code.
- So the pilot needs exactly the registry slot API from section 2: `createListSlot(meta, { guessIndex })` returning `{ ref, index }`. Keep the native `createNativeListItem` signature and contract (automatic index, no label, same registration order as slow items), so a slow item and a native item can still share a list during the migration. Mixed lists are what keep the pilot from forcing a big-bang rewrite of Tabs, Radio and Toggle.
- Accordion needs one more thing: `isOpen` (`accordion/item/AccordionItem.tsx:94`) is `openValues().indexOf(value())` per item, the same predicate fan-out (an O(n) array scan per item, O(n·k) per toggle and O(n²) for toggle-all). Build the pilot's open-state read on the keyed projection from section 2, keyed by item value, so the lists phase reuses the same primitive rather than inventing a second one.
- Things the pilot must not do:
  - Hard-code Accordion's list as a private array. Make the registry a shared `internals/composite/list` export that the existing `CompositeList` delegates to.
  - Put index state in context per item. One registry record per root is the target.
- Hydration: the registry must create no id-consuming node per item (see section 5). The pilot is the first place this gets proven, via `test/hydration` and `CompositeList.ssr-fixtures.tsx`.

## 4. Cost probe (temporary test, deleted after the run)

File: `src/select/zz-probe-lists.cost.test.tsx`. It used the dev `DEV.hooks.onOwner` node count from `useRenderElement.cost.test.tsx`, a counting wrapper around the exported `selectors` in `select/store.ts`, and two standalone 100-reader prototypes. Run with `bun run test:solid:jsdom zz-probe-lists --no-watch` from `packages/base-ui`. 4 of 4 tests passed. The file was deleted afterwards.

| measurement | today | keyed prototype |
| --- | --- | --- |
| Open Select, 1 item: total reactive nodes | 440 | n/a |
| Open Select, 101 items: total reactive nodes | 3140 | n/a |
| Nodes per open `Select.Item` | **27** | n/a |
| `isActive` selector runs per highlight move (100 items, mouse hover moves) | **102** | n/a |
| `isSelectedByFocus` / `isSelected` runs per move | 0 / 0 | n/a |
| 100 render-effect readers: compute reruns per change, predicate vs `createProjection` | **100** | **2** |
| same: apply runs per change (effects are not equality-gated) | **100** | **2** |

How to read it: in Select the per-item `isActive` memo holds downstream bindings to about 2 per move, but the n memo recomputations remain (102 = 100 items + 2 extra reads). A keyed projection makes both the recomputations and the bindings O(1) per move, and it also drops one transparent memo per item that reads highlight. A hand-written item would need about 3–5 nodes (insert, grouped binding, index signal), against 27 today. The remaining nodes come from `useRenderElement`'s slow path (render-core work, outside this area) plus the per-item `getItemProps` merge memo and the `useCompositeListItem` effect and layout effect.

Not measured, and cited from code instead: registration rebuild cost per batch (O(k · n log n)) and the `getItemProps` re-merge on a typeahead `enabled` flip (n view memos). Measure both in 3.1 with `bench:component select` once a scenario toggles open on a multiple select.

## 5. SSR and hydration risks

- `createProjection` takes an owner and an id: the server build calls `createOwner()` and `ownerId(owner)` and keeps a per-id slot (seen in the server `createProjection`). One projection per list root is fine if both sides create it unconditionally, in the same order and at the same place. Never create it lazily on the first client read, the way `useState` creates its memo, or the ids shift.
- Removing the 18 floating memos shifts hydration ids for everything created after them in those owners. That is safe only if it lands on the client and the server together. The floating hooks mostly run client-only (deferred, `runInLazyScope` skips the server), so verify each removed memo's owner actually exists on the server before assuming a shift.
- Registry writes: refs never run on the server, so the server has no registration. Today, indexes on the server come from the `nextIndexRef` guess. The new registry must keep that server guess identical (creation order), or `state.index` and `data-index` attributes will mismatch at hydration.
- Delegated list handlers: attaching listeners on the list container must not add elements, `scope()` inserts or owners on either side. Bind them with `addEventListener` in a transparent ref callback, never with a component.
- `useSyncedValue` bindings for the elements are writable memos, which take ids unless they are transparent. Check `SolidStoreV2` bindings' `transparent` flag before replacing the effect at `useFloatingRootContext.ts:73`. An effect that becomes a non-transparent memo on the server would add an id there.
- Test gates: `test/hydration`, `*.hydration.test.tsx`, `CompositeList.ssr-fixtures.tsx`, `test/ssr`, and the docs hydration crawl. Every step in this area changes the node count per item, so run them on every commit that touches the registry or the store.

Process note: the section 4 probe ran in the main tree (`src/select/zz-probe-lists.cost.test.tsx`), before the coordinator's worktree rule reached this fork. The probe was deleted right after its run, and `git status packages/` is clean. Rerun it from a worktree if the numbers need confirming.
