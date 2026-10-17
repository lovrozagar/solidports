import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/*
 * Every part on the native server path with the consumer's literal attributes (`data-testid`,
 * `aria-label`, `id`), written out: a spread makes the props a proxy, which takes the slow path.
 * `hydratedLiterals.test.tsx` updates each tree twice after hydration and checks every part
 * against the same tree rendered on the client.
 */

function CollapsibleTree(props: { defaultOpen: boolean }) {
  return (
    <Collapsible.Root
      data-testid="collapsible-root"
      aria-label="collapsible-root label"
      id="collapsible-root-id"
      defaultOpen={props.defaultOpen}
    >
      <Collapsible.Trigger
        data-testid="collapsible-trigger"
        aria-label="collapsible-trigger label"
        id="collapsible-trigger-id"
      >
        Trigger
      </Collapsible.Trigger>
      <Collapsible.Panel
        data-testid="collapsible-panel"
        aria-label="collapsible-panel label"
        id="collapsible-panel-id"
        keepMounted
      >
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function AccordionTree(props: { defaultValue: string[] }) {
  return (
    <Accordion.Root
      data-testid="accordion-root"
      aria-label="accordion-root label"
      id="accordion-root-id"
      defaultValue={props.defaultValue}
    >
      <Accordion.Item
        data-testid="accordion-item"
        aria-label="accordion-item label"
        id="accordion-item-id"
        value="one"
      >
        <Accordion.Header
          data-testid="accordion-header"
          aria-label="accordion-header label"
          id="accordion-header-id"
        >
          <Accordion.Trigger
            data-testid="accordion-trigger"
            aria-label="accordion-trigger label"
            id="accordion-trigger-id"
          >
            One
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel
          data-testid="accordion-panel"
          aria-label="accordion-panel label"
          id="accordion-panel-id"
          keepMounted
        >
          One content
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="two">
        <Accordion.Header>
          <Accordion.Trigger data-testid="accordion-trigger-two">Two</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel keepMounted>Two content</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}

export default defineSsrFixtures(import.meta.url, {
  collapsibleOpen: () => <CollapsibleTree defaultOpen />,
  collapsibleClosed: () => <CollapsibleTree defaultOpen={false} />,
  accordionOpen: () => <AccordionTree defaultValue={['one']} />,
  accordionClosed: () => <AccordionTree defaultValue={[]} />,
});
