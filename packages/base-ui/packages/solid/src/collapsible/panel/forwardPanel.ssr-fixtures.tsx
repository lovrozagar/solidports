import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import type { JSX } from '@solidjs/web';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/**
 * Panels whose `render` a consumer's wrapper forwards (`render={props.render}`, a getter), open and
 * closed, for `slowPanel.hydration.test.tsx`: they render natively (plan 3 leaf 5.1.2b) with a
 * function, a `{ component }` config, or nothing forwarded.
 */
const renderSection = (props: object) => <section {...props} />;
const AppSection = (props: JSX.HTMLAttributes<HTMLElement>) => <section {...props} />;
const config = { component: AppSection };

function ForwardCollapsiblePanel(props: Collapsible.Panel.Props) {
  return (
    <Collapsible.Panel
      data-testid="panel"
      keepMounted={props.keepMounted}
      hiddenUntilFound={props.hiddenUntilFound}
      render={props.render}
    >
      {props.children}
    </Collapsible.Panel>
  );
}

function ForwardAccordionPanel(props: Accordion.Panel.Props) {
  return (
    <Accordion.Panel
      data-testid="panel"
      keepMounted={props.keepMounted}
      hiddenUntilFound={props.hiddenUntilFound}
      render={props.render}
    >
      {props.children}
    </Accordion.Panel>
  );
}

export default defineSsrFixtures(import.meta.url, {
  collapsibleOpen: () => (
    <Collapsible.Root defaultOpen>
      <ForwardCollapsiblePanel render={renderSection}>Content</ForwardCollapsiblePanel>
    </Collapsible.Root>
  ),
  collapsibleOpenNothingForwarded: () => (
    <Collapsible.Root defaultOpen>
      <ForwardCollapsiblePanel>Content</ForwardCollapsiblePanel>
    </Collapsible.Root>
  ),
  collapsibleKeepMountedClosed: () => (
    <Collapsible.Root>
      <ForwardCollapsiblePanel keepMounted render={config}>
        Content
      </ForwardCollapsiblePanel>
    </Collapsible.Root>
  ),
  accordionOpen: () => (
    <Accordion.Root defaultValue={['one']}>
      <Accordion.Item value="one">
        <ForwardAccordionPanel render={config}>Content</ForwardAccordionPanel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  accordionHiddenUntilFoundClosed: () => (
    <Accordion.Root>
      <Accordion.Item value="one">
        <ForwardAccordionPanel hiddenUntilFound render={renderSection}>
          Content
        </ForwardAccordionPanel>
      </Accordion.Item>
    </Accordion.Root>
  ),
});
