import { createSignal, For, Show } from 'solid-js';
import { Accordion } from '@solidports/base-ui/accordion';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';
import {
  FloorAccordionHeader,
  FloorAccordionItem,
  FloorAccordionPanel,
  FloorAccordionRoot,
  FloorAccordionTrigger,
} from '../../../test/floor/accordion';

export const PANEL_CONTENT_1 = 'Panel contents 1';

/** Shows the middle item of `conditionalMiddleItem`: hidden on the server and while hydrating. */
export const [showMiddleItem, setShowMiddleItem] = createSignal(false);

const item = (value: string) => (
  <Accordion.Item value={value}>
    <Accordion.Header>
      <Accordion.Trigger>{value}</Accordion.Trigger>
    </Accordion.Header>
  </Accordion.Item>
);

export default defineSsrFixtures(import.meta.url, {
  // The hand-written floor the bench measures hydration against: it must hydrate cleanly too.
  floor: () => (
    <FloorAccordionRoot defaultValue={['a']} multiple>
      <For each={['a', 'b']}>
        {(value) => (
          <FloorAccordionItem value={value}>
            <FloorAccordionHeader>
              <FloorAccordionTrigger>{value}</FloorAccordionTrigger>
            </FloorAccordionHeader>
            <FloorAccordionPanel>{value} contents</FloorAccordionPanel>
          </FloorAccordionItem>
        )}
      </For>
    </FloorAccordionRoot>
  ),
  defaultOpen: () => (
    <Accordion.Root defaultValue={[0]}>
      <Accordion.Item value={0}>
        <Accordion.Header>
          <Accordion.Trigger>Trigger 1</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  // The server guesses the indexes from creation order (a: 0, c: 1); an item shown later between
  // them must leave every index equal to the DOM order.
  conditionalMiddleItem: () => (
    <Accordion.Root>
      {item('a')}
      <Show when={showMiddleItem()}>{item('b')}</Show>
      {item('c')}
    </Accordion.Root>
  ),
});
