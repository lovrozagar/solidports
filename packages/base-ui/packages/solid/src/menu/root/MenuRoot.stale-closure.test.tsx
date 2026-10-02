import { act, createRenderer } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MenuRoot stale-closure regression', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('invokes the latest onOpenChangeComplete after prop swap', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const [cb, setCb] = createSignal<(open: boolean) => void>(() => cb1);

    const { user } = render(() => (
      <Menu.Root onOpenChangeComplete={cb()}>
        <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenLastCalledWith(true);

    act(() => setCb(() => cb2));

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenLastCalledWith(false);
    expect(cb1).toHaveBeenCalledTimes(1);
  });
});
