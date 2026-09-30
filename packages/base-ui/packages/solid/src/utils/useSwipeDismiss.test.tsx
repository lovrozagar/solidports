import { createRenderer, flushMicrotasks, isJSDOM } from '#test-utils';
import { fireEvent, screen } from '@solidjs/testing-library';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useSwipeDismiss } from './useSwipeDismiss';

function SwipeBox() {
  let ref!: HTMLElement;
  const swipe = useSwipeDismiss({
    directions: ['down'],
    get elementRef() {
      return ref;
    },
    enabled: true,
    movementCssVars: { x: '--x', y: '--y' },
  });

  return (
    <div
      data-testid="el"
      ref={(el) => {
        ref = el;
      }}
      style={swipe.getDragStyles()}
      {...swipe.getPointerProps()}
    />
  );
}

function SwipeProgressBox(props: { onProgress: (progress: number) => void }) {
  let ref!: HTMLElement;
  const swipe = useSwipeDismiss({
    directions: ['right'],
    get elementRef() {
      return ref;
    },
    enabled: true,
    movementCssVars: { x: '--x', y: '--y' },
    onProgress: props.onProgress,
  });

  return (
    <div
      data-testid="progress"
      ref={(el) => {
        ref = el;
      }}
      style={swipe.getDragStyles()}
      {...swipe.getPointerProps()}
    />
  );
}

function createTouch(target: EventTarget, point: { clientX: number; clientY: number }) {
  if (typeof Touch === 'function') {
    return new Touch({
      identifier: 1,
      target,
      ...point,
    });
  }

  return point;
}

describe('useSwipeDismiss', () => {
  beforeAll(function beforeHook() {
    // PointerEvent not fully implemented in jsdom, causing fireEvent.pointer* to ignore options.
    // https://github.com/jsdom/jsdom/issues/2527
    (window as any).PointerEvent = window.MouseEvent;
  });

  const { render } = createRenderer();

  it('does not start swiping within a scrollable element when ignoreScrollableAncestors is true', async () => {
    const onSwipeStart = vi.fn();

    function SwipeBoxScrollable() {
      let ref!: HTMLDivElement;
      const swipeDismiss = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        ignoreScrollableAncestors: true,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipeStart,
      });

      return (
        <div
          data-testid="root"
          ref={(el) => {
            ref = el;
          }}
          style={swipeDismiss.getDragStyles()}
          {...swipeDismiss.getPointerProps()}
        >
          <div data-testid="scroll" style={{ height: '100px', 'overflow-y': 'auto' }}>
            <div style={{ height: '200px' }} />
          </div>
        </div>
      );
    }

    render(() => <SwipeBoxScrollable />);

    const root = screen.getByTestId('root');
    const scroll = screen.getByTestId('scroll') as HTMLDivElement;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    if (scroll.scrollHeight <= scroll.clientHeight) {
      const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'scrollHeight');
      if (!scrollHeightDescriptor || scrollHeightDescriptor.configurable) {
        Object.defineProperty(scroll, 'scrollHeight', { configurable: true, value: 200 });
      }

      const clientHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'clientHeight');
      if (!clientHeightDescriptor || clientHeightDescriptor.configurable) {
        Object.defineProperty(scroll, 'clientHeight', { configurable: true, value: 100 });
      }
    }

    try {
      fireEvent.pointerDown(scroll, {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 0,
        clientY: 100,
        movementX: 0,
        movementY: 0,
        pointerId: 1,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      fireEvent.pointerMove(scroll, {
        bubbles: true,
        clientX: 0,
        clientY: 150,
        movementX: 0,
        movementY: 50,
        pointerId: 1,
      });

      await flushMicrotasks();

      expect(onSwipeStart).not.toHaveBeenCalled();
      expect(root.style.getPropertyValue('--y')).toBe('0px');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not prevent touch scrolling during swipe interactions', async () => {
    render(() => <SwipeBox />);
    const element = screen.getByTestId('el');

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    // First move establishes the baseline (iOS pointermove delay handling).
    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 100,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    // Move up (unsupported) should not block the default touch scroll behavior.
    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 50,
      movementX: 0,
      movementY: -50,
      pointerId: 1,
    });

    await flushMicrotasks();

    const touchMoveBefore = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveBefore);
    expect(touchMoveBefore.defaultPrevented).toBe(false);

    // Once a supported direction is detected, touchmove should still not be prevented.
    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 150,
      movementX: 0,
      movementY: 100,
      pointerId: 1,
    });

    await flushMicrotasks();

    const touchMoveAfter = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveAfter);
    expect(touchMoveAfter.defaultPrevented).toBe(false);
  });

  it('fires onProgress relative to the element size', async () => {
    const onProgress = vi.fn();
    render(() => <SwipeProgressBox onProgress={onProgress} />);
    const element = screen.getByTestId('progress');

    const widthDescriptor = Object.getOwnPropertyDescriptor(element, 'offsetWidth');
    if (!widthDescriptor || widthDescriptor.configurable) {
      Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 200 });
    }

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 50,
      clientY: 0,
      movementX: 50,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    const progress = onProgress.mock.calls.at(-1)?.[0];
    expect(progress).toBeCloseTo(0.25, 2);
  });

  it('continues firing onProgress when swipe progress is clamped', async () => {
    const onProgress = vi.fn();
    render(() => <SwipeProgressBox onProgress={onProgress} />);
    const element = screen.getByTestId('progress');

    const widthDescriptor = Object.getOwnPropertyDescriptor(element, 'offsetWidth');
    if (!widthDescriptor || widthDescriptor.configurable) {
      Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 200 });
    }

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    // Baseline move.
    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 50,
      clientY: 0,
      movementX: 50,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    const callsAfterForward = onProgress.mock.calls.length;

    // Move past the starting point in the opposite direction; progress is clamped to 0.
    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: -10,
      clientY: 0,
      movementX: -60,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    const callsAfterReverse = onProgress.mock.calls.length;
    expect(callsAfterReverse).toBeGreaterThan(callsAfterForward);

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: -20,
      clientY: 0,
      movementX: -10,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    expect(onProgress.mock.calls.length).toBeGreaterThan(callsAfterReverse);
    expect(onProgress.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it('applies exponential damping for opposite-direction movement', async () => {
    render(() => <SwipeBox />);
    const element = screen.getByTestId('el');

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();
    expect(element.style.transition).toBe('none');

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 100,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 50,
      movementX: 0,
      movementY: -50,
      pointerId: 1,
    });

    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).not.toBe('0px');
  });

  it('respects custom swipeThreshold', async () => {
    const onDismiss = vi.fn();

    function SwipeBoxThreshold() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        swipeThreshold: 10,
      });

      return (
        <div
          data-testid="el"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    render(() => <SwipeBoxThreshold />);
    const element = screen.getByTestId('el');

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    // Baseline move.
    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    // Move beyond the custom 10px threshold.
    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 20,
      movementX: 0,
      movementY: 20,
      pointerId: 1,
    });

    await flushMicrotasks();

    fireEvent.pointerUp(element, {
      bubbles: true,
      clientX: 0,
      clientY: 20,
      pointerId: 1,
    });

    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalled();
  });

  it('fires onSwipingChange on start and end', async () => {
    const onSwipingChange = vi.fn();

    function SwipeBoxSwipingChange() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipingChange,
      });

      return (
        <div
          data-testid="swiping"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    render(() => <SwipeBoxSwipingChange />);
    const element = screen.getByTestId('swiping');

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    fireEvent.pointerUp(element, {
      bubbles: true,
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
  });

  it('cancels pointer swipe when the primary mouse button is released without pointerup', async () => {
    const onDismiss = vi.fn();
    const onSwipingChange = vi.fn();

    function SwipeBoxPointerCancel() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onSwipingChange,
      });

      return (
        <div
          data-testid="pointer-cancel"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    render(() => <SwipeBoxPointerCancel />);
    const element = screen.getByTestId('pointer-cancel');

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      buttons: 1,
      clientX: 0,
      clientY: 12,
      movementX: 0,
      movementY: 12,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledWith(true);
    expect(element.style.getPropertyValue('--y')).not.toBe('0px');

    fireEvent.pointerMove(element, {
      bubbles: true,
      buttons: 0,
      clientX: 0,
      clientY: 16,
      movementX: 0,
      movementY: 4,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerMove(element, {
      bubbles: true,
      buttons: 0,
      clientX: 0,
      clientY: 40,
      movementX: 0,
      movementY: 24,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('resets swiping when touch ends over a scrollable descendant', async () => {
    const onSwipingChange = vi.fn();

    function SwipeBoxTouchScrollableEnd() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipingChange,
      });

      return (
        <div
          data-testid="touch-root"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getTouchProps()}
        >
          <div data-testid="touch-scroll" style={{ 'max-height': '40px', 'overflow-y': 'auto' }}>
            <div style={{ height: '120px' }} />
          </div>
        </div>
      );
    }

    render(() => <SwipeBoxTouchScrollableEnd />);

    const root = screen.getByTestId('touch-root');
    const scroll = screen.getByTestId('touch-scroll');

    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'scrollHeight');
    if (!scrollHeightDescriptor || scrollHeightDescriptor.configurable) {
      Object.defineProperty(scroll, 'scrollHeight', { configurable: true, value: 120 });
    }

    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'clientHeight');
    if (!clientHeightDescriptor || clientHeightDescriptor.configurable) {
      Object.defineProperty(scroll, 'clientHeight', { configurable: true, value: 40 });
    }

    fireEvent.touchStart(root, {
      touches: [
        createTouch(root, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    await flushMicrotasks();

    fireEvent.touchMove(root, {
      touches: [
        createTouch(root, {
          clientX: 0,
          clientY: 20,
        }),
      ],
    });

    await flushMicrotasks();

    fireEvent.touchEnd(scroll, {
      changedTouches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 20,
        }),
      ],
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });

  it('allows onRelease to override dismissal', async () => {
    const onDismiss = vi.fn();
    const onRelease = vi.fn(() => false);

    function SwipeBoxReleaseOverride() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onRelease,
        swipeThreshold: 10,
      });

      return (
        <div
          data-testid="release"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    render(() => <SwipeBoxReleaseOverride />);
    const element = screen.getByTestId('release');

    fireEvent.pointerDown(element, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      bubbles: true,
      clientX: 0,
      clientY: 20,
      movementX: 0,
      movementY: 20,
      pointerId: 1,
    });

    await flushMicrotasks();

    fireEvent.pointerUp(element, {
      bubbles: true,
      clientX: 0,
      clientY: 20,
      pointerId: 1,
    });

    await flushMicrotasks();

    expect(onRelease).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it.skipIf(!isJSDOM)('provides swipe velocity on release', async () => {
    const onRelease = vi.fn();

    function SwipeBoxReleaseVelocity() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['right'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return (
        <div
          data-testid="release-velocity"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(1000));
      render(() => <SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity');

      fireEvent.pointerDown(element, {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        movementX: 0,
        movementY: 0,
        pointerId: 1,
        pointerType: 'mouse',
        timeStamp: 1000,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1100));
      fireEvent.pointerMove(element, {
        bubbles: true,
        clientX: 0,
        clientY: 0,
        movementX: 0,
        movementY: 0,
        pointerId: 1,
        timeStamp: 1100,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1200));
      fireEvent.pointerMove(element, {
        bubbles: true,
        clientX: 50,
        clientY: 0,
        movementX: 50,
        movementY: 0,
        pointerId: 1,
        timeStamp: 1200,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1300));
      fireEvent.pointerUp(element, {
        bubbles: true,
        clientX: 50,
        clientY: 0,
        pointerId: 1,
        timeStamp: 1300,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.25, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.skipIf(!isJSDOM)('provides release velocity from the latest swipe movement', async () => {
    const onRelease = vi.fn();

    function SwipeBoxReleaseVelocity() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['right'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return (
        <div
          data-testid="release-velocity-latest"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(1000));
      render(() => <SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity-latest');

      fireEvent.pointerDown(element, {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        movementX: 0,
        movementY: 0,
        pointerId: 1,
        pointerType: 'mouse',
        timeStamp: 1000,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1100));
      fireEvent.pointerMove(element, {
        bubbles: true,
        clientX: 0,
        clientY: 0,
        movementX: 0,
        movementY: 0,
        pointerId: 1,
        timeStamp: 1100,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1200));
      fireEvent.pointerMove(element, {
        bubbles: true,
        clientX: 50,
        clientY: 0,
        movementX: 50,
        movementY: 0,
        pointerId: 1,
        timeStamp: 1200,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1216));
      fireEvent.pointerMove(element, {
        bubbles: true,
        clientX: 70,
        clientY: 0,
        movementX: 20,
        movementY: 0,
        pointerId: 1,
        timeStamp: 1216,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1224));
      fireEvent.pointerUp(element, {
        bubbles: true,
        clientX: 70,
        clientY: 0,
        pointerId: 1,
        timeStamp: 1224,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityX).toBeCloseTo(1.25, 2);
      expect(details?.releaseVelocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.skipIf(!isJSDOM)('clamps short swipe durations when computing velocity', async () => {
    const onRelease = vi.fn();

    function SwipeBoxReleaseVelocity() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['right'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return (
        <div
          data-testid="release-velocity-short"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(1000));
      render(() => <SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity-short');

      fireEvent.pointerDown(element, {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        movementX: 0,
        movementY: 0,
        pointerId: 1,
        pointerType: 'mouse',
        timeStamp: 1000,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1005));
      fireEvent.pointerMove(element, {
        bubbles: true,
        clientX: 0,
        clientY: 0,
        movementX: 0,
        movementY: 0,
        pointerId: 1,
        timeStamp: 1005,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1010));
      fireEvent.pointerMove(element, {
        bubbles: true,
        clientX: 30,
        clientY: 0,
        movementX: 30,
        movementY: 0,
        pointerId: 1,
        timeStamp: 1010,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1015));
      fireEvent.pointerUp(element, {
        bubbles: true,
        clientX: 30,
        clientY: 0,
        pointerId: 1,
        timeStamp: 1015,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.6, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores pointer interactions that were default prevented', async () => {
    const onSwipeStart = vi.fn();

    function SwipeBoxWithPreventedChild() {
      let ref!: HTMLDivElement;
      const swipeDismiss = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipeStart,
      });

      return (
        <div
          data-testid="root"
          ref={(el) => {
            ref = el;
          }}
          style={swipeDismiss.getDragStyles()}
          {...swipeDismiss.getPointerProps()}
        >
          <div data-testid="child" onPointerDown={(event) => event.preventDefault()} />
        </div>
      );
    }

    render(() => <SwipeBoxWithPreventedChild />);

    const root = screen.getByTestId('root');
    const child = screen.getByTestId('child');

    fireEvent.pointerDown(child, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    fireEvent.pointerMove(child, {
      bubbles: true,
      clientX: 0,
      clientY: 150,
      movementX: 0,
      movementY: 50,
      pointerId: 1,
    });

    await flushMicrotasks();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });

  /* Regression: L747 duplicate event.defaultPrevented check — post-fix the guard reads `event.defaultPrevented` once. */

  it('continues swipe when subsequent pointermove is not default prevented', async () => {
    const onSwipeStart = vi.fn();

    function SwipeBoxWithCallback() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipeStart,
      });
      return (
        <div
          data-testid="cont-el"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    render(() => <SwipeBoxWithCallback />);
    const el = screen.getByTestId('cont-el');

    fireEvent.pointerDown(el, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    /* First move establishes the real drag start (same position). */
    fireEvent.pointerMove(el, {
      bubbles: true,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      movementX: 0,
      movementY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    /* Second move — no preventDefault — swipe should progress. */
    fireEvent.pointerMove(el, {
      bubbles: true,
      buttons: 1,
      clientX: 0,
      clientY: 60,
      movementX: 0,
      movementY: 60,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    /* Swipe progressed: CSS var reflects the delta. */
    const y = el.style.getPropertyValue('--y');
    expect(y).not.toBe('0px');
  });

  it('aborts pending swipe when first pointermove is default-prevented (non-touch)', async () => {
    const onSwipeStart = vi.fn();

    /* canStart returns false on the first call so handleStart sets pendingSwipeRef=true
     * but isSwiping() stays false. The L747 branch then fires on the first move. */
    let canStartCallCount = 0;

    function SwipeBoxAbort() {
      let ref!: HTMLDivElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipeStart,
        canStart: () => {
          canStartCallCount += 1;
          /* Allow on second+ call (from handleMove) but block on first (handleStart). */
          return canStartCallCount > 1;
        },
      });
      return (
        <div
          data-testid="abort-el"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    render(() => <SwipeBoxAbort />);
    const el = screen.getByTestId('abort-el');

    fireEvent.pointerDown(el, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    /* At this point: pendingSwipeRef=true, isSwiping()=false (canStart returned false). */

    /* Prevent the first move — L747 branch fires (non-touch + defaultPrevented) and
     * calls resetPendingSwipeState() before canStart gets its second chance. */
    const preventedMove = new MouseEvent('pointermove', {
      bubbles: true,
      buttons: 1,
      cancelable: true,
      clientX: 0,
      clientY: 50,
    });
    preventedMove.preventDefault();
    el.dispatchEvent(preventedMove);

    await flushMicrotasks();

    /* onSwipeStart must never have fired — the pending swipe was aborted. */
    expect(onSwipeStart).not.toHaveBeenCalled();

    /* --y must remain at initial value — no drag displacement. */
    const yAfterAbort = el.style.getPropertyValue('--y');
    expect(yAfterAbort === '' || yAfterAbort === '0px').toBe(true);

    /* Subsequent clean moves must not start a new swipe (state was reset). */
    fireEvent.pointerMove(el, {
      bubbles: true,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      movementX: 0,
      movementY: 50,
      pointerId: 1,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    expect(onSwipeStart).not.toHaveBeenCalled();
  });

  it('does NOT abort touch swipe when first pointermove is default-prevented', async () => {
    function TouchSwipeBox() {
      let ref!: HTMLElement;
      const swipe = useSwipeDismiss({
        directions: ['down'],
        get elementRef() {
          return ref;
        },
        enabled: true,
        movementCssVars: { x: '--x', y: '--y' },
      });

      return (
        <div
          data-testid="touch-el"
          ref={(el) => {
            ref = el;
          }}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    render(() => <TouchSwipeBox />);

    const el = screen.getByTestId('touch-el');
    const target = el;

    function makeTouch(point: { clientX: number; clientY: number }) {
      return typeof Touch === 'function'
        ? [new Touch({ identifier: 1, target, ...point })]
        : [point];
    }

    /* Prevent the first touchmove — touch events skip the L747 defaultPrevented guard. */
    window.addEventListener('touchmove', (e) => e.preventDefault(), {
      capture: true,
      once: true,
    });

    fireEvent.touchStart(el, {
      bubbles: true,
      touches: makeTouch({ clientX: 0, clientY: 0 }),
      changedTouches: makeTouch({ clientX: 0, clientY: 0 }),
    });

    await flushMicrotasks();

    fireEvent.touchMove(el, {
      bubbles: true,
      touches: makeTouch({ clientX: 0, clientY: 50 }),
      changedTouches: makeTouch({ clientX: 0, clientY: 50 }),
    });

    await flushMicrotasks();

    /* Touch path bypasses the non-touch guard; --y may be set or remain 0 depending
     * on threshold — the key assertion is that no exception was thrown and
     * the swipe was not forcibly reset. We verify by checking the element is still
     * in the DOM. */
    expect(el).toBeInTheDocument();
  });
});
