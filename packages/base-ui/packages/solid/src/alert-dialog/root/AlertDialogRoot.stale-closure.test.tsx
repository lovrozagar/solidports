import { act, createRenderer } from '#test-utils';
import { AlertDialog } from '@solidports/base-ui/alert-dialog';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AlertDialogRoot stale-closure regression', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('invokes the latest onOpenChange after prop swap', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const [cb, setCb] = createSignal(() => cb1);

    const { user } = render(() => (
      <AlertDialog.Root onOpenChange={cb()}>
        <AlertDialog.Trigger data-testid="trigger">Open</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Close data-testid="close">Close</AlertDialog.Close>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));

    await user.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    expect(cb1).toHaveBeenCalledTimes(1);

    act(() => setCb(() => cb2));

    await user.click(screen.getByTestId('close'));

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });

    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledTimes(1);
  });
});
