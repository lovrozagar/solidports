import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { compileStateWriter } from '../../utils/native/element';
import type { ProgressRoot } from './ProgressRoot';
import * as ProgressRootDataAttributes from './ProgressRootDataAttributes';

export const progressStateAttributesMapping: StateAttributesMapping<ProgressRoot.State> = {
  status(value): Record<string, string> | null {
    if (value === 'progressing') {
      return { [ProgressRootDataAttributes.progressing]: '' };
    }
    if (value === 'complete') {
      return { [ProgressRootDataAttributes.complete]: '' };
    }
    if (value === 'indeterminate') {
      return { [ProgressRootDataAttributes.indeterminate]: '' };
    }
    return null;
  },
};

/** Progress's state attributes (`status`), compiled once. */
export const writeProgressState = compileStateWriter(['status'], progressStateAttributesMapping);
