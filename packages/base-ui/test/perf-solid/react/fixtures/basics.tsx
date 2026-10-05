import * as React from 'react';
import { Button } from '@base-ui/react/button';
import { Checkbox } from '@base-ui/react/checkbox';
import { Tabs } from '@base-ui/react/tabs';
import { Accordion } from '@base-ui/react/accordion';
import { Slider } from '@base-ui/react/slider';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function RawButtons() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <button key={i} type="button" onClick={() => {}} onKeyDown={() => {}}>
          Button {i}
        </button>
      ))}
    </div>
  );
}

function Buttons() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Button key={i}>Button {i}</Button>
      ))}
    </div>
  );
}

function CheckboxUncontrolled() {
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Checkbox.Root key={i}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      ))}
    </div>
  );
}

function CheckboxControlled() {
  const checked = useExposed('checked', false);
  return (
    <div>
      {range(size(1000)).map((i) => (
        <Checkbox.Root key={i} checked={checked}>
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
      ))}
    </div>
  );
}

const tabItems = items(size(200));
function Tabs200() {
  const value = useExposed('value', tabItems[0].value);
  return (
    <Tabs.Root value={value} onValueChange={setExposed('value')}>
      <Tabs.List>
        {tabItems.map((it) => (
          <Tabs.Tab key={it.value} value={it.value}>
            {it.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {tabItems.map((it) => (
        <Tabs.Panel key={it.value} value={it.value}>
          Panel {it.label}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}

const accItems = items(size(300));
function Accordion300() {
  const value = useExposed('value', [] as string[]);
  return (
    <Accordion.Root multiple value={value} onValueChange={setExposed('value')}>
      {accItems.map((it) => (
        <Accordion.Item key={it.value} value={it.value}>
          <Accordion.Header>
            <Accordion.Trigger>{it.label}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Content {it.label}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

function SliderControlled() {
  const value = useExposed('value', 0);
  return (
    <Slider.Root value={value} onValueChange={setExposed('value')} max={300}>
      <Slider.Control style={{ width: '400px', height: '20px' }}>
        <Slider.Track style={{ height: '4px' }}>
          <Slider.Indicator />
          <Slider.Thumb aria-label="v" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}


export const fixtures: Record<string, React.FC> = {
  'button/raw': RawButtons,
  'button/list': Buttons,
  'checkbox/uncontrolled': CheckboxUncontrolled,
  'checkbox/controlled': CheckboxControlled,
  'tabs/200': Tabs200,
  'accordion/300': Accordion300,
  'slider/controlled': SliderControlled,
};
