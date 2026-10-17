import { createSignal, For, omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
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

/** A consumer component in `render`: forwards every prop, the ref included, to a tag. */
const AppButton = (props: JSX.HTMLAttributes<HTMLButtonElement>) => <button {...props} />;
const AppSection = (props: JSX.HTMLAttributes<HTMLElement>) => <section {...props} />;
/** The same components dropping the ref: the part cannot reach the element through them. */
const NoRefButton = (props: JSX.HTMLAttributes<HTMLButtonElement>) => (
  <button {...omit(props, 'ref')} />
);
const NoRefSection = (props: JSX.HTMLAttributes<HTMLElement>) => (
  <section {...omit(props, 'ref')} />
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
  // The three `render` values the port takes (plan 3 leaf 5.1.2) on the Trigger and the Panel:
  // the client must claim the server's elements, not recreate them.
  renderTag: () => (
    <Accordion.Root defaultValue={['a']}>
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger render="button" data-testid="trigger">
            Toggle
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel render="section" keepMounted data-testid="panel">
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  renderConfig: () => (
    <Accordion.Root defaultValue={['a']}>
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger
            render={{ component: 'button', 'data-source': 'config' }}
            data-testid="trigger"
          >
            Toggle
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel
          render={{ component: 'section', 'data-source': 'config' }}
          keepMounted
          data-testid="panel"
        >
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  renderComponent: () => (
    <Accordion.Root defaultValue={['a']}>
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger render={{ component: AppButton }} data-testid="trigger">
            Toggle
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel render={{ component: AppSection }} keepMounted data-testid="panel">
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  renderComponentNoRef: () => (
    <Accordion.Root defaultValue={['a']}>
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger render={{ component: NoRefButton }} data-testid="trigger">
            Toggle
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel render={{ component: NoRefSection }} keepMounted data-testid="panel">
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  renderFunction: () => (
    <Accordion.Root defaultValue={['a']}>
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger
            render={(props, state) => <button {...props} data-render-open={String(state.open)} />}
            data-testid="trigger"
          >
            Toggle
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel
          render={(props, state) => <section {...props} data-render-open={String(state.open)} />}
          keepMounted
          data-testid="panel"
        >
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
});
