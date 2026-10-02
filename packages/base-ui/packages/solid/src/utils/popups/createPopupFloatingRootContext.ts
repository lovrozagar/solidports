import { FloatingRootStore } from '../../floating-ui-solid/components/FloatingRootStoreV2';
import type { PopupTriggerMap } from './popupTriggerMap';

/**
 * Creates the floating root a popup store owns for its whole lifetime, as React's
 * `createInitialPopupStoreState`. Triggers (including detached, handle-based ones that mount before
 * the Root) and the Root share it; the Root keeps it in sync with `useSyncedFloatingRootContext`.
 */
export function createPopupFloatingRootContext(
  triggerElements: PopupTriggerMap,
  floatingId?: string | undefined,
  nested = false,
) {
  return FloatingRootStore({
    floatingElement: null,
    floatingId,
    nested,
    onOpenChange: undefined,
    open: false,
    referenceElement: null,
    transitionStatus: undefined,
    // The popup store owns the open-change dispatch (`applyPopupOpenChange`).
    syncOnly: true,
    triggerElements,
  });
}
