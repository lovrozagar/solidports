---
tags: [toast, store, native, perf]
sources: [packages/base-ui/packages/solid/src/toast/action/ToastAction.parity.test.tsx, packages/base-ui/packages/solid/src/toast/arrow/ToastArrow.parity.test.tsx, packages/base-ui/packages/solid/src/toast, packages/base-ui/packages/solid/src/toast/store.ts, packages/base-ui/packages/solid/src/toast/root/ToastRoot.tsx, packages/base-ui/packages/solid/src/toast/createToastManager.ts, packages/base-ui/packages/solid/test/floor/toast.tsx]
verified: 2026-10-24
---

# Toast

Toast is fully ported and beats React on add, update and dismiss. A plain toast's Root, Content, Title, Description and Close render natively (D32): together they cost 43 dev nodes per toast against 104 on the slow path. Each toast's record carries its own index and offset, so a height write re-runs only the toasts whose offset moved.

## Status

- Test files: upstream 16, Solid 20. The extra files are `store.test.tsx` (`promiseToast` rejects with the original error and marks the toast as an error first), `toast.fanout.test.tsx`, `toast.cost.test.tsx` and `toast.parity.test.tsx`.
- The test-parity script reports no missing upstream titles and no Toast exclusions.

## Parts

All under `packages/base-ui/packages/solid/src/toast/`.

| Part | File |
| :--- | :--- |
| Provider | `provider/ToastProvider.tsx` |
| Viewport | `viewport/ToastViewport.tsx` |
| Root | `root/ToastRoot.tsx` |
| Content, Title, Description, Action, Close | `content/`, `title/`, `description/`, `action/`, `close/` |
| Portal, Positioner, Arrow (anchored toasts) | `portal/`, `positioner/`, `arrow/` |
| Store, manager, hook | `store.ts`, `createToastManager.ts`, `useToastManager.ts` |

## Native fast path

With plain props (`canRenderNative`, on the client, the server and while hydrating), these parts render through the native kit (D32):

- Root (`root/ToastRoot.tsx`): its attributes from one module-level writer, its style as the kit's `partStyle`, and its swipe and Escape handlers as module-level `partHandler`s over one model object. The swipe logic, the lifecycle effect and the context stay shared with the slow path.
- Content (`content/ToastContent.tsx`): a `<div>` with its `data-behind` and `data-expanded` attributes.
- Title and Description (`utils/useToastLabelPart.ts`, `renderNativeToastLabel`): rendered only while their content is renderable, under a `Show` that is their condition's only memo. They register their id with one effect, and a static `id` costs no memo.
- Close (`close/ToastClose.tsx`): a `<button>` with `aria-hidden` while the stack is collapsed and the button unfocused. A Close that may be disabled keeps `useButton` on the slow path.
- Arrow (`arrow/ToastArrow.tsx`, on the client): a `<div aria-hidden>` with its positioner's side, align and `uncentered` state, the positioner's arrow styles as the kit's `partStyle` (below the consumer's style, as the slow path's merge puts them), and a part ref that hands the element to the positioner's arrow middleware. 2 dev nodes against 14 on the slow path (`toast.cost.test.tsx`; `arrow/ToastArrow.parity.test.tsx`).
- Action (`action/ToastAction.tsx`, on the client): a `<button type="button" tabindex="0">` with `useButton`'s native-button gates inlined over one model, rendered only while its content (`actionProps.children`, else its own) is renderable, built once (GOTCHA-020). The toast's `actionProps` win over the consumer's props, as the slow path's merge puts them: their attributes through the kit's `attributeOverrides`, their `class` after the consumer's (`partClass`) and their `style` below the consumer's (`partStyle`). The button's five handler keys run the gate, then the `actionProps` handler, then the consumer's unless the former called `preventBaseUIHandler()`. A `toast().update()` that changes `actionProps` on a live toast re-writes only what changed. 9 dev nodes against 20 on the slow path (`toast.cost.test.tsx`; `action/ToastAction.parity.test.tsx`). Any `render` or `nativeButton={false}` takes the slow path.
- Known divergence: an `actionProps` handler for a key outside the button's five (`onClick`, `onPointerDown`, `onMouseDown`, `onKeyDown`, `onKeyUp`) is written as the element's own listener, so it runs after the consumer's handler for that key instead of before. Upstream types `actionProps` as `ComponentPropsWithoutRef<'button'>`; its docs and tests pass `children`, `id`, `onClick` and `onKeyDown` only.

## Reactive cost

`toast.fanout.test.tsx` holds a toast's offset readers to that toast's metadata at 5 and 40 toasts. It also checks that a height write moves only the offsets below the toast, and that two providers on one page keep their toasts apart.

`toast.cost.test.tsx` measures each part against the hand-written floor (`test/floor/toast.tsx`, which renders the same DOM). Dev nodes per toast:

| Part | Slow path | Native | Floor |
| :--- | ---: | ---: | ---: |
| Root | 32 | 15 | 12 |
| Content | 12 | 3 | 3 |
| Title | 24 | 11 | 9 |
| Description | 24 | 11 | 9 |
| Close | 12 | 3 | 4 |

`toast.parity.test.tsx` renders a toast list through both paths and compares the documents after adding, updating, focusing a close button, expanding, going over the limit and closing.

Chromium heap the bench step keeps (`toast/50`, production builds, a heap snapshot after a full collection):

| Step | React | Solid before D32 | Solid, native parts |
| :--- | ---: | ---: | ---: |
| add 50 | 2,233 KB | 3,821 KB | 1,923 KB |
| update 50 | 781 KB | 148 KB | 116 KB |


## Benchmarks

CI run 38882393542, commit b9b813c9, Solid rc.15. Sync time in ms, `toast/50`.

| Step | React | Solid | Ratio |
| :--- | ---: | ---: | ---: |
| mount | 0.7 | 1.0 | 1.43x |
| add 50 | 155.1 | 84.2 | 0.54x |
| update 50 | 123.9 | 16.9 | 0.14x |
| dismiss 50 | 71.3 | 23.4 | 0.33x |
| add/dismiss interleaved x100 | 109.2 | 92.3 | 0.85x |
| promise x20 | 13.9 | 9.0 | 0.65x |
| dismiss all | 1.1 | 1.6 | 1.45x |

## Hot spots

- Height writes: `root/ToastRoot.tsx:178` measures a toast and calls `store.updateToastInternal` with its height. `store.ts:385` maps the list and `setToasts` (`store.ts:628`) reconciles it into the records. `placeToasts` (`store.ts:174`) then writes each record's index, visible index and offset (`ToastRecord`, `store.ts:115`), and only for the records whose values changed. The selectors find the records through the store's state (`metadataOf`), so no reader subscribes to a shared key. React rebuilds a `toastMetadata` Map on every write, and every toast's selectors re-run. Before D32's Toast unit the port did the same: 80 offset subscribers at 40 toasts, against 2 now.
- A field update with the same list and order writes no store key; it writes the record and its metadata only.

See the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Records keep a stable identity per id (`store.ts:115`, `:208`): lists key by reference with `<For>`, while React keys by `id`. Field updates mutate the record in place, so `updateToastInternal` snapshots the previous values first (`store.ts:396`). A record keeps its metadata, `undefined` once the toast leaves the list.
- `setToasts` skips no-op updates (`store.ts:630`) so reference-keyed lists do not remount.
- Selector arguments are accessors (`store.ts:79`), so each selector subscribes to the id it reads.
- Timers are created ownerless (`store.ts:198`) so an owning effect re-run never clears them.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/toast/page.mdx`
