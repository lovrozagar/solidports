import { For } from 'solid-js';
import { renderToString } from '@solidjs/web';
import { Accordion } from '@solidports/base-ui/accordion';
import {
  FloorAccordionHeader,
  FloorAccordionItem,
  FloorAccordionPanel,
  FloorAccordionRoot,
  FloorAccordionTrigger,
} from '../floor/accordion';

/** Accordion and its hand-written floor, two items, server-rendered. */
export function renderPart(open: boolean) {
  return renderToString(() => (
    <Accordion.Root defaultValue={open ? ['a'] : []} multiple>
      <For each={['a', 'b']}>
        {(value) => (
          <Accordion.Item value={value}>
            <Accordion.Header>
              <Accordion.Trigger>Toggle</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Content</Accordion.Panel>
          </Accordion.Item>
        )}
      </For>
    </Accordion.Root>
  ));
}

export function renderFloor(open: boolean) {
  return renderToString(() => (
    <FloorAccordionRoot defaultValue={open ? ['a'] : []} multiple>
      <For each={['a', 'b']}>
        {(value) => (
          <FloorAccordionItem value={value}>
            <FloorAccordionHeader>
              <FloorAccordionTrigger>Toggle</FloorAccordionTrigger>
            </FloorAccordionHeader>
            <FloorAccordionPanel>Content</FloorAccordionPanel>
          </FloorAccordionItem>
        )}
      </For>
    </FloorAccordionRoot>
  ));
}

/** Accordion items with the given values, server-rendered: which items the server opens. */
export function renderValues(defaultValue: unknown[], values: unknown[]) {
  return renderToString(() => (
    <Accordion.Root defaultValue={defaultValue} multiple>
      <For each={values}>
        {(value) => (
          <Accordion.Item value={value}>
            <Accordion.Header>
              <Accordion.Trigger>Toggle</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Content</Accordion.Panel>
          </Accordion.Item>
        )}
      </For>
    </Accordion.Root>
  ));
}
