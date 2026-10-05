import { For } from 'solid-js';
import { Button } from '@solidports/base-ui/button';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Tabs } from '@solidports/base-ui/tabs';
import { Accordion } from '@solidports/base-ui/accordion';
import { Slider } from '@solidports/base-ui/slider';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function RawButtons() {
  return (
    <div>
      <For each={range(size(1000))}>
        {(i) => (
          <button type="button" onClick={() => {}} onKeyDown={() => {}}>
            Button {i}
          </button>
        )}
      </For>
    </div>
  );
}

function Buttons() {
  return (
    <div>
      <For each={range(size(1000))}>{(i) => <Button>Button {i}</Button>}</For>
    </div>
  );
}

function CheckboxUncontrolled() {
  return (
    <div>
      <For each={range(size(1000))}>
        {() => (
          <Checkbox.Root>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
        )}
      </For>
    </div>
  );
}

function CheckboxControlled() {
  const checked = useExposed('checked', false);
  return (
    <div>
      <For each={range(size(1000))}>
        {() => (
          <Checkbox.Root checked={checked()}>
            <Checkbox.Indicator>✓</Checkbox.Indicator>
          </Checkbox.Root>
        )}
      </For>
    </div>
  );
}

const tabItems = items(size(200));
function Tabs200() {
  const value = useExposed('value', tabItems[0].value);
  return (
    <Tabs.Root value={value()} onValueChange={setExposed('value')}>
      <Tabs.List>
        <For each={tabItems}>{(it) => <Tabs.Tab value={it.value}>{it.label}</Tabs.Tab>}</For>
        <Tabs.Indicator />
      </Tabs.List>
      <For each={tabItems}>{(it) => <Tabs.Panel value={it.value}>Panel {it.label}</Tabs.Panel>}</For>
    </Tabs.Root>
  );
}

const accItems = items(size(300));
function Accordion300() {
  const value = useExposed('value', [] as string[]);
  return (
    <Accordion.Root multiple value={value()} onValueChange={setExposed('value')}>
      <For each={accItems}>
        {(it) => (
          <Accordion.Item value={it.value}>
            <Accordion.Header>
              <Accordion.Trigger>{it.label}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>Content {it.label}</Accordion.Panel>
          </Accordion.Item>
        )}
      </For>
    </Accordion.Root>
  );
}

function SliderControlled() {
  const value = useExposed('value', 0);
  return (
    <Slider.Root value={value()} onValueChange={setExposed('value')} max={300}>
      <Slider.Control style={{ width: '400px', height: '20px' }}>
        <Slider.Track style={{ height: '4px' }}>
          <Slider.Indicator />
          <Slider.Thumb aria-label="v" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'button/raw': RawButtons,
  'button/list': Buttons,
  'checkbox/uncontrolled': CheckboxUncontrolled,
  'checkbox/controlled': CheckboxControlled,
  'tabs/200': Tabs200,
  'accordion/300': Accordion300,
  'slider/controlled': SliderControlled,
};
