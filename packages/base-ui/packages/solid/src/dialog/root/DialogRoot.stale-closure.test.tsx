import { createRenderer } from '#test-utils';
import { Dialog } from '@solidports/base-ui/dialog';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DialogRoot stale-closure regression', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('invokes the latest onOpenChange after prop swap', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const [cb, setCb] = createSignal(cb1);

    const { user } = render(() => (
      <Dialog.Root onOpenChange={cb()}>
        <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Close data-testid="close">Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));

    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    expect(cb1).toHaveBeenCalledTimes(1);

    setCb(() => cb2);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledTimes(1);
  });
});
