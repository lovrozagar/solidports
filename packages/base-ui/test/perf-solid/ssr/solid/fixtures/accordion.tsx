import { For } from 'solid-js';
import { fixtures as basics } from '../../../solid/fixtures/basics';
import { useExposed } from '../../../solid/exposed';
import { items, size } from '../../../shared/sizes';
import {
  FloorAccordionHeader,
  FloorAccordionItem,
  FloorAccordionPanel,
  FloorAccordionRoot,
  FloorAccordionTrigger,
} from '../../../../../packages/solid/test/floor/accordion';

const floorItems = items(size(300));

/** `accordion/300` written as the hand-written Solid floor (`packages/solid/test/floor`). */
function FloorAccordion300() {
  const value = useExposed('value', [] as string[]);
  return (
    <FloorAccordionRoot multiple value={value()}>
      <For each={floorItems}>
        {(it) => (
          <FloorAccordionItem value={it.value}>
            <FloorAccordionHeader>
              <FloorAccordionTrigger>{it.label}</FloorAccordionTrigger>
            </FloorAccordionHeader>
            <FloorAccordionPanel>Content {it.label}</FloorAccordionPanel>
          </FloorAccordionItem>
        )}
      </For>
    </FloorAccordionRoot>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'accordion/300': basics['accordion/300'],
  'accordion/300-floor': FloorAccordion300,
};
