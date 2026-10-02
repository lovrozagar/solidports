import { expect, vi, beforeEach, afterEach, it } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';
import { act, isJSDOM } from '#test-utils';
import { useInteractions } from './useInteractions';
import { useFloating } from './useFloating';
import { useFocus } from './useFocus';

describe.skipIf(!isJSDOM)('useFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not reopen when focus is restored after leaving the tab', async () => {
    function App() {
      const [open, setOpen] = createSignal(false);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: setOpen,
      });
      const { getReferenceProps, getFloatingProps } = useInteractions([
        useFocus({ context, props: { delay: 100 } }),
      ]);

      return (
        <>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          <Show when={open()}>
            <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    const button = screen.getByRole('button');

    act(() => {
      button.focus();
    });

    window.dispatchEvent(new Event('blur'));
    fireEvent.focus(button);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole('tooltip')).toBe(null);
  });
});
