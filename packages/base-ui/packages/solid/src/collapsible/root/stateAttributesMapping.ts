import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { collapsibleOpenStateMapping as baseMapping } from '../../utils/collapsibleOpenStateMapping';
import type { CollapsibleRoot } from './CollapsibleRoot';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { compileStateWriter } from '../../utils/native/element';

export const collapsibleStateAttributesMapping: StateAttributesMapping<CollapsibleRoot.State> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/** Collapsible's state attributes (`open`, `disabled`, `transitionStatus`), compiled once. */
export const writeCollapsibleState = compileStateWriter(
  ['open', 'disabled', 'transitionStatus'],
  collapsibleStateAttributesMapping,
);
