import type * as React from 'react';
import { fixtures as overlays } from '../../../react/fixtures/overlays';

export const fixtures: Record<string, React.FC> = {
  'popover/page': overlays['popover/roots'],
};
