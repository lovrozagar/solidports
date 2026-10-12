import { createSignal, flush } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { createRenderer, flushMicrotasks } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { getMenuFilterKeyAction } from '../filter-root/useMenuFilterKeyDown';
import { isKeyboardClick, isKeyboardOpen } from '../utils/isKeyboardOpen';
import { REASONS } from '../../utils/reasons';

describe('Menu filtering', () => {
  const { render } = createRenderer();

  function FilterMenu(props: {
    value?: string;
    onValueChange?: (value: string) => void;
    autoHighlight?: boolean | 'always';
    filter?: ((text: string, query: string) => boolean) | null;
  }) {
    return (
      <Menu.FilterProvider
        value={props.value}
        onValueChange={(next) => props.onValueChange?.(next)}
        autoHighlight={props.autoHighlight}
        filter={props.filter}
      >
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter" />
                <Menu.List>
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.Item>Apricot</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                  <Menu.Empty>Nothing matches</Menu.Empty>
                </Menu.List>
                <Menu.Clear aria-label="Clear" />
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    );
  }

  it('filters items, clears the query, and shows the empty message', async () => {
    const [value, setValue] = createSignal('');
    const { user } = render(() => (
      <FilterMenu value={value()} onValueChange={setValue} autoHighlight />
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const input = screen.getByRole('searchbox', { name: 'Filter' });
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    await user.type(input, 'ap');
    flush();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Apple',
      'Apricot',
    ]);

    await user.clear(input);
    await user.type(input, 'zzz');
    flush();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();

    fireEvent.click(document.querySelector('[aria-label="Clear"]')!);
    flush();
    expect(value()).toBe('');
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('requires the filter parts to be inside a provider', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() =>
        render(() => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )),
      ).toThrow(/<Menu\.Input> must be placed in a menu wrapped in <Menu\.FilterProvider>/);
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('exposes the default string filter', () => {
    expect(Menu.useFilter().contains('Apple', 'app')).toBe(true);
    expect(Menu.useFilter().contains('Apple', 'ban')).toBe(false);
  });

  it('moves the highlight from the input and activates the highlighted item', async () => {
    const onClick = vi.fn();
    const { user } = render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter" />
                <Menu.List>
                  <Menu.Item onClick={onClick}>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    const input = screen.getByRole('searchbox', { name: 'Filter' });
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    flush();
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Enter' });
    flush();
    expect(onClick).toHaveBeenCalled();
  });

  it('renders a plain list without a filter provider', () => {
    render(() => (
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.List>
                <Menu.Item>Apple</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Apple' })).toBeTruthy();
  });

  it('hides a group once every item in it is filtered out', async () => {
    const { user } = render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter" />
                <Menu.List>
                  <Menu.Group data-testid="fruit">
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.Group>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filter' }), 'ban');
    flush();
    expect(document.querySelector('[data-testid="fruit"]')).toHaveProperty('hidden', true);
  });

  it('keeps a plain submenu trigger as a menu and a filterable one as a dialog', async () => {
    const { user } = render(() => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter" />
                <Menu.List>
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
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>Search</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Subfilter" />
                            <Menu.List>
                              <Menu.Item>Inside</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('menuitem', { name: 'More' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.getByRole('menuitem', { name: 'Search' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
  });
});

describe('getMenuFilterKeyAction', () => {
  const base = {
    orientation: 'vertical' as const,
    rtl: false,
    hasActiveItem: false,
    activeItemOpensSubmenu: false,
    hasValue: false,
  };

  function key(name: string, init: KeyboardEventInit = {}, which?: number) {
    const event = new KeyboardEvent('keydown', { key: name, ...init });
    if (which != null) {
      Object.defineProperty(event, 'which', { value: which });
    }
    return event;
  }

  it('classifies editing, navigation, activation, and submenu keys', () => {
    expect(getMenuFilterKeyAction(key('a', {}, 229), base)).toBe('ignore');
    expect(getMenuFilterKeyAction(key('Tab'), base)).toBe('ignore');
    expect(getMenuFilterKeyAction(key('Tab', { shiftKey: true }), base)).toBe('close');
    expect(getMenuFilterKeyAction(key('Enter'), { ...base, hasActiveItem: true })).toBe('activate');
    expect(getMenuFilterKeyAction(key('Enter'), base)).toBe('navigate');
    expect(getMenuFilterKeyAction(key('ArrowDown', { shiftKey: true }), base)).toBe('edit');
    expect(getMenuFilterKeyAction(key('a', { ctrlKey: true }), base)).toBe('edit');
    expect(getMenuFilterKeyAction(key('Escape', { altKey: true }), base)).toBe('navigate');
    expect(getMenuFilterKeyAction(key('a'), base)).toBe('edit');
    expect(getMenuFilterKeyAction(key('Home'), { ...base, hasActiveItem: true })).toBe('navigate');
    expect(getMenuFilterKeyAction(key('End'), { ...base, hasValue: true })).toBe('edit');
    expect(getMenuFilterKeyAction(key('Home'), base)).toBe('edit');
    expect(getMenuFilterKeyAction(key('Escape'), base)).toBe('navigate');
    expect(getMenuFilterKeyAction(key('ArrowDown'), base)).toBe('navigate');
    expect(
      getMenuFilterKeyAction(key('ArrowLeft'), {
        ...base,
        orientation: 'horizontal',
        hasValue: true,
      }),
    ).toBe('edit');
    expect(
      getMenuFilterKeyAction(key('ArrowRight'), {
        ...base,
        hasActiveItem: true,
        activeItemOpensSubmenu: true,
      }),
    ).toBe('submenu');
    expect(getMenuFilterKeyAction(key('ArrowDown'), { ...base, orientation: 'horizontal' })).toBe(
      'enter-list',
    );
    expect(getMenuFilterKeyAction(key('ArrowLeft'), { ...base, hasValue: true })).toBe('edit');
    expect(getMenuFilterKeyAction(key('ArrowLeft'), base)).toBe('navigate');
  });
});

describe('isKeyboardOpen', () => {
  it('treats arrow navigation and detail-less clicks as keyboard opens', () => {
    expect(isKeyboardOpen(REASONS.listNavigation, undefined)).toBe(true);
    expect(isKeyboardClick(REASONS.itemPress, new MouseEvent('click', { detail: 0 }))).toBe(true);
    expect(isKeyboardClick(REASONS.triggerPress, new MouseEvent('click', { detail: 1 }))).toBe(
      false,
    );
    expect(isKeyboardOpen(REASONS.triggerHover, undefined)).toBe(false);
  });
});
