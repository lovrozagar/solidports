/*
 * A flush applies effects by reactive height. A JSX context provider's children memo puts its
 * children's effects after the providing part's own, and parts that assign their children's state
 * in an effect (a list's indexes, a field's registrations, a popup's position) rely on that order.
 * Rendered under a transparent owner instead, each child applied first with the state it had and
 * again with the assigned one (GOTCHA-019). Each case opens or mounts a family with 20 children and
 * counts the runs of the effects the library creates against their creations: a provider that loses
 * the order shows as at least one extra run per child. When b75c8bd5 moved these sites onto
 * `provideContext`, only CompositeList lost it (a Menu open re-ran 99 effects, against 36 before).
 */
import { createSignal, flush, For } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Combobox } from '@solidports/base-ui/combobox';
import { ContextMenu } from '@solidports/base-ui/context-menu';
import { Dialog } from '@solidports/base-ui/dialog';
import { Drawer } from '@solidports/base-ui/drawer';
import { Field } from '@solidports/base-ui/field';
import { Menu } from '@solidports/base-ui/menu';
import { Menubar } from '@solidports/base-ui/menubar';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { OTPField } from '@solidports/base-ui/otp-field';
import { Popover } from '@solidports/base-ui/popover';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { Select } from '@solidports/base-ui/select';
import { Switch } from '@solidports/base-ui/switch';
import { Tabs } from '@solidports/base-ui/tabs';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createRenderer, isJSDOM } from '#test-utils';
import type { JSX } from '@solidjs/web';

const counts = vi.hoisted(() => ({ on: false, created: 0, runs: 0 }));

vi.mock('solid-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('solid-js')>();
  const counted =
    (create: (...args: any[]) => unknown) =>
    (compute: any, ...rest: any[]) => {
      if (!counts.on) {
        return create(compute, ...rest);
      }
      const limit = Error.stackTraceLimit;
      Error.stackTraceLimit = 80;
      const stack = new Error().stack ?? '';
      Error.stackTraceLimit = limit;
      const fromLibrary = stack
        .split('\n')
        .some((frame) => frame.includes('/packages/solid/src/') && !frame.includes('.test.tsx'));
      if (!fromLibrary) {
        return create(compute, ...rest);
      }
      counts.created += 1;
      return create(
        (...args: unknown[]) => {
          counts.runs += 1;
          return compute(...args);
        },
        ...rest,
      );
    };
  return {
    ...actual,
    createRenderEffect: counted(actual.createRenderEffect as any),
    createEffect: counted(actual.createEffect as any),
  };
});

const N = 20;
const indexes = Array.from({ length: N }, (_, i) => i);

type Case = {
  name: string;
  /** Renders the family; `open` is a signal the case may wire to a controlled `open`. */
  ui: (open: () => boolean) => JSX.Element;
  /**
   * The most runs over creations the case may count. Each is the count at a81f0271; the ones at N or
   * more re-ran as many times before b75c8bd5 converted any provider.
   */
  maxExtra: number;
  /** The counted step after mount; without it, the mount itself is counted. */
  act?: (setOpen: (value: boolean) => void) => void;
};

const opens = (setOpen: (value: boolean) => void) => setOpen(true);

const CASES: Case[] = [
  {
    name: 'Menu open',
    maxExtra: 9,
    ui: (open) => (
      <Menu.Root open={open()}>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <For each={indexes}>{(i) => <Menu.Item>Item {i}</Menu.Item>}</For>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    act: opens,
  },
  {
    name: 'Menu submenu open',
    maxExtra: 3,
    ui: (open) => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.SubmenuRoot open={open()}>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <For each={indexes}>{(i) => <Menu.Item>Item {i}</Menu.Item>}</For>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    act: opens,
  },
  {
    name: 'ContextMenu open',
    maxExtra: 5,
    ui: () => (
      <ContextMenu.Root>
        <ContextMenu.Trigger data-testid="area">Area</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup>
              <For each={indexes}>{(i) => <ContextMenu.Item>Item {i}</ContextMenu.Item>}</For>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    ),
    act: () =>
      fireEvent.contextMenu(screen.getByTestId('area'), { clientX: 12, clientY: 12, button: 2 }),
  },
  {
    name: 'Menubar open',
    maxExtra: 10,
    ui: (open) => (
      <Menubar>
        <Menu.Root open={open()}>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <For each={indexes}>{(i) => <Menu.Item>Item {i}</Menu.Item>}</For>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger>Edit</Menu.Trigger>
        </Menu.Root>
      </Menubar>
    ),
    act: opens,
  },
  {
    name: 'Select open',
    maxExtra: 9,
    ui: (open) => (
      <Select.Root open={open()} defaultValue={3}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <For each={indexes}>
                {(i) => (
                  <Select.Item value={i}>
                    <Select.ItemText>Item {i}</Select.ItemText>
                  </Select.Item>
                )}
              </For>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
    act: opens,
  },
  {
    name: 'Combobox open',
    maxExtra: 36,
    ui: (open) => (
      <Combobox.Root items={indexes.map((i) => `item ${i}`)} open={open()}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    act: opens,
  },
  {
    name: 'Combobox grouped open',
    maxExtra: 38,
    ui: (open) => (
      <Combobox.Root
        items={[0, 1].map((g) => ({
          value: `group ${g}`,
          items: indexes.slice(g * 10, g * 10 + 10).map((i) => `item ${i}`),
        }))}
        open={open()}
        multiple
      >
        <Combobox.Chips>
          <Combobox.Input />
        </Combobox.Chips>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(group: { value: string; items: string[] }) => (
                  <Combobox.Group items={group.items}>
                    <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                    <Combobox.Collection>
                      {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                    </Combobox.Collection>
                  </Combobox.Group>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    act: opens,
  },
  {
    name: 'NavigationMenu open',
    maxExtra: 2,
    ui: (open) => (
      <NavigationMenu.Root value={open() ? 'one' : null}>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <For each={indexes}>
                {(i) => <NavigationMenu.Link href={`#${i}`}>Link {i}</NavigationMenu.Link>}
              </For>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="two">
            <NavigationMenu.Trigger>Two</NavigationMenu.Trigger>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ),
    act: opens,
  },
  {
    name: 'Popover open',
    maxExtra: 7,
    ui: (open) => (
      <Popover.Root open={open()}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <For each={indexes}>{(i) => <button type="button">Button {i}</button>}</For>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
    act: opens,
  },
  {
    name: 'PreviewCard open',
    maxExtra: 7,
    ui: (open) => (
      <PreviewCard.Root open={open()}>
        <PreviewCard.Trigger href="#">Link</PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>
              <For each={indexes}>{(i) => <a href={`#${i}`}>Link {i}</a>}</For>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
    act: opens,
  },
  {
    name: 'Tooltip open',
    maxExtra: 7,
    ui: (open) => (
      <Tooltip.Provider>
        <Tooltip.Root open={open()}>
          <Tooltip.Trigger>Hover</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>
                <For each={indexes}>{(i) => <span>Line {i}</span>}</For>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ),
    act: opens,
  },
  {
    name: 'Dialog open',
    maxExtra: 2,
    ui: (open) => (
      <Dialog.Root open={open()}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup>
            <For each={indexes}>{(i) => <button type="button">Button {i}</button>}</For>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
    act: opens,
  },
  {
    name: 'Drawer open',
    maxExtra: 4,
    ui: (open) => (
      <Drawer.Root open={open()}>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <For each={indexes}>{(i) => <button type="button">Button {i}</button>}</For>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ),
    act: opens,
  },
  {
    name: 'Accordion mount',
    maxExtra: 0,
    ui: () => (
      <Accordion.Root>
        <For each={indexes}>
          {(i) => (
            <Accordion.Item value={i}>
              <Accordion.Header>
                <Accordion.Trigger>Item {i}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>Panel {i}</Accordion.Panel>
            </Accordion.Item>
          )}
        </For>
      </Accordion.Root>
    ),
  },
  {
    name: 'Tabs mount',
    maxExtra: 64,
    ui: () => (
      <Tabs.Root defaultValue={3}>
        <Tabs.List>
          <For each={indexes}>{(i) => <Tabs.Tab value={i}>Tab {i}</Tabs.Tab>}</For>
          <Tabs.Indicator />
        </Tabs.List>
        <For each={indexes}>{(i) => <Tabs.Panel value={i}>Panel {i}</Tabs.Panel>}</For>
      </Tabs.Root>
    ),
  },
  {
    name: 'RadioGroup mount',
    maxExtra: 20,
    ui: () => (
      <RadioGroup defaultValue={3}>
        <For each={indexes}>
          {(i) => (
            <Radio.Root value={i}>
              <Radio.Indicator />
            </Radio.Root>
          )}
        </For>
      </RadioGroup>
    ),
  },
  {
    name: 'ToggleGroup mount',
    maxExtra: 0,
    ui: () => (
      <ToggleGroup defaultValue={['3']}>
        <For each={indexes}>{(i) => <Toggle value={String(i)}>Toggle {i}</Toggle>}</For>
      </ToggleGroup>
    ),
  },
  {
    name: 'Toolbar mount',
    maxExtra: 20,
    ui: () => (
      <Toolbar.Root>
        <For each={indexes}>{(i) => <Toolbar.Button>Button {i}</Toolbar.Button>}</For>
      </Toolbar.Root>
    ),
  },
  {
    name: 'CheckboxGroup mount',
    maxExtra: 0,
    ui: () => (
      <CheckboxGroup defaultValue={['3']} allValues={indexes.map(String)}>
        <For each={indexes}>
          {(i) => (
            <Checkbox.Root value={String(i)}>
              <Checkbox.Indicator />
            </Checkbox.Root>
          )}
        </For>
      </CheckboxGroup>
    ),
  },
  {
    name: 'Field mount',
    maxExtra: 60,
    ui: () => (
      <div>
        <For each={indexes}>
          {(i) => (
            <Field.Root name={`field${i}`}>
              <Field.Label>Label {i}</Field.Label>
              <Field.Control />
              <Field.Description>Description {i}</Field.Description>
              <Field.Error />
            </Field.Root>
          )}
        </For>
      </div>
    ),
  },
  {
    name: 'Field with Switch mount',
    maxExtra: 40,
    ui: () => (
      <div>
        <For each={indexes}>
          {(i) => (
            <Field.Root name={`switch${i}`}>
              <Field.Label>
                <Switch.Root>
                  <Switch.Thumb />
                </Switch.Root>
                Switch {i}
              </Field.Label>
            </Field.Root>
          )}
        </For>
      </div>
    ),
  },
  {
    name: 'OTPField mount',
    maxExtra: 0,
    ui: () => (
      <OTPField.Root length={N}>
        <For each={indexes}>{() => <OTPField.Input />}</For>
      </OTPField.Root>
    ),
  },
];

// vi.mock('solid-js') does not reach the runtime in browser mode, so nothing would be counted.
describe.skipIf(!isJSDOM)('provider effect order', () => {
  const { render } = createRenderer();

  it.each(CASES)('$name re-runs no more library effects than it did', async (testCase) => {
    const [open, setOpen] = createSignal(false);
    counts.created = 0;
    counts.runs = 0;
    counts.on = !testCase.act;
    await render(() => testCase.ui(open));
    flush();
    if (testCase.act) {
      counts.on = true;
      testCase.act(setOpen);
      flush();
    }
    await Promise.resolve();
    flush();
    counts.on = false;
    expect(counts.created).toBeGreaterThan(N);
    expect(counts.runs - counts.created).toBeLessThanOrEqual(testCase.maxExtra);
  });
});
