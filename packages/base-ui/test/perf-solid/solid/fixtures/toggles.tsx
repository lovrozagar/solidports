import { For, createSignal } from 'solid-js';
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

// Raw-Solid floors: the same DOM as the parts, written by hand (one signal and one attribute
// effect per element); what a native part could cost at best.
const HIDDEN = { border: 0, 'clip-path': 'inset(50%)', height: '1px', margin: '-1px', overflow: 'hidden', padding: 0, 'white-space': 'nowrap', width: '1px', left: 0, position: 'fixed', top: 0 } as const;

function RawCheckbox() {
  const [checked, setChecked] = createSignal(false);
  return (
    <>
      <span
        role="checkbox"
        tabindex="0"
        aria-checked={checked() ? 'true' : 'false'}
        data-checked={checked() ? '' : undefined}
        data-unchecked={checked() ? undefined : ''}
        onClick={() => setChecked((value) => !value)}
        onKeyDown={() => {}}
        onKeyUp={() => {}}
      >
        {checked() ? <span data-checked="">✓</span> : null}
      </span>
      <input type="checkbox" tabindex="-1" aria-hidden="true" style={HIDDEN} checked={checked()} />
    </>
  );
}
function RawCheckboxes() {
  return (
    <div>
      <For each={range(size(1000))}>{() => <RawCheckbox />}</For>
    </div>
  );
}
function RawSwitch() {
  const [checked, setChecked] = createSignal(false);
  return (
    <>
      <span
        role="switch"
        tabindex="0"
        aria-checked={checked() ? 'true' : 'false'}
        data-checked={checked() ? '' : undefined}
        data-unchecked={checked() ? undefined : ''}
        onClick={() => setChecked((value) => !value)}
        onKeyDown={() => {}}
        onKeyUp={() => {}}
      >
        <span data-checked={checked() ? '' : undefined} data-unchecked={checked() ? undefined : ''} />
      </span>
      <input type="checkbox" tabindex="-1" aria-hidden="true" style={HIDDEN} checked={checked()} />
    </>
  );
}
function RawSwitches() {
  return (
    <div>
      <For each={range(size(1000))}>{() => <RawSwitch />}</For>
    </div>
  );
}
function RawToggle(props: { label: string }) {
  const [pressed, setPressed] = createSignal(false);
  return (
    <button
      type="button"
      tabindex="0"
      aria-pressed={pressed() ? 'true' : 'false'}
      data-pressed={pressed() ? '' : undefined}
      onClick={() => setPressed((value) => !value)}
      onKeyDown={() => {}}
    >
      {props.label}
    </button>
  );
}
function RawToggles() {
  return (
    <div>
      <For each={range(size(1000))}>{(i) => <RawToggle label={`T${i}`} />}</For>
    </div>
  );
}
function RawToggleGroup() {
  const [value, setValue] = createSignal<string[]>([]);
  const [highlighted, setHighlighted] = createSignal(0);
  return (
    <div role="group" data-orientation="horizontal" onKeyDown={() => {}}>
      <For each={items(size(300))}>
        {(it, index) => (
          <button
            type="button"
            tabindex={highlighted() === index() ? 0 : -1}
            aria-disabled="false"
            aria-pressed={value().includes(it.value) ? 'true' : 'false'}
            data-pressed={value().includes(it.value) ? '' : undefined}
            onClick={() => setValue([it.value])}
            onFocus={() => setHighlighted(index())}
            onKeyDown={() => {}}
          >
            {it.label}
          </button>
        )}
      </For>
    </div>
  );
}
function RawRadios() {
  const [value, setValue] = createSignal('item-0');
  const [highlighted, setHighlighted] = createSignal(0);
  return (
    <div role="radiogroup" onKeyDown={() => {}}>
      <For each={items(size(300))}>
        {(it, index) => (
          <>
            <span
              role="radio"
              tabindex={highlighted() === index() ? 0 : -1}
              aria-checked={value() === it.value ? 'true' : 'false'}
              data-checked={value() === it.value ? '' : undefined}
              data-unchecked={value() === it.value ? undefined : ''}
              data-v={it.value}
              onClick={() => setValue(it.value)}
              onFocus={() => setHighlighted(index())}
              onKeyDown={() => {}}
              onKeyUp={() => {}}
            >
              {value() === it.value ? <span data-checked="" /> : null}
            </span>
            <input type="radio" tabindex="-1" aria-hidden="true" style={HIDDEN} value={it.value} checked={value() === it.value} />
          </>
        )}
      </For>
    </div>
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
  'checkbox/raw': RawCheckboxes,
  'switch/raw': RawSwitches,
  'toggle/raw': RawToggles,
  'toggle-group/raw': RawToggleGroup,
  'radio/raw': RawRadios,
};
