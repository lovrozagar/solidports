/*
 * What a menu's main interactions re-run in an open Menu (D32's fan-out gate): a highlight move
 * re-runs the old and the new item's readers (`isActive` is keyed), and a radio choice re-runs only
 * the radio items whose checked state changed. Neither the active index's nor the radio value's
 * subscribers grow with the number of items.
 */
import { createRenderEffect, createRoot, createSignal, DEV, flush, getOwner } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer } from '#test-utils';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRootContext } from '../root/MenuRootContext';
import { useMenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';
import type { MenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';

/** The computations other than a probe's that read what `read` reads. */
function subscribers(read: () => void) {
  let probe: unknown;
  const dispose = createRoot((disposeRoot) => {
    createRenderEffect(
      () => {
        probe = getOwner();
        read();
      },
      () => {},
    );
    return disposeRoot;
  });
  onTestFinished(dispose);
  return () =>
    (DEV!.getSources(probe as never) as unknown[]).reduce<number>(
      (count, source) =>
        count +
        (DEV!.getObservers(source as never) as unknown[]).filter((observer) => observer !== probe)
          .length,
      0,
    );
}

describe('Menu: an interaction re-runs only the items whose state changed', () => {
  const { render } = createRenderer();

  function mountItems(count: number) {
    let root!: MenuRootContext;
    function RootProbe() {
      root = useMenuRootContext();
      return null;
    }
    const items = Array.from({ length: count }, (_, i) => `Item ${i}`);
    const view = render(() => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <RootProbe />
              {/* eslint-disable-next-line solid/prefer-for -- the list never changes: written as the bench's menu/500 fixture writes it */}
              {items.map((item) => (
                <Menu.Item>{item}</Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();
    const activeSubscribers = subscribers(() => root.store.state.activeIndex);
    const hover = (index: number) => {
      fireEvent.mouseMove(screen.getAllByRole('menuitem')[index]);
      flush();
    };
    const highlighted = () =>
      screen
        .getAllByRole('menuitem')
        .filter((item) => item.hasAttribute('data-highlighted'))
        .map((item) => item.textContent);
    return { activeSubscribers, hover, highlighted, unmount: view.unmount };
  }

  function mountRadios(count: number) {
    let group!: MenuRadioGroupContext;
    function GroupProbe() {
      group = useMenuRadioGroupContext();
      return null;
    }
    const values = Array.from({ length: count }, (_, i) => `radio-${i}`);
    const [value, setValue] = createSignal<string | null>(null);
    const view = render(() => (
      <Menu.Root open>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.RadioGroup value={value()}>
                <GroupProbe />
                {/* eslint-disable-next-line solid/prefer-for -- the list never changes */}
                {values.map((item) => (
                  <Menu.RadioItem value={item}>{item}</Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    flush();
    const valueSubscribers = subscribers(() => group.value());
    const set = (next: string) => {
      setValue(next);
      flush();
    };
    const checked = () =>
      screen
        .getAllByRole('menuitemradio', { checked: true })
        .map((item) => item.textContent);
    return { valueSubscribers, set, checked, unmount: view.unmount };
  }

  it('the active index has as many subscribers at 300 items as at 30', () => {
    const small = mountItems(30);
    small.hover(20);
    small.hover(3);
    expect(small.highlighted()).toEqual(['Item 3']);
    const few = small.activeSubscribers();
    small.unmount();
    const large = mountItems(300);
    large.hover(200);
    large.hover(3);
    expect(large.highlighted()).toEqual(['Item 3']);
    expect(few).toBe(6);
    expect(large.activeSubscribers()).toBe(few);
    large.unmount();
  });

  it('a radio group value has as many subscribers at 300 radio items as at 30', () => {
    const small = mountRadios(30);
    small.set('radio-20');
    small.set('radio-3');
    expect(small.checked()).toEqual(['radio-3']);
    const few = small.valueSubscribers();
    small.unmount();
    const large = mountRadios(300);
    large.set('radio-200');
    large.set('radio-3');
    expect(large.checked()).toEqual(['radio-3']);
    expect(few).toBe(1);
    expect(large.valueSubscribers()).toBe(few);
    large.unmount();
  });
});
