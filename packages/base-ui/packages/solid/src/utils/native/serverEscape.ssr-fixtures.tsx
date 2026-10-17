import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { Tabs } from '@solidports/base-ui/tabs';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/**
 * Text children with markup characters in every part on the native server path, a slow-path part
 * (a `render` prop) and a plain element: the server must escape each as compiled JSX does
 * (`serverEscape.test.tsx`).
 */
const text = (part: string) => `<b>${part}</b>`;
const renderDiv = (props: object) => <div {...props} />;

export default defineSsrFixtures(import.meta.url, {
  textChildren: () => (
    <>
      <Collapsible.Root defaultOpen>
        {text('collapsible-root')}
        <Collapsible.Trigger>{text('collapsible-trigger')}</Collapsible.Trigger>
        <Collapsible.Panel>{text('collapsible-panel')}</Collapsible.Panel>
      </Collapsible.Root>
      <Accordion.Root defaultValue={['one']}>
        <Accordion.Item value="one">
          {text('accordion-item')}
          <Accordion.Header>
            <Accordion.Trigger>{text('accordion-trigger')}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{text('accordion-panel')}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">{text('tabs-tab')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one">{text('tabs-panel')}</Tabs.Panel>
      </Tabs.Root>
      <Collapsible.Root>
        <Collapsible.Trigger render={renderDiv} nativeButton={false}>
          {text('slow-trigger')}
        </Collapsible.Trigger>
      </Collapsible.Root>
      <div>{text('plain')}</div>
    </>
  ),
  literalText: () => (
    <>
      <Collapsible.Root>
        <Collapsible.Trigger data-testid="literal-trigger">Tom &amp; Jerry &lt;3 & co</Collapsible.Trigger>
      </Collapsible.Root>
      <div data-testid="literal-plain">Tom &amp; Jerry &lt;3 & co</div>
    </>
  ),
});

