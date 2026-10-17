import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import type { JSX } from '@solidjs/web';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/**
 * Native panels rendered by the consumer (plan 3 leaf 5.1.2), open and closed, for
 * `slowPanel.hydration.test.tsx`: a static render function and a `{ component }` config, which
 * bind through the props the consumer spreads.
 */
const renderSection = (props: object) => <section {...props} />;
const AppSection = (props: JSX.HTMLAttributes<HTMLElement>) => <section {...props} />;
const config = { component: AppSection };

export default defineSsrFixtures(import.meta.url, {
  collapsibleOpen: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Panel data-testid="panel" render={renderSection}>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  collapsibleKeepMountedClosed: () => (
    <Collapsible.Root>
      <Collapsible.Panel data-testid="panel" keepMounted render={config}>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  collapsibleHiddenUntilFoundClosed: () => (
    <Collapsible.Root>
      <Collapsible.Panel data-testid="panel" hiddenUntilFound render={renderSection}>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  accordionOpen: () => (
    <Accordion.Root defaultValue={['one']}>
      <Accordion.Item value="one">
        <Accordion.Panel data-testid="panel" render={config}>
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  accordionKeepMountedClosed: () => (
    <Accordion.Root>
      <Accordion.Item value="one">
        <Accordion.Panel data-testid="panel" keepMounted render={renderSection}>
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  accordionHiddenUntilFoundClosed: () => (
    <Accordion.Root>
      <Accordion.Item value="one">
        <Accordion.Panel data-testid="panel" hiddenUntilFound render={config}>
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
});
