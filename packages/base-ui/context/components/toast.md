---
tags: [toast, store, perf]
sources: [packages/base-ui/packages/solid/src/toast, packages/base-ui/packages/solid/src/toast/store.ts, packages/base-ui/packages/solid/src/toast/root/ToastRoot.tsx, packages/base-ui/packages/solid/src/toast/createToastManager.ts]
verified: 2026-10-22
---

# Toast

Toast is fully ported and beats React on add, update and dismiss. Each toast's record carries its own index and offset, so a height write re-runs only the toasts whose offset moved. It has no native fast path and no cost test.

## Status

- Test files: upstream 14, Solid 15. The extra file is `store.test.tsx` (`promiseToast` rejects with the original error and marks the toast as an error first).
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

No. No Toast file imports `utils/native`.

## Reactive cost

`toast.fanout.test.tsx` holds a toast's offset readers to that toast's metadata at 5 and 40 toasts. It also checks that a height write moves only the offsets below the toast, and that two providers on one page keep their toasts apart. A toast with Content, Title, Description and Close adds 103 dev nodes (32 for a bare Root). No cost test or floor covers Toast yet.

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

- Height writes: `root/ToastRoot.tsx:111` measures a toast and calls `store.updateToastInternal` with its height. `store.ts:367` maps the list and `setToasts` (`store.ts:610`) reconciles it into the records. `placeToasts` (`store.ts:156`) then writes each record's index, visible index and offset (`createToastRecord`, `store.ts:100`), and only for the records whose values changed. The selectors find the records through the store's state (`metadataOf`), so no reader subscribes to a shared key. React rebuilds a `toastMetadata` Map on every write, and every toast's selectors re-run. Before D32's Toast unit the port did the same: 80 offset subscribers at 40 toasts, against 2 now.
- A field update with the same list and order writes no store key; it writes the record and its metadata only.

See the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Records keep a stable identity per id (`store.ts:100`, `:190`): lists key by reference with `<For>`, while React keys by `id`. Field updates mutate the record in place, so `updateToastInternal` snapshots the previous values first (`store.ts:378`). A record keeps its metadata, `undefined` once the toast leaves the list.
- `setToasts` skips no-op updates (`store.ts:612`) so reference-keyed lists do not remount.
- Selector arguments are accessors (`store.ts:79`), so each selector subscribes to the id it reads.
- Timers are created ownerless (`store.ts:180`) so an owning effect re-run never clears them.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/toast/page.mdx`
