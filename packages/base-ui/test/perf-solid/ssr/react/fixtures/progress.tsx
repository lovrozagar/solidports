import type * as React from 'react';
import { fixtures as statics } from '../../../react/fixtures/static';

export const fixtures: Record<string, React.FC> = {
  'progress/1000': statics['static/progress-meter'],
};
