import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import type { Side } from '../../utils/useAnchorPositioning';
import { fieldValidityMapping } from '../../field/utils/constants';

export const triggerStateAttributesMapping = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  listEmpty: (empty: boolean) => (empty ? { 'data-list-empty': '' } : null),
  popupSide: (side: Side | null) => (side ? { 'data-popup-side': side } : null),
} satisfies StateAttributesMapping<{
  open: boolean;
  valid: boolean | null;
  popupSide: Side | null;
  listEmpty: boolean;
  placeholder: boolean;
}>;
