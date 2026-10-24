/*
 * A trigger's deferred safe-polygon mutation (`handleActivation` applies it in a microtask when the
 * hover moves between triggers) must not outlive the trigger: unmounted in the same tick, it would
 * leave the scope (the document body) with `pointer-events: none`, so the page takes no clicks.
 * Both paths: the native trigger and the slow one (`part`).
 */
import { createSignal, flush, Show } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { createRenderer } from '#test-utils';
import { part } from '../../../test/parityHarness';

const trigger = (name: string) =>
  document.querySelector<HTMLElement>(`[data-testid="trigger-${name}"]`)!;

/** Every element left with `pointer-events: none` (the safe polygon's scope). */
const blocked = () =>
  [...new Set([document.body, ...document.querySelectorAll<HTMLElement>('[style]')])]
    .filter((el) => el.style.pointerEvents === 'none')
    .map((el) => el.tagName.toLowerCase());

afterEach(() => {
  document.body.style.removeProperty('pointer-events');
});

describe.each([
  ['native', false],
  ['slow', true],
] as const)('a %s NavigationMenu.Trigger unmounted in the hover tick', (_path, slow) => {
  const { render } = createRenderer();

  function mount(showB: () => boolean) {
    const item = (name: string) => (
      <NavigationMenu.Item value={name}>
        {part(NavigationMenu.Trigger, slow, 'button', {
          'data-testid': `trigger-${name}`,
          children: name,
        })}
        <NavigationMenu.Content>{name}</NavigationMenu.Content>
      </NavigationMenu.Item>
    );
    return render(() => (
      <NavigationMenu.Root defaultValue="a">
        <NavigationMenu.List>
          {item('a')}
          <Show when={showB()}>{item('b')}</Show>
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
  }

  it('leaves the body clean when the whole menu unmounts', async () => {
    const view = mount(() => true);
    flush();
    fireEvent.mouseEnter(trigger('b'));
    view.unmount();
    await Promise.resolve();
    expect(blocked()).toEqual([]);
  });

  it('leaves the body clean when only the trigger unmounts', async () => {
    const [showB, setShowB] = createSignal(true);
    mount(showB);
    flush();
    fireEvent.mouseEnter(trigger('b'));
    setShowB(false);
    flush();
    await Promise.resolve();
    expect(blocked()).toEqual([]);
  });
});
