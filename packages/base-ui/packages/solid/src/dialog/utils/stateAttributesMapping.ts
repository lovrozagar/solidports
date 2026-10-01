import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { DialogPopupDataAttributes } from '../popup/DialogPopupDataAttributes';

/**
 * Shared by `Dialog.Popup` and `Dialog.Viewport`, whose states have the same shape.
 * `nested` is not mapped: unmapped `true` booleans already render as `data-nested`.
 */
export const dialogStateAttributesMapping: StateAttributesMapping<{
  open: boolean;
  transitionStatus: TransitionStatus;
  nested: boolean;
  nestedDialogOpen: boolean;
}> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
  nestedDialogOpen(value) {
    return value ? { [DialogPopupDataAttributes.nestedDialogOpen]: '' } : null;
  },
};
