import { For } from 'solid-js';
import { Accordion } from '@solidports/base-ui/accordion';
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

/** Every item's value: the `-open` cases render all panels open. */
const allOpen = floorItems.map((it) => it.value);

/** `accordion/300` with every item open: the open panels' machinery and attributes. */
function AccordionOpen300() {
  return (
    <Accordion.Root multiple value={allOpen}>
      <For each={floorItems}>
        {(it) => (
          <Accordion.Item value={it.value}>
            <Accordion.Header>
              <Accordion.Trigger>{it.label}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Content {it.label}</Accordion.Panel>
          </Accordion.Item>
        )}
      </For>
    </Accordion.Root>
  );
}

/** `accordion/300-open` written as the hand-written Solid floor. */
function FloorAccordionOpen300() {
  return (
    <FloorAccordionRoot multiple value={allOpen}>
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
  'accordion/300-open': AccordionOpen300,
  'accordion/300-open-floor': FloorAccordionOpen300,
};
