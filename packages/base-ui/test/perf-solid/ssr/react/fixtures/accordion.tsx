import type * as React from 'react';
import { Accordion } from '@base-ui/react/accordion';
import { fixtures as basics } from '../../../react/fixtures/basics';
import { items, size } from '../../../shared/sizes';

const accItems = items(size(300));
/** Every item's value: the `-open` cases render all panels open. */
const allOpen = accItems.map((it) => it.value);

/** `accordion/300` with every item open. */
function AccordionOpen300() {
  return (
    <Accordion.Root multiple value={allOpen}>
      {accItems.map((it) => (
        <Accordion.Item key={it.value} value={it.value}>
          <Accordion.Header>
            <Accordion.Trigger>{it.label}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Content {it.label}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

export const fixtures: Record<string, React.FC> = {
  'accordion/300': basics['accordion/300'],
  // React has no floor of its own here: Solid's floor is measured against React's parts.
  'accordion/300-floor': basics['accordion/300'],
  'accordion/300-open': AccordionOpen300,
  'accordion/300-open-floor': AccordionOpen300,
};
