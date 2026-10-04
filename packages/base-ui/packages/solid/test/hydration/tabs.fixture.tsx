import { Tabs } from '@solidports/base-ui/tabs';

/** Two tabs and their panels, rendered on the server and hydrated on the client. */
export function TabsFixture() {
  return (
    <Tabs.Root defaultValue="one">
      <Tabs.List>
        <Tabs.Tab value="one">One</Tabs.Tab>
        <Tabs.Tab value="two">Two</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="one">Panel one</Tabs.Panel>
      <Tabs.Panel value="two">Panel two</Tabs.Panel>
    </Tabs.Root>
  );
}
