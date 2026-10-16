import type * as React from 'react';
import { fixtures as basics } from '../../../react/fixtures/basics';

export const fixtures: Record<string, React.FC> = {
  'accordion/300': basics['accordion/300'],
  // React has no floor of its own here: Solid's floor is measured against React's parts.
  'accordion/300-floor': basics['accordion/300'],
};
