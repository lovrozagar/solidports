import { vi, describe, it, expect } from 'vitest';
import { createSignal, Show } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { act, createRenderer, describeConformance, flushMicrotasks } from '#test-utils';

describe('<NavigationMenu.List />', () => {
  const { render } = createRenderer();

  describeConformance(NavigationMenu.List, () => ({
    refInstanceof: window.HTMLUListElement,
    render: (node, props) =>
      render(() => <NavigationMenu.Root>{node(props!)}</NavigationMenu.Root>),
  }));

  it('throws a descriptive error when rendered outside <NavigationMenu.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() => render(() => <NavigationMenu.List />)).toThrow(
        'Base UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('stops vertical navigation keys from escaping the list', async () => {
    const handleKeyDown = vi.fn();

    await render(() => (
      <div onKeyDown={handleKeyDown}>
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List data-testid="list">
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Item</NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    ));

    const trigger = screen.getByRole('button', { name: 'Item' });
    await act(() => {
      trigger.focus();
    });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(handleKeyDown.mock.calls.length).toBe(0);

    fireEvent.keyDown(trigger, { key: 'PageDown' });

    expect(handleKeyDown.mock.calls.length).toBe(1);
  });

  describe('item removal', () => {
    function App(props: { showFirst: boolean }) {
      return (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <Show when={props.showFirst}>
              <NavigationMenu.Item>
                <NavigationMenu.Trigger data-testid="first">One</NavigationMenu.Trigger>
              </NavigationMenu.Item>
            </Show>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger data-testid="middle">Two</NavigationMenu.Trigger>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger data-testid="last">Three</NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      );
    }

    it('navigates from the focused trigger after an earlier item is removed', async () => {
      const [showFirst, setShowFirst] = createSignal(true);
      await render(() => <App showFirst={showFirst()} />);

      const first = screen.getByTestId('first');
      await act(async () => {
        first.focus();
      });

      fireEvent.keyDown(first, { key: 'ArrowRight' });
      await flushMicrotasks();

      const middle = screen.getByTestId('middle');
      fireEvent.keyDown(middle, { key: 'ArrowRight' });
      await flushMicrotasks();

      const last = screen.getByTestId('last');
      expect(last).toHaveFocus();

      await act(() => {
        setShowFirst(false);
      });

      fireEvent.keyDown(last, { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(middle).toHaveFocus();
    });
  });
});
