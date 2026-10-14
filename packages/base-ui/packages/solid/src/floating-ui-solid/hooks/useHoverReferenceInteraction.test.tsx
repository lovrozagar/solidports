import { vi, expect, it, describe, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createRenderEffect, createSignal, Show } from 'solid-js';
import { act, flushMicrotasks, isJSDOM } from '#test-utils';
import { safePolygon } from '../safePolygon';
import { useHoverInteractionSharedState } from './useHoverInteractionSharedState';
import type { HoverInteraction } from './useHoverInteractionSharedState';
import { useHoverFloatingInteraction } from './useHoverFloatingInteraction';
import { useHoverReferenceInteraction } from './useHoverReferenceInteraction';
import type { UseHoverReferenceInteractionProps } from './useHoverReferenceInteraction';
import { mergeProps } from '../../solid-1-compat';
import { REASONS } from '../../utils/reasons';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { useFloating } from '../../../test/floating-ui-tests/useFloating';

// Solid: `triggerElementRef` takes the element through a getter, so the tests keep it in a signal.
describe.skipIf(!isJSDOM)('useHoverReferenceInteraction', () => {
  it('updates the handleClose options during render', () => {
    let hoverInteraction: HoverInteraction | undefined;
    const [block, setBlock] = createSignal(false);

    function App(props: { block: boolean }) {
      const { context } = useFloating();
      useHoverReferenceInteraction({
        context,
        props: {
          get handleClose() {
            return safePolygon({ blockPointerEvents: props.block });
          },
        },
      });
      [hoverInteraction] = useHoverInteractionSharedState({ store: context.rootStore });

      return null;
    }

    // Solid: the component does not re-render, so read the shared state after each flush.
    render(() => <App block={block()} />);
    expect(hoverInteraction?.handleCloseOptions?.blockPointerEvents).toBe(false);

    act(() => setBlock(true));
    expect(hoverInteraction?.handleCloseOptions?.blockPointerEvents).toBe(true);
  });

  it('does not treat child target as inactive when handlers are on a wrapper', async () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(true);
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      const hoverProps = useHoverReferenceInteraction({
        context,
        props: {
          mouseOnly: true,
          restMs: 100,
          delay: { close: 0 },
          move: false,
          get triggerElementRef() {
            return triggerElement();
          },
        },
      });

      return (
        <>
          <div data-testid="wrapper" {...hoverProps}>
            <button
              data-testid="trigger"
              ref={(node) => {
                refs.setReference(node);
                setTriggerElement(node);
              }}
            />
          </div>
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);

    const wrapper = screen.getByTestId('wrapper');
    const trigger = screen.getByTestId('trigger');

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseEnter(wrapper);
    fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

    await flushMicrotasks();

    // Moving over the active trigger should not emit a redundant openchange.
    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  it('does not treat a synthetic child target as inactive when the native path differs', async () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(true);
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      const hoverProps = useHoverReferenceInteraction({
        context,
        props: {
          mouseOnly: true,
          restMs: 100,
          delay: { close: 0 },
          move: false,
          get triggerElementRef() {
            return triggerElement();
          },
        },
      });

      return (
        <>
          <div data-testid="wrapper" {...hoverProps}>
            <button
              data-testid="trigger"
              ref={(node) => {
                refs.setReference(node);
                setTriggerElement(node);
                if (node) {
                  context.rootStore.context.triggerElements.add('trigger', node);
                }
              }}
            >
              <span data-testid="child" />
            </button>
          </div>
          <button
            data-testid="other-trigger"
            ref={(node) => {
              if (node) {
                context.rootStore.context.triggerElements.add('other-trigger', node);
              }
            }}
          />
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);

    const wrapper = screen.getByTestId('wrapper');
    const trigger = screen.getByTestId('trigger');
    const otherTrigger = screen.getByTestId('other-trigger');
    const child = screen.getByTestId('child');

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    // Entering the active trigger clears `blockMouseMove`, so a misclassified move would reopen.
    fireEvent.mouseEnter(trigger);

    const event = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperties(event, {
      // Deliberately skew the native path so `getTarget(nativeEvent)` resolves to another
      // registered trigger while React's synthetic `event.target` remains `child`.
      composedPath: {
        configurable: true,
        value: () => [otherTrigger, wrapper],
      },
      movementX: {
        configurable: true,
        value: 10,
      },
      movementY: {
        configurable: true,
        value: 0,
      },
    });

    fireEvent(child, event);

    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('treats disabled child trigger as inactive in wrapper fallback mode', async () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = createSignal(true);
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      const hoverProps = useHoverReferenceInteraction({
        context,
        props: {
          mouseOnly: true,
          restMs: 100,
          delay: { close: 0 },
          move: false,
          get triggerElementRef() {
            return triggerElement();
          },
        },
      });

      return (
        <>
          <button
            data-testid="active-trigger"
            ref={(node) => {
              refs.setReference(node);
              setTriggerElement(node);
            }}
          />
          <div data-testid="inactive-wrapper" {...hoverProps}>
            <button
              data-testid="disabled-trigger"
              data-trigger-disabled
              ref={(node) => {
                if (node) {
                  context.rootStore.context.triggerElements.add('disabled-trigger', node);
                }
              }}
            />
          </div>
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);

    const activeTrigger = screen.getByTestId('active-trigger');
    const wrapper = screen.getByTestId('inactive-wrapper');
    const disabledTrigger = screen.getByTestId('disabled-trigger');

    fireEvent.pointerEnter(activeTrigger, { pointerType: 'mouse' });
    fireEvent.mouseEnter(activeTrigger);
    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseMove(disabledTrigger, { movementX: 10, movementY: 0 });

    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  it('reopens immediately for same trigger in delegated wrapper mode during close transition', async () => {
    const onOpenChange = vi.fn();
    let closeFromHover: (() => void) | null = null;

    function App() {
      const [open, setOpen] = createSignal(true);
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      closeFromHover = () => {
        context.rootStore.setOpen(
          false,
          createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseleave')),
        );
      };

      // Simulate active close transition lifecycle while closed.
      // Solid: the store state is written through `set`, at React's render timing.
      createRenderEffect(open, (isOpen) => {
        context.rootStore.set('transitionStatus', isOpen ? undefined : 'ending');
      });

      const hoverProps = useHoverReferenceInteraction({
        context,
        props: {
          mouseOnly: true,
          move: false,
          delay: { open: 500, close: 0 },
          get triggerElementRef() {
            return triggerElement();
          },
        },
      });

      return (
        <>
          <div data-testid="wrapper" {...hoverProps} ref={setTriggerElement}>
            <button
              data-testid="trigger"
              ref={(node) => {
                refs.setReference(node);
              }}
            />
          </div>
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);

    const wrapper = screen.getByTestId('wrapper');
    await flushMicrotasks();

    act(() => {
      closeFromHover?.();
    });

    await flushMicrotasks();
    expect(screen.queryByRole('tooltip')).toBe(null);

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseEnter(wrapper);

    await flushMicrotasks();

    // Close from hover + immediate reopen without waiting open delay.
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(true);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  it('reopens immediately when close transition state is provided externally', async () => {
    const onOpenChange = vi.fn();
    let closeFromHover: (() => void) | null = null;

    function App() {
      const [open, setOpen] = createSignal(true);
      const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });

      closeFromHover = () => {
        context.rootStore.setOpen(
          false,
          createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseleave')),
        );
      };

      const hoverProps = useHoverReferenceInteraction({
        context,
        props: {
          mouseOnly: true,
          move: false,
          delay: { open: 500, close: 0 },
          get triggerElementRef() {
            return triggerElement();
          },
          isClosing: () => !open(),
        },
      });

      return (
        <>
          <div data-testid="wrapper" {...hoverProps} ref={setTriggerElement}>
            <button
              data-testid="trigger"
              ref={(node) => {
                refs.setReference(node);
              }}
            />
          </div>
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);

    const wrapper = screen.getByTestId('wrapper');
    await flushMicrotasks();

    act(() => {
      closeFromHover?.();
    });

    await flushMicrotasks();
    expect(screen.queryByRole('tooltip')).toBe(null);

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseEnter(wrapper);

    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(true);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  describe('hover semantics', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function App(props: UseHoverReferenceInteractionProps) {
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
        props: mergeProps(props, {
          get triggerElementRef() {
            return triggerElement();
          },
        }),
      });
      useHoverFloatingInteraction({ context, parameters: {} });

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

    it('opens on mouseenter', async () => {
      render(() => <App />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    it('closes on mouseleave', () => {
      render(() => <App />);

      fireEvent.mouseEnter(screen.getByRole('button'));
      fireEvent.mouseLeave(screen.getByRole('button'));

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('closes when the pointer moves onto the floating element without safePolygon', async () => {
      render(() => <App />);

      fireEvent.mouseEnter(screen.getByRole('button'));
      await flushMicrotasks();

      fireEvent(
        screen.getByRole('button'),
        new MouseEvent('mouseleave', { relatedTarget: screen.getByRole('tooltip') }),
      );

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    describe('prop: delay', () => {
      it('symmetric number', async () => {
        render(() => <App delay={1000} />);

        fireEvent.mouseEnter(screen.getByRole('button'));

        await act(async () => {
          vi.advanceTimersByTime(999);
        });

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(1);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      it('open', async () => {
        render(() => <App delay={{ open: 500 }} />);

        fireEvent.mouseEnter(screen.getByRole('button'));

        await act(async () => {
          vi.advanceTimersByTime(499);
        });

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(1);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      it('close', async () => {
        render(() => <App delay={{ close: 500 }} />);

        fireEvent.mouseEnter(screen.getByRole('button'));
        fireEvent.mouseLeave(screen.getByRole('button'));

        await act(async () => {
          vi.advanceTimersByTime(499);
        });

        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        await act(async () => {
          vi.advanceTimersByTime(1);
        });

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });

      it('open with close 0', async () => {
        render(() => <App delay={{ open: 500 }} />);

        fireEvent.mouseEnter(screen.getByRole('button'));

        await act(async () => {
          vi.advanceTimersByTime(499);
        });

        fireEvent.mouseLeave(screen.getByRole('button'));

        await act(async () => {
          vi.advanceTimersByTime(1);
        });

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });

      it('restMs + nullish open delay should respect restMs', async () => {
        render(() => <App restMs={100} delay={{ close: 100 }} />);

        fireEvent.mouseEnter(screen.getByRole('button'));

        await act(async () => {
          vi.advanceTimersByTime(99);
        });

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('restMs', async () => {
      render(() => <App restMs={100} />);

      const button = screen.getByRole('button');

      const originalDispatchEvent = button.dispatchEvent;
      const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
        Object.defineProperty(event, 'movementX', { value: 10 });
        Object.defineProperty(event, 'movementY', { value: 10 });
        return originalDispatchEvent.call(button, event);
      });

      fireEvent.mouseMove(button);

      await act(async () => {
        vi.advanceTimersByTime(99);
      });

      fireEvent.mouseMove(button);

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      fireEvent.mouseMove(button);

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      spy.mockRestore();
    });

    it('restMs does not reset timer for minor mouse movement', async () => {
      render(() => <App restMs={100} />);

      const button = screen.getByRole('button');

      const originalDispatchEvent = button.dispatchEvent;
      const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
        Object.defineProperty(event, 'movementX', { value: 1 });
        Object.defineProperty(event, 'movementY', { value: 0 });
        return originalDispatchEvent.call(button, event);
      });

      fireEvent.mouseMove(button);

      await act(async () => {
        vi.advanceTimersByTime(99);
      });

      fireEvent.mouseMove(button);

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      spy.mockRestore();
    });

    it('reports the hover reason', async () => {
      const reasons: string[] = [];

      function ReasonApp() {
        const [open, setOpen] = createSignal(false);
        const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange(nextOpen, details) {
            reasons.push(details.reason);
            setOpen(nextOpen);
          },
        });
        const referenceProps = useHoverReferenceInteraction({
          context,
          props: {
            get triggerElementRef() {
              return triggerElement();
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

      render(() => <ReasonApp />);
      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);
      await flushMicrotasks();
      fireEvent.mouseLeave(button);

      expect(reasons).toEqual([REASONS.triggerHover, REASONS.triggerHover]);
    });
  });
});
