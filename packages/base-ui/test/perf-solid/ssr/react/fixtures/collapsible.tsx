import type * as React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { fixtures as toggles } from '../../../react/fixtures/toggles';
import { size } from '../../../shared/sizes';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** `collapsible/300` with every root open. */
function CollapsiblesOpen() {
  return (
    <div>
      {range(size(300)).map((i) => (
        <Collapsible.Root key={i} open>
          <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
          <Collapsible.Panel>Panel {i}</Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </div>
  );
}

export const fixtures: Record<string, React.FC> = {
  'collapsible/300': toggles['collapsible/300'] as React.FC,
  // React has no floor of its own here: Solid's floor is measured against React's parts.
  'collapsible/300-floor': toggles['collapsible/300'] as React.FC,
  'collapsible/300-open': CollapsiblesOpen,
  'collapsible/300-open-floor': CollapsiblesOpen,
};
