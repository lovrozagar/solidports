import { vi, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { createRenderEffect, createSignal, Show } from 'solid-js';
import { act, flushMicrotasks, isJSDOM } from '#test-utils';
import { useFloating } from './useFloating';
import { safePolygon } from '../safePolygon';
import {
  useHoverInteractionSharedState,
  type HoverInteraction,
} from './useHoverInteractionSharedState';
import { useHoverReferenceInteraction } from './useHoverReferenceInteraction';
import { REASONS } from '../../utils/reasons';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';

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
              }}
            >
              <span data-testid="child" />
            </button>
          </div>
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <App />);

    const wrapper = screen.getByTestId('wrapper');
    const child = screen.getByTestId('child');

    fireEvent.pointerEnter(wrapper, { pointerType: 'mouse' });
    fireEvent.mouseEnter(wrapper);

    const event = new MouseEvent('mousemove', { bubbles: true });
    Object.defineProperties(event, {
      composedPath: {
        configurable: true,
        value: () => [document.body, child, wrapper],
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
    expect(screen.queryByRole('tooltip')).not.toBe(null);
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
});
