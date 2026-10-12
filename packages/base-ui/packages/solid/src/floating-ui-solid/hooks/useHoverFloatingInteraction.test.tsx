import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal, Show } from 'solid-js';
import { act, flushMicrotasks, isJSDOM } from '#test-utils';
import { useFloating } from '../../../test/floating-ui-tests/useFloating';
import { useHoverFloatingInteraction } from './useHoverFloatingInteraction';
import { useHoverReferenceInteraction } from './useHoverReferenceInteraction';

describe.skipIf(!isJSDOM)('useHoverFloatingInteraction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Solid: `triggerElementRef` takes the element through a getter, so it is kept in a signal.
  function App(props: { closeDelay?: number }) {
    const [open, setOpen] = createSignal(false);
    const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
    const { refs, context } = useFloating({
      get open() {
        return open();
      },
      onOpenChange: setOpen,
    });
    const referenceProps = useHoverReferenceInteraction({
      context,
      props: {
        get triggerElementRef() {
          return triggerElement();
        },
        get delay() {
          return { close: props.closeDelay };
        },
      },
    });
    useHoverFloatingInteraction({
      context,
      parameters: {
        get closeDelay() {
          return props.closeDelay;
        },
      },
    });

    return (
      <>
        <button
          {...referenceProps}
          ref={(node) => {
            refs.setReference(node);
            setTriggerElement(node);
          }}
        />
        <Show when={open()}>
          <div role="tooltip" ref={refs.setFloating} />
        </Show>
      </>
    );
  }

  it('closes after the close delay when the pointer leaves the floating element', async () => {
    render(() => <App closeDelay={100} />);

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    await flushMicrotasks();

    const tooltip = screen.getByRole('tooltip');
    fireEvent(button, new MouseEvent('mouseleave', { relatedTarget: tooltip }));
    fireEvent.mouseEnter(tooltip);
    fireEvent.mouseLeave(tooltip);

    await act(async () => {
      vi.advanceTimersByTime(99);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the popup open when the floating element is entered before closeDelay elapses', async () => {
    render(() => <App closeDelay={500} />);

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    await flushMicrotasks();

    const tooltip = screen.getByRole('tooltip');
    fireEvent(button, new MouseEvent('mouseleave', { relatedTarget: tooltip }));

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    fireEvent.mouseEnter(tooltip);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(tooltip);

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
