import { For } from 'solid-js';
import { Tabs } from '@solidports/base-ui/tabs';
import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Switch } from '@solidports/base-ui/switch';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { Menu } from '@solidports/base-ui/menu';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function TabsVariant(props: { keepMounted?: boolean; vertical?: boolean }) {
  const tabItems = items(size(200));
  return (
    <Tabs.Root defaultValue={tabItems[0].value} orientation={props.vertical ? 'vertical' : 'horizontal'}>
      <Tabs.List>
        <For each={tabItems}>{(it) => <Tabs.Tab value={it.value}>{it.label}</Tabs.Tab>}</For>
        <Tabs.Indicator />
      </Tabs.List>
      <For each={tabItems}>
        {(it) => (
          <Tabs.Panel value={it.value} keepMounted={props.keepMounted}>
            Panel {it.label}
          </Tabs.Panel>
        )}
      </For>
    </Tabs.Root>
  );
}

const ANIMATION_CSS = `
.anim-panel { height: var(--accordion-panel-height); overflow: hidden; transition: height 50ms ease-out; }
.anim-panel[data-starting-style], .anim-panel[data-ending-style] { height: 0; }
`;

function AccordionAnimated() {
  return (
    <>
      <style>{ANIMATION_CSS}</style>
      <Accordion.Root>
        <For each={items(size(300))}>
          {(it) => (
            <Accordion.Item value={it.value}>
              <Accordion.Header>
                <Accordion.Trigger>{it.label}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel class="anim-panel">Content {it.label}</Accordion.Panel>
            </Accordion.Item>
          )}
        </For>
      </Accordion.Root>
    </>
  );
}

function Collapsibles() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Collapsible.Root open={open()}>
            <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
            <Collapsible.Panel>Panel {i}</Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </div>
  );
}

function CollapsiblesUncontrolled() {
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Collapsible.Root>
            <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
            <Collapsible.Panel>Panel {i}</Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </div>
  );
}

function CheckboxGroupParent() {
  const all = items(size(500)).map((it) => it.value);
  const value = useExposed('value', [] as string[]);
  return (
    <CheckboxGroup value={value()} onValueChange={setExposed('value')} allValues={all}>
      <Checkbox.Root parent data-testid="parent">
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Root>
      <For each={all}>
        {(v) => (
          <Checkbox.Root value={v}>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
        )}
      </For>
    </CheckboxGroup>
  );
}

function Switches() {
  return (
    <div>
      <For each={range(size(1000))}>
        {() => (
          <Switch.Root>
            <Switch.Thumb />
          </Switch.Root>
        )}
      </For>
    </div>
  );
}

function Toggles() {
  return (
    <div>
      <For each={range(size(1000))}>{(i) => <Toggle>T{i}</Toggle>}</For>
    </div>
  );
}

function ToggleGroupVariant(props: { multiple: boolean }) {
  const value = useExposed('value', [] as string[]);
  return (
    <ToggleGroup multiple={props.multiple} value={value()} onValueChange={setExposed('value')}>
      <For each={items(size(300))}>{(it) => <Toggle value={it.value}>{it.label}</Toggle>}</For>
    </ToggleGroup>
  );
}

function Radios() {
  const value = useExposed('value', 'item-0');
  return (
    <RadioGroup value={value()} onValueChange={setExposed('value')}>
      <For each={items(size(300))}>
        {(it) => (
          <Radio.Root value={it.value} data-v={it.value}>
            <Radio.Indicator />
          </Radio.Root>
        )}
      </For>
    </RadioGroup>
  );
}

function ToolbarFixture() {
  return (
    <Toolbar.Root>
      <Toolbar.Group>
        <For each={range(size(150))}>
          {(i) => <Toolbar.Button data-testid="tb-button">B{i}</Toolbar.Button>}
        </For>
      </Toolbar.Group>
      <Toolbar.Separator />
      <For each={range(size(25))}>{(i) => <Toolbar.Link href="#">L{i}</Toolbar.Link>}</For>
      <Toolbar.Input data-testid="tb-input" defaultValue="" />
      <For each={range(size(23))}>{() => <Toolbar.Input defaultValue="" />}</For>
      <Menu.Root>
        <Toolbar.Button data-testid="tb-menu" render={(props) => <Menu.Trigger {...props} />}>
          Menu
        </Toolbar.Button>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Toolbar.Root>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'tabs/200-keepmounted': () => <TabsVariant keepMounted />,
  'tabs/200-vertical': () => <TabsVariant vertical />,
  'accordion/300-animated': AccordionAnimated,
  'collapsible/300': Collapsibles,
  'collapsible/300-uncontrolled': CollapsiblesUncontrolled,
  'checkbox/group-500-parent': CheckboxGroupParent,
  'switch/1000': Switches,
  'toggle/1000': Toggles,
  'toggle-group/300-single': () => <ToggleGroupVariant multiple={false} />,
  'toggle-group/300-multiple': () => <ToggleGroupVariant multiple />,
  'radio/300': Radios,
  'toolbar/200': ToolbarFixture,
};
