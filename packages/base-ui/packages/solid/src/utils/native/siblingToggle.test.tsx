/*
 * GOTCHA-020 across the native parts: each part renders next to a sibling that turns on and off
 * inside the same parent's children, and every element keeps its identity
 * (`expectKeptBesideToggle`). A part that builds its native element inside a `Show`'s function
 * child (the shape that rebuilt Toast.Title and Field.Error) fails here.
 */
import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { describe, it } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { Combobox } from '@solidports/base-ui/combobox';
import { Dialog } from '@solidports/base-ui/dialog';
import { Field } from '@solidports/base-ui/field';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { Menu } from '@solidports/base-ui/menu';
import { Meter } from '@solidports/base-ui/meter';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { Popover } from '@solidports/base-ui/popover';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { Progress } from '@solidports/base-ui/progress';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { Select } from '@solidports/base-ui/select';
import { Separator } from '@solidports/base-ui/separator';
import { Switch } from '@solidports/base-ui/switch';
import { Tabs } from '@solidports/base-ui/tabs';
import { Toast } from '@solidports/base-ui/toast';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { createRenderer } from '#test-utils';
import { expectKeptBesideToggle } from '../../../test/parityHarness';
import type { ToggledSibling } from '../../../test/parityHarness';

describe('GOTCHA-020: native parts keep their elements beside a toggling sibling', () => {
  const { render } = createRenderer();
  const expectKept = (
    ui: (Sibling: ToggledSibling) => JSX.Element,
    afterMount?: () => void,
  ) => expectKeptBesideToggle(render, ui, afterMount);

  it('Toast parts', () => {
    const manager = Toast.createToastManager();
    function Toasts(props: { Sibling: ToggledSibling }) {
      const { toasts } = Toast.useToastManager();
      return (
        <For each={toasts()}>
          {(toast) => (
            <Toast.Root toast={toast}>
              <Toast.Content>
                <Toast.Title />
                <props.Sibling />
                <Toast.Description />
                <Toast.Close>Dismiss</Toast.Close>
              </Toast.Content>
            </Toast.Root>
          )}
        </For>
      );
    }
    expectKept(
      (Sibling) => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport>
            <Toasts Sibling={Sibling} />
          </Toast.Viewport>
        </Toast.Provider>
      ),
      () => manager.add({ id: 'a', title: 'Title', description: 'Description' }),
    );
  });

  it('Field and Fieldset parts, with two errors shown', () => {
    expectKept((Sibling) => (
      <Fieldset.Root>
        <Fieldset.Legend>Legend</Fieldset.Legend>
        <Sibling />
        <Field.Root invalid>
          <Field.Label>Name</Field.Label>
          <Field.Control />
          <Sibling />
          <Field.Description>Help</Field.Description>
          <Field.Error match>First</Field.Error>
          <Field.Error match>Second</Field.Error>
        </Field.Root>
      </Fieldset.Root>
    ));
  });

  it('Collapsible and Accordion parts, open', () => {
    expectKept((Sibling) => (
      <>
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Sibling />
          <Collapsible.Panel>Panel</Collapsible.Panel>
        </Collapsible.Root>
        <Accordion.Root defaultValue={['a']}>
          <Accordion.Item value="a">
            <Accordion.Header>
              <Accordion.Trigger>A</Accordion.Trigger>
            </Accordion.Header>
            <Sibling />
            <Accordion.Panel>Panel A</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      </>
    ));
  });

  it('Tabs parts', () => {
    expectKept((Sibling) => (
      <Tabs.Root defaultValue="a">
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Sibling />
          <Tabs.Tab value="b">B</Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Panel value="a">Panel A</Tabs.Panel>
        <Sibling />
        <Tabs.Panel value="b">Panel B</Tabs.Panel>
      </Tabs.Root>
    ));
  });

  it('toggles, checkbox, radio and switch parts, checked', () => {
    expectKept((Sibling) => (
      <>
        <ToggleGroup defaultValue={['a']}>
          <Toggle value="a">A</Toggle>
          <Sibling />
          <Toggle value="b">B</Toggle>
        </ToggleGroup>
        <Checkbox.Root defaultChecked>
          <Checkbox.Indicator />
          <Sibling />
        </Checkbox.Root>
        <RadioGroup defaultValue="a">
          <Radio.Root value="a">
            <Radio.Indicator />
            <Sibling />
          </Radio.Root>
          <Sibling />
          <Radio.Root value="b" />
        </RadioGroup>
        <Switch.Root defaultChecked>
          <Switch.Thumb />
          <Sibling />
        </Switch.Root>
      </>
    ));
  });

  it('static parts', () => {
    expectKept((Sibling) => (
      <>
        <Separator />
        <Sibling />
        <Progress.Root value={40}>
          <Progress.Track>
            <Progress.Indicator />
            <Sibling />
          </Progress.Track>
        </Progress.Root>
        <Meter.Root value={40}>
          <Meter.Track>
            <Meter.Indicator />
            <Sibling />
          </Meter.Track>
        </Meter.Root>
      </>
    ));
  });

  it('popup triggers, closed', () => {
    expectKept((Sibling) => (
      <>
        <Popover.Root>
          <Popover.Trigger>Popover</Popover.Trigger>
          <Sibling />
        </Popover.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>Tooltip</Tooltip.Trigger>
          <Sibling />
        </Tooltip.Root>
        <PreviewCard.Root>
          <PreviewCard.Trigger href="#card">Card</PreviewCard.Trigger>
          <Sibling />
        </PreviewCard.Root>
        <Dialog.Root>
          <Dialog.Trigger>Dialog</Dialog.Trigger>
          <Sibling />
        </Dialog.Root>
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <Sibling />
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </>
    ));
  });

  it('open Select, Menu and Combobox items', () => {
    expectKept((Sibling) => (
      <>
        <Select.Root open defaultValue="a">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">
                  <Select.ItemIndicator />
                  <Sibling />
                  <Select.ItemText>A</Select.ItemText>
                </Select.Item>
                <Sibling />
                <Select.Item value="b">
                  <Select.ItemText>B</Select.ItemText>
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <Menu.Root open>
          <Menu.Trigger>Menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>One</Menu.Item>
                <Sibling />
                <Menu.Item>Two</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Combobox.Root open items={['a', 'b']}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">A</Combobox.Item>
                  <Sibling />
                  <Combobox.Item value="b">B</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </>
    ));
  });
});
