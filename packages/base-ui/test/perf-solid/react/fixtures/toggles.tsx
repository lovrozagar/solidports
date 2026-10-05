import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { Accordion } from '@base-ui/react/accordion';
import { Collapsible } from '@base-ui/react/collapsible';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Switch } from '@base-ui/react/switch';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Toolbar } from '@base-ui/react/toolbar';
import { Menu } from '@base-ui/react/menu';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function TabsVariant(props: { keepMounted?: boolean; vertical?: boolean }) {
  const tabItems = items(size(200));
  return (
    <Tabs.Root defaultValue={tabItems[0].value} orientation={props.vertical ? 'vertical' : 'horizontal'}>
      <Tabs.List>
        {tabItems.map((it) => (
          <Tabs.Tab key={it.value} value={it.value}>
            {it.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {tabItems.map((it) => (
        <Tabs.Panel key={it.value} value={it.value} keepMounted={props.keepMounted}>
          Panel {it.label}
        </Tabs.Panel>
      ))}
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
        {items(size(300)).map((it) => (
          <Accordion.Item key={it.value} value={it.value}>
            <Accordion.Header>
              <Accordion.Trigger>{it.label}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel className="anim-panel">Content {it.label}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </>
  );
}

function Collapsibles() {
  const open = useExposed('open', false);
  return (
    <div>
      {range(size(300)).map((i) => (
        <Collapsible.Root key={i} open={open}>
          <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
          <Collapsible.Panel>Panel {i}</Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </div>
  );
}

function CollapsiblesUncontrolled() {
  return (
    <div>
      {range(size(300)).map((i) => (
        <Collapsible.Root key={i}>
          <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
          <Collapsible.Panel>Panel {i}</Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </div>
  );
}

function CheckboxGroupParent() {
  const all = items(size(500)).map((it) => it.value);
  const value = useExposed('value', [] as string[]);
  return (
    <CheckboxGroup value={value} onValueChange={setExposed('value')} allValues={all}>
      <Checkbox.Root parent data-testid="parent">
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Root>
      {all.map((v) => (
        <Checkbox.Root key={v} value={v}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      ))}
    </CheckboxGroup>
  );
}

function Switches() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Switch.Root key={i}>
          <Switch.Thumb />
        </Switch.Root>
      ))}
    </div>
  );
}

function Toggles() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Toggle key={i}>T{i}</Toggle>
      ))}
    </div>
  );
}

function ToggleGroupVariant(props: { multiple: boolean }) {
  const value = useExposed('value', [] as string[]);
  return (
    <ToggleGroup multiple={props.multiple} value={value} onValueChange={setExposed('value')}>
      {items(size(300)).map((it) => (
        <Toggle key={it.value} value={it.value}>
          {it.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

function Radios() {
  const value = useExposed('value', 'item-0');
  return (
    <RadioGroup value={value} onValueChange={setExposed('value')}>
      {items(size(300)).map((it) => (
        <Radio.Root key={it.value} value={it.value} data-v={it.value}>
          <Radio.Indicator />
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

function ToolbarFixture() {
  return (
    <Toolbar.Root>
      <Toolbar.Group>
        {range(size(150)).map((i) => (
          <Toolbar.Button key={i} data-testid="tb-button">
            B{i}
          </Toolbar.Button>
        ))}
      </Toolbar.Group>
      <Toolbar.Separator />
      {range(size(25)).map((i) => (
        <Toolbar.Link key={i} href="#">
          L{i}
        </Toolbar.Link>
      ))}
      <Toolbar.Input data-testid="tb-input" defaultValue="" />
      {range(size(23)).map((i) => (
        <Toolbar.Input key={i} defaultValue="" />
      ))}
      <Menu.Root>
        <Toolbar.Button data-testid="tb-menu" render={<Menu.Trigger />}>
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

export const fixtures: Record<string, React.FC> = {
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
