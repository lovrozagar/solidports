import type * as React from 'react';
import { fixtures as toggles } from '../../../react/fixtures/toggles';

export const fixtures: Record<string, React.FC> = {
  'collapsible/300': toggles['collapsible/300'] as React.FC,
  // React has no floor of its own here: Solid's floor is measured against React's parts.
  'collapsible/300-floor': toggles['collapsible/300'] as React.FC,
};
