import { CSPProvider } from '@solidports/base-ui/csp-provider';
import { Tabs } from '@solidports/base-ui/tabs';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  indicator: () => (
    <Tabs.Root value={1}>
      <Tabs.List>
        <Tabs.Tab value={1}>One</Tabs.Tab>
        <Tabs.Indicator renderBeforeHydration />
      </Tabs.List>
    </Tabs.Root>
  ),
  nonce: () => (
    <CSPProvider nonce="test-nonce">
      <Tabs.Root value={1}>
        <Tabs.List>
          <Tabs.Tab value={1}>One</Tabs.Tab>
          <Tabs.Indicator renderBeforeHydration />
        </Tabs.List>
      </Tabs.Root>
    </CSPProvider>
  ),
});
