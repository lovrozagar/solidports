---
tags: [dialog, alert-dialog, drawer, popup, floating, perf]
sources: [packages/base-ui/packages/solid/src/dialog, packages/base-ui/packages/solid/src/alert-dialog, packages/base-ui/packages/solid/src/drawer/trigger, packages/base-ui/packages/solid/test/floor/dialog.tsx, packages/base-ui/packages/solid/src/utils/popups/closedRoot.cost.test.tsx, packages/base-ui/packages/solid/src/utils/popups/useInteractionIntent.ts]
verified: 2026-10-22
---

# Dialog

Dialog, AlertDialog and Drawer are fully ported and share one trigger; a plain `Dialog.Trigger` renders natively (D32) and builds its click interaction on the first intent, so a closed trigger costs 14 dev nodes against the slow trigger's 27 and the closed-root budgets drop to 40 (Dialog, AlertDialog) and 59 (Drawer).

## Parts

`AlertDialog.Trigger` and `Drawer.Trigger` are `Dialog.Trigger` (`alert-dialog/trigger/AlertDialogTrigger.tsx`, `drawer/trigger/DrawerTrigger.tsx`). The roots share `dialog/root/useRenderDialogRoot.tsx` and `DialogInteractions` (`dialog/root/useDialogRoot.ts`).

## Native fast path

`Dialog.Trigger` without a detached `handle`, on a native button, renders through `renderNativeElement` (`trigger/DialogTrigger.tsx`, `NativeDialogTriggerModel`); every other part renders through `useRenderElement` (see [render pipeline](../architecture/render-pipeline.md)).

- The `<button type="button">` is created once with its literal attributes; `id`, `aria-expanded`, `aria-controls`, `disabled` and `data-popup-open` are one grouped binding, and the state writer writes `data-disabled`.
- Handlers are module-level `partHandler`s: `useButton`'s disabled gates, the consumer's handler, then the sources in `mergeProps` order: the open-method props, the root's trigger props (dismissal), then click.
- `useClick` is created by `useTriggerInteractions` on the trigger's first intent, or once this trigger opens or mounts the dialog, and is kept afterwards. The intent listeners sit on the trigger's root, so a trigger in a closed shadow root sees its first press (cef99aee; the nested-dialog shadow-root tests in `root/DialogRoot.test.tsx` failed while they sat on the document).
- `trigger/DialogTrigger.test.tsx` "opens a second dialog on the page after the first opened and closed" guards the first press on a second root; `utils/native/popupParts.parity.test.tsx` compares the trigger closed, disabled and open with the slow path.

## Reactive cost

| Measure | Nodes |
| :--- | ---: |
| Closed `Dialog.Trigger`, `dialog.cost.test.tsx` (floor `test/floor/dialog.tsx`: 5) | 14 (slow path: 27) |
| Closed-root budget, `closedRoot.cost.test.tsx`: Dialog, AlertDialog | 40 (before: 94, then 63, 54, 53) |
| Closed-root budget, `closedRoot.cost.test.tsx`: Drawer | 59 (before: 125, then 88, 73, 72) |
| Closed `Dialog.Root` alone, `closedRoot.cost.test.tsx` (floor root: 9) | 21 (before: 31, then 22) |

## Benchmarks

Local Chromium heap diff (`dialog/roots-200` mount, objects kept, 2026-10-22): React 4,717 KB; Solid before the native trigger 7,888 KB, after 5,825 KB (237k to 181k objects).
