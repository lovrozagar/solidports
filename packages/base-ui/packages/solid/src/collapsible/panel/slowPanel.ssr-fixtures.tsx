import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/** Slow-path panels (a `render` prop or spread props), open and closed, for `slowPanel.hydration.test.tsx`. */
const renderDiv = (props: object) => <div {...props} />;
/** Consumer attributes as a spread: the props become a proxy, which takes the slow path. */
const literals = (testId: string) => ({ 'data-testid': testId, 'aria-label': 'Panel' });

export default defineSsrFixtures(import.meta.url, {
  collapsibleOpen: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Panel data-testid="panel" render={renderDiv}>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  collapsibleKeepMountedClosed: () => (
    <Collapsible.Root>
      <Collapsible.Panel data-testid="panel" keepMounted render={renderDiv}>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  collapsibleHiddenUntilFoundClosed: () => (
    <Collapsible.Root>
      <Collapsible.Panel data-testid="panel" hiddenUntilFound render={renderDiv}>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  accordionOpen: () => (
    <Accordion.Root defaultValue={['one']}>
      <Accordion.Item value="one">
        <Accordion.Panel data-testid="panel" render={renderDiv}>
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  accordionKeepMountedClosed: () => (
    <Accordion.Root>
      <Accordion.Item value="one">
        <Accordion.Panel data-testid="panel" keepMounted render={renderDiv}>
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  accordionHiddenUntilFoundClosed: () => (
    <Accordion.Root>
      <Accordion.Item value="one">
        <Accordion.Panel data-testid="panel" hiddenUntilFound render={renderDiv}>
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
  collapsibleSpreadClosed: () => (
    <Collapsible.Root>
      <Collapsible.Panel {...literals('panel')} keepMounted>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  collapsibleSpreadOpen: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Panel {...literals('panel')} keepMounted>
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  accordionSpreadClosed: () => (
    <Accordion.Root>
      <Accordion.Item value="one">
        <Accordion.Panel {...literals('panel')} keepMounted>
          Content
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  ),
});
