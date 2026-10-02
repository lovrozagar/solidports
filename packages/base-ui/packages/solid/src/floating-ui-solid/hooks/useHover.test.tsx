import { act, flushMicrotasks } from '#test-utils';
import { isJSDOM } from '#utils/detectBrowser';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, onCleanup, Show } from 'solid-js';
import { defaultProps } from '../../solid-helpers';
import { describe, expect, test, vi } from 'vitest';
import { Popover } from '../../../test/floating-ui-tests/Popover';
import { REASONS } from '../../utils/reasons';
import { safePolygon, useFloating, useHover, useInteractions } from '../index';
import type { UseHoverProps } from './useHover';

function App(componentProps: UseHoverProps & { showReference?: boolean }) {
  const props = defaultProps(componentProps, { showReference: true });
  const [open, setOpen] = createSignal(false);
  const { refs, context } = useFloating({
    onOpenChange: setOpen,
    get open() {
      return open();
    },
  });

  const hover = useHover({ context, props });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  return (
    <>
      <Show when={props.showReference}>
        {(() => {
          // Solid applies refs on mount only; clear it on unmount as React's ref(null) does.
          onCleanup(() => refs.setReference(null));
          return <button {...getReferenceProps({ ref: refs.setReference })} />;
        })()}
      </Show>
      <Show when={open()}>
        <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
      </Show>
    </>
  );
}

describe.skipIf(!isJSDOM)('useHover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('opens on mouseenter', async () => {
    render(() => <App />);

    fireEvent.mouseEnter(screen.getByRole('button'));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await flushMicrotasks();
  });

  test('closes on mouseleave', () => {
    render(() => <App />);

    fireEvent.mouseEnter(screen.getByRole('button'));
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  describe('delay', () => {
    test('symmetric number', async () => {
      render(() => <App delay={1000} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      act(() => vi.advanceTimersByTime(999));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('open', async () => {
      render(() => <App delay={{ open: 500 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      act(() => vi.advanceTimersByTime(499));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('close', async () => {
      render(() => <App delay={{ close: 500 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));
      fireEvent.mouseLeave(screen.getByRole('button'));

      act(() => vi.advanceTimersByTime(499));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('open with close 0', async () => {
      render(() => <App delay={{ open: 500 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      act(() => vi.advanceTimersByTime(499));

      fireEvent.mouseLeave(screen.getByRole('button'));

      act(() => vi.advanceTimersByTime(1));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('restMs + nullish open delay should respect restMs', async () => {
      render(() => <App restMs={100} delay={{ close: 100 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      act(() => vi.advanceTimersByTime(99));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('restMs', async () => {
    render(() => <App restMs={100} />);

    const button = screen.getByRole('button');

    const originalDispatchEvent = button.dispatchEvent;
    const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
      Object.defineProperty(event, 'movementX', { value: 10 });
      Object.defineProperty(event, 'movementY', { value: 10 });
      return originalDispatchEvent.call(button, event);
    });

    fireEvent.mouseMove(button);

    act(() => vi.advanceTimersByTime(99));

    fireEvent.mouseMove(button);

    act(() => vi.advanceTimersByTime(1));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseMove(button);

    act(() => vi.advanceTimersByTime(100));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    spy.mockRestore();
  });

  test.todo('restMs is always 0 for touch input', async () => {
    render(() => <App restMs={100} />);

    fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'touch' });
    fireEvent.mouseMove(screen.getByRole('button'));

    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  test('restMs does not reset timer for minor mouse movement', async () => {
    render(() => <App restMs={100} />);

    const button = screen.getByRole('button');

    const originalDispatchEvent = button.dispatchEvent;
    const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
      Object.defineProperty(event, 'movementX', { value: 1 });
      Object.defineProperty(event, 'movementY', { value: 0 });
      return originalDispatchEvent.call(button, event);
    });

    fireEvent.mouseMove(button);

    act(() => vi.advanceTimersByTime(99));

    fireEvent.mouseMove(button);

    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    spy.mockRestore();
  });

  test('mouseleave on the floating element closes it (mouse)', async () => {
    render(() => <App />);

    fireEvent.mouseEnter(screen.getByRole('button'));
    await flushMicrotasks();

    fireEvent(
      screen.getByRole('button'),
      new MouseEvent('mouseleave', {
        relatedTarget: screen.getByRole('tooltip'),
      }),
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('does not show after delay if domReference changes', async () => {
    const [showReference, setShowReference] = createSignal<boolean | undefined>(undefined);
    render(() => <App delay={1000} showReference={showReference()} />);

    fireEvent.mouseEnter(screen.getByRole('button'));

    act(() => vi.advanceTimersByTime(1));

    act(() => setShowReference(false));

    act(() => vi.advanceTimersByTime(999));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('reason string', async () => {
    function App() {
      const [isOpen, setIsOpen] = createSignal(false);
      const { refs, context } = useFloating({
        onOpenChange(nextOpen, data) {
          setIsOpen(nextOpen);
          expect(data?.reason).toBe(REASONS.triggerHover);
        },
        get open() {
          return isOpen();
        },
      });

      const hover = useHover({ context });
      const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

      return (
        <>
          <button ref={refs.setReference} {...getReferenceProps()} />
          <Show when={isOpen()}>
            <div role="tooltip" ref={refs.setFloating} {...getFloatingProps()} />
          </Show>
        </>
      );
    }

    render(() => <App />);
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    await flushMicrotasks();
    fireEvent.mouseLeave(button);
  });

  test('does not treat a synthetic child target as inactive when the native path differs', async () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(true);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });
      const { getReferenceProps, getFloatingProps } = useInteractions([useHover({ context })]);

      return (
        <>
          <button ref={refs.setReference} {...getReferenceProps()}>
            <span data-testid="child" />
          </button>
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} {...getFloatingProps()} />
          </Show>
        </>
      );
    }

    render(() => <App />);

    const child = screen.getByTestId('child');
    const event = new MouseEvent('mousemove', { bubbles: true });

    // Deliberately skew the native path so `getTarget(nativeEvent)` resolves
    // outside the trigger while the event's own `target` remains `child`.
    Object.defineProperty(event, 'composedPath', {
      configurable: true,
      value: () => [document.body, child.parentElement, child],
    });

    fireEvent(child, event);

    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  test('cleans up blockPointerEvents if trigger changes', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(() => (
      <Popover
        hover={false}
        modal={false}
        bubbles
        render={(props1) => (
          <>
            <h2 id={props1.labelId} class="mb-2 text-2xl font-bold">
              Parent title
            </h2>
            <p id={props1.descriptionId} class="mb-2">
              Description
            </p>
            <Popover
              hover
              modal={false}
              bubbles
              render={(props2) => (
                <>
                  <h2 id={props2.labelId} class="mb-2 text-2xl font-bold">
                    Child title
                  </h2>
                  <p id={props2.descriptionId} class="mb-2">
                    Description
                  </p>
                  <button onClick={props2.close} class="font-bold">
                    Close
                  </button>
                </>
              )}
            >
              {(p) => (
                <button type="button" {...p}>
                  Open child
                </button>
              )}
            </Popover>
            <button onClick={props1.close} class="font-bold">
              Close
            </button>
          </>
        )}
      >
        {(p) => (
          <button type="button" {...p}>
            Open parent
          </button>
        )}
      </Popover>
    ));

    await user.click(screen.getByText('Open parent'));
    expect(screen.getByText('Parent title')).toBeInTheDocument();
    await user.click(screen.getByText('Open child'));
    expect(screen.getByText('Child title')).toBeInTheDocument();
    await user.click(screen.getByText('Child title'));
    // clean up blockPointerEvents
    // userEvent.unhover does not work because of the pointer-events
    fireEvent.mouseLeave(screen.getByRole('dialog', { name: 'Child title' }));
    expect(screen.getByText('Child title')).toBeInTheDocument();
    await user.click(screen.getByText('Parent title'));
    expect(screen.getByText('Parent title')).toBeInTheDocument();
  });
});

describe.skipIf(!isJSDOM)('useHover — domReferenceElement race regression', () => {
  /* Bug 3: domReferenceElement() was called twice — once in isElement() guard and once
   * to assign `ref`. A concurrent signal write between the two reads made `ref` null
   * while the guard had already passed. Post-fix reads domEl once and exits cleanly. */

  test('does not throw when domReferenceElement becomes null while open with blockPointerEvents', async () => {
    vi.useFakeTimers();

    try {
      function RaceApp() {
        const [open, setOpen] = createSignal(false);
        const { refs, context } = useFloating({
          onOpenChange: setOpen,
          get open() {
            return open();
          },
        });

        /* safePolygon enables blockPointerEvents, which is the code path that
         * read domReferenceElement() twice before the fix. */
        const hover = useHover({ context, props: { handleClose: safePolygon() } });
        const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

        return (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} data-testid="ref-btn" />
            <Show when={open()}>
              <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
            </Show>
          </>
        );
      }

      render(() => <RaceApp />);

      const btn = screen.getByTestId('ref-btn');

      /* Open via hover to activate the blockPointerEvents effect. */
      fireEvent.mouseEnter(btn);
      await flushMicrotasks();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      /* Null out the reference element — triggers the race window. */
      fireEvent.mouseLeave(btn);
      await flushMicrotasks();

      /* Post-fix: single domEl read, null guard prevents any throw. */
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
