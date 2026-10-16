---
tags: [toast, store, perf]
sources: [packages/base-ui/packages/solid/src/toast, packages/base-ui/packages/solid/src/toast/store.ts, packages/base-ui/packages/solid/src/toast/root/ToastRoot.tsx, packages/base-ui/packages/solid/src/toast/createToastManager.ts]
verified: 2026-10-16
---

# Toast

Toast is fully ported and beats React on add, update and dismiss, but every height write rebuilds the whole metadata Map, which is O(n²) as toasts measure. It has no native fast path and no cost test.

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

No node probe and no cost test cover Toast.

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

- Height writes: `root/ToastRoot.tsx:111` measures a toast and calls `store.updateToastInternal` with its height. `store.ts:332` maps the whole list, and `setToasts` (`store.ts:575`) calls `createToastMetadata` (`store.ts:49`) at `:595`, rebuilding every toast's index and offset. One write is O(n); n toasts measuring is O(n²). Per-toast height signals with derived offsets would make it O(n) overall.
- `store.ts:236` rebuilds the metadata again when `limit` changes.

See the [optimization map](../perf/optimization-map.md).

## Known issues and divergences

- Records keep a stable identity per id (`store.ts:105`, `:151`): lists key by reference with `<For>`, while React keys by `id`. Field updates mutate the record in place, so `updateToastInternal` snapshots the previous values first (`store.ts:343`).
- `setToasts` skips no-op updates (`store.ts:577`) so reference-keyed lists do not remount.
- Selector arguments are accessors (`store.ts:89`), so each selector subscribes to the id it reads.
- Timers are created ownerless (`store.ts:141`) so an owning effect re-run never clears them.

## Docs

`packages/base-ui/docs/solid/src/app/(docs)/solid/components/toast/page.mdx`
