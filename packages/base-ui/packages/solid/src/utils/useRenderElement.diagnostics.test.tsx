import { act, createRenderer, flushMicrotasks, isJSDOM } from '#test-utils';
import { fireEvent, screen } from '@solidjs/testing-library';
import { For, flush } from 'solid-js';
import { attribution } from 'solid-js/attribution';
import { afterAll, beforeAll, beforeEach, expect, vi } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Avatar } from '@solidports/base-ui/avatar';
import { Combobox } from '@solidports/base-ui/combobox';
import { Drawer } from '@solidports/base-ui/drawer';
import { Field } from '@solidports/base-ui/field';
import { Input } from '@solidports/base-ui/input';
import { Menu } from '@solidports/base-ui/menu';
import { Menubar } from '@solidports/base-ui/menubar';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { OTPField } from '@solidports/base-ui/otp-field';
import { Popover } from '@solidports/base-ui/popover';
import { Select } from '@solidports/base-ui/select';
import { Tabs } from '@solidports/base-ui/tabs';
import { Toast } from '@solidports/base-ui/toast';

/**
 * Solid's dev diagnostics (the attribution engine `vite dev` enables) must stay silent while the
 * heaviest parts mount and update: no relayed or self-written state, no over-wide subscriptions.
 */
describe('Solid dev diagnostics', () => {
  const { render } = createRenderer();
  const warnings: string[] = [];

  // Browsers report finished animations through `getAnimations()` promises, so open-change
  // completions land after the effect. The test setup disables animations and jsdom has no
  // `getAnimations`, so Base UI would complete synchronously inside the effect, a relay a
  // browser never runs; model the browser instead.
  const hadGetAnimations = 'getAnimations' in Element.prototype;
  let animationsDisabled: boolean;

  beforeAll(() => {
    attribution.enable();
    animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
    if (!hadGetAnimations) {
      Object.defineProperty(Element.prototype, 'getAnimations', {
        configurable: true,
        value: () => [],
      });
    }
  });

  afterAll(() => {
    attribution.disable();
    globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    if (!hadGetAnimations) {
      delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
    }
  });

  // Per test: the shared setup resets every mock after each test.
  beforeEach(() => {
    warnings.length = 0;
    const original = console.warn;
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? '');
      if (/^\[[A-Z_]+\]/.test(message)) {
        // `FLUSH_IN_EFFECT_CALLBACK` comes from the test harness: testing-library's event wrapper
        // flushes after events, including events an effect dispatches (`element.focus()`).
        if (
          !message.startsWith('[FLUSH_IN_EFFECT_CALLBACK]') &&
          !/repair guide|deeper evidence/.test(message)
        ) {
          warnings.push(message.split('\n').slice(0, 2).join(' | '));
        }
        return;
      }
      original(...args);
    });
  });

  async function settle() {
    flush();
    await flushMicrotasks();
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    flush();
  }

  it('OTPField.Input stays silent while typing', async () => {
    const { user } = render(() => (
      <OTPField.Root length={4}>
        <OTPField.Input />
        <OTPField.Input />
        <OTPField.Input />
        <OTPField.Input />
      </OTPField.Root>
    ));
    await user.click(screen.getAllByRole('textbox')[0]);
    await user.keyboard('1234');
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a Combobox with a field-aware input stays silent', async () => {
    const { user } = render(() => (
      <Field.Root name="country">
        <Combobox.Root items={['France', 'Germany']}>
          <Combobox.Input render={(props) => <Input {...props} data-testid="input" />} />
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
      </Field.Root>
    ));
    await user.click(screen.getByTestId('input'));
    await user.click(await screen.findByRole('option', { name: 'France' }));
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a detached Popover.Trigger stays silent while opening and closing', async () => {
    const handle = Popover.createHandle();
    const { user } = render(() => (
      <>
        <Popover.Trigger handle={handle}>Trigger</Popover.Trigger>
        <Popover.Root handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    ));
    await user.click(screen.getByRole('button', { name: 'Trigger' }));
    await screen.findByTestId('popup');
    await settle();
    await user.keyboard('{Escape}');
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a Menu with a submenu stays silent', async () => {
    const { user } = render(() => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>One</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Nested</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('menuitem', { name: 'More' }));
    await screen.findByRole('menuitem', { name: 'Nested' });
    await settle();
    await user.keyboard('{Escape}');
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a Select stays silent while picking a value', async () => {
    const items = [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ];
    const { user } = render(() => (
      <Select.Root items={items}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              {items.map((item) => (
                <Select.Item value={item.value}>
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    fireEvent.click(screen.getByTestId('trigger'));
    await user.click(await screen.findByRole('option', { name: 'Banana' }));
    await settle();
    expect(warnings).toEqual([]);
  });
  it('an Avatar stays silent while its image loads', async () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image src="https://example.com/avatar.png" />
        <Avatar.Fallback>LZ</Avatar.Fallback>
      </Avatar.Root>
    ));
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a Toast stays silent while toasts are added and closed', async () => {
    const manager = Toast.createToastManager();

    function List() {
      return (
        <For each={Toast.useToastManager().toasts()}>
          {(toast) => (
            <Toast.Root toast={toast}>
              <Toast.Title />
            </Toast.Root>
          )}
        </For>
      );
    }

    render(() => (
      <Toast.Provider toastManager={manager}>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await act(async () => {
      manager.add({ id: 'one', title: 'One', priority: 'high' });
    });
    await act(async () => {
      manager.add({ id: 'two', title: 'Two' });
    });
    await settle();
    await act(async () => manager.close('one'));
    await settle();
    expect(warnings).toEqual([]);
  });
  it('a Combobox with a long list stays silent', async () => {
    const items = Array.from({ length: 60 }, (_, index) => `Item ${index}`);
    const { user } = render(() => (
      <Combobox.Root items={items}>
        <Combobox.Input data-testid="input" />
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
    ));
    await user.click(screen.getByTestId('input'));
    await screen.findByRole('option', { name: 'Item 0' });
    await user.keyboard('{ArrowDown}{ArrowDown}');
    await user.keyboard('Item 1');
    await settle();
    expect(warnings).toEqual([]);
  });

  it('an Autocomplete stays silent while typing', async () => {
    const items = ['Apple', 'Banana', 'Cherry'];
    const { user } = render(() => (
      <Field.Root name="fruit">
        <Autocomplete.Root items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => <Autocomplete.Item value={item}>{item}</Autocomplete.Item>}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>
    ));
    await user.click(screen.getByTestId('input'));
    await user.keyboard('a');
    await user.keyboard('{ArrowDown}{Enter}');
    await settle();
    expect(warnings).toEqual([]);
  });

  // Panels with close motion, as styled panels are: a panel without motion unmounts one flush after
  // it closes, measured from its rendered element (React does the same in a layout effect), which
  // Solid reports as the cost of measuring. Browser-only: the close sequence reads computed styles
  // and layout, which jsdom does not have.
  it.skipIf(isJSDOM)('an Accordion stays silent while panels open and close', async () => {
    const { user } = render(() => (
      <Accordion.Root>
        <style>{'.panel { transition: height 1ms; }'}</style>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>One</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel class="panel">Panel one</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="two">
          <Accordion.Header>
            <Accordion.Trigger>Two</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel class="panel">Panel two</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await user.click(screen.getByRole('button', { name: 'One' }));
    await settle();
    await user.click(screen.getByRole('button', { name: 'Two' }));
    await settle();
    await user.click(screen.getByRole('button', { name: 'Two' }));
    await settle();
    expect(warnings).toEqual([]);
  });

  it('Tabs stay silent while switching tabs', async () => {
    const { user } = render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Panel value="one">Panel one</Tabs.Panel>
        <Tabs.Panel value="two">Panel two</Tabs.Panel>
      </Tabs.Root>
    ));
    await user.click(screen.getByRole('tab', { name: 'Two' }));
    await settle();
    await user.click(screen.getByRole('tab', { name: 'One' }));
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a NavigationMenu stays silent while switching items', async () => {
    const { user } = render(() => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
            <NavigationMenu.Content>Content one</NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="two">
            <NavigationMenu.Trigger>Two</NavigationMenu.Trigger>
            <NavigationMenu.Content>Content two</NavigationMenu.Content>
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
    ));
    await user.click(screen.getByRole('button', { name: 'One' }));
    await settle();
    await user.click(screen.getByRole('button', { name: 'Two' }));
    await settle();
    await user.keyboard('{Escape}');
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a Menubar stays silent while moving between menus', async () => {
    const { user } = render(() => (
      <Menubar>
        <Menu.Root>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>New</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger>Edit</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Undo</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menubar>
    ));
    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await screen.findByRole('menuitem', { name: 'New' });
    await settle();
    await user.hover(screen.getByRole('menuitem', { name: 'Edit' }));
    await settle();
    await user.keyboard('{Escape}');
    await settle();
    expect(warnings).toEqual([]);
  });

  it('a Drawer stays silent while opening and closing', async () => {
    const { user } = render(() => (
      <Drawer.Root>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <Drawer.Title>Title</Drawer.Title>
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('dialog');
    await settle();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await settle();
    expect(warnings).toEqual([]);
  });
});
