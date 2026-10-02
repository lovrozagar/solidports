import { expect, vi } from 'vitest';
import { createSignal, Show } from 'solid-js';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { flushSync } from '../../utils/flushSync';
import { SCROLL_TIMEOUT } from '../constants';

describe('<ScrollArea.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(ScrollArea.Viewport, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <ScrollArea.Root>{node(props!)}</ScrollArea.Root>),
  }));

  it('handles a user scroll callback unmounting the viewport', async () => {
    function App() {
      const [mounted, setMounted] = createSignal(true);

      return (
        <ScrollArea.Root>
          <Show when={mounted()}>
            <ScrollArea.Viewport
              data-testid="viewport"
              onScroll={() => {
                flushSync(() => setMounted(false));
              }}
            />
          </Show>
        </ScrollArea.Root>
      );
    }

    render(() => <App />);

    expect(() => fireEvent.scroll(screen.getByTestId('viewport'))).not.toThrow();
    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  describe.skipIf(isJSDOM)('subtree animations', () => {
    it('recomputes overflow after a subtree animation finishes', async () => {
      let scrollWidth = 100;
      let resolveAnimation: () => void = () => {};
      const finished = new Promise<void>((resolve) => {
        resolveAnimation = resolve;
      });
      const getAnimations = vi.fn(() => [{ finished }] as unknown as Animation[]);

      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport
            ref={(node) => {
              if (node) {
                Object.defineProperties(node, {
                  clientHeight: { configurable: true, value: 100 },
                  clientWidth: { configurable: true, value: 100 },
                  scrollHeight: { configurable: true, value: 100 },
                  scrollWidth: { configurable: true, get: () => scrollWidth },
                  getAnimations: { configurable: true, value: getAnimations },
                });
              }
            }}
          />
          <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));

      const root = screen.getByTestId('root');
      await waitFor(() => expect(getAnimations).toHaveBeenCalled());
      expect(root).not.toHaveAttribute('data-has-overflow-x');

      scrollWidth = 1000;
      await act(async () => {
        resolveAnimation();
        await finished;
      });

      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
    });

    it('ignores an animation finishing after its viewport unmounts', async () => {
      let resolveAnimation: () => void = () => {};
      const finished = new Promise<void>((resolve) => {
        resolveAnimation = resolve;
      });
      const getAnimations = vi.fn(() => [{ finished }] as unknown as Animation[]);

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <>
            <button type="button" onClick={() => setMounted(false)}>
              unmount
            </button>
            <ScrollArea.Root>
              <Show when={mounted()}>
                <ScrollArea.Viewport
                  data-testid="viewport"
                  ref={(node) => {
                    if (node) {
                      Object.defineProperty(node, 'getAnimations', {
                        configurable: true,
                        value: getAnimations,
                      });
                    }
                  }}
                />
              </Show>
            </ScrollArea.Root>
          </>
        );
      }

      const { user } = render(() => <App />);
      await waitFor(() => expect(getAnimations).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: 'unmount' }));
      expect(screen.queryByTestId('viewport')).toBe(null);

      await act(async () => {
        resolveAnimation();
        await finished;
      });
    });
  });

  describe('data-scrolling attribute', () => {
    const { render: renderWithClock, clock } = createRenderer();

    clock.withFakeTimers();

    it('adds [data-scrolling] attribute when viewport is scrolled', async () => {
      renderWithClock(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');

      expect(viewport).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await clock.tickAsync(SCROLL_TIMEOUT);

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await clock.tickAsync(SCROLL_TIMEOUT);

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('ignores data-scrolling during programmatic scroll', async () => {
      renderWithClock(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', 'pointer-events': 'none' }}
          >
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');

      // No user interaction before the scroll event, as with `scrollTo()`.
      // `pointer-events: none` isolates this from the browser's real pointer.
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('adds [data-scrolling] in touch modality even when the gesture delivers no events', async () => {
      renderWithClock(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');

      // The initial touch is delivered normally and establishes touch modality.
      fireEvent.pointerDown(viewport, { pointerType: 'touch' });

      // A touch that catches an in-flight momentum scroll or rubber-band
      // bounce is consumed natively by WebKit: no touch/pointer events fire
      // for the whole gesture, only scroll events after an arbitrary pause.
      await clock.tickAsync(200);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await clock.tickAsync(SCROLL_TIMEOUT);

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('keeps ignoring programmatic scrolls in mouse modality', async () => {
      renderWithClock(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');

      fireEvent.pointerDown(viewport, { pointerType: 'mouse' });

      await clock.tickAsync(200);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      await clock.tickAsync(SCROLL_TIMEOUT);

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('restores programmatic scroll suppression after modality flips back to mouse', async () => {
      renderWithClock(() => (
        <ScrollArea.Root data-testid="root" style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      fireEvent.pointerDown(viewport, { pointerType: 'touch' });
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      await clock.tickAsync(SCROLL_TIMEOUT);

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // A mouse pointermove on the root (not the viewport, whose own
      // handlers mark user interaction) switches back to mouse modality.
      fireEvent.pointerMove(root, { pointerType: 'mouse' });
      fireEvent.scroll(viewport, { target: { scrollTop: 2 } });

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('removes [data-scrolling] after timeout', async () => {
      renderWithClock(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');

      // Start scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait less than timeout - should still be scrolling
      await clock.tickAsync(SCROLL_TIMEOUT - 1);

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait for remaining timeout
      await clock.tickAsync(1);

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });
  });

  describe.skipIf(isJSDOM)('overflow data attributes (viewport)', () => {
    const VIEWPORT_SIZE = 200;
    const SCROLLABLE_CONTENT_SIZE = 1000;

    it('applies data attributes on viewport', async () => {
      render(() => (
        <ScrollArea.Root style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div
              style={{
                width: `${SCROLLABLE_CONTENT_SIZE}px`,
                height: `${SCROLLABLE_CONTENT_SIZE}px`,
              }}
            />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));

      const viewport = screen.getByTestId('viewport');

      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        expect(viewport).toHaveAttribute('data-has-overflow-x');
        expect(viewport).toHaveAttribute('data-has-overflow-y');
        expect(viewport).not.toHaveAttribute('data-overflow-x-start');
        expect(viewport).toHaveAttribute('data-overflow-x-end');
        expect(viewport).not.toHaveAttribute('data-overflow-y-start');
        expect(viewport).toHaveAttribute('data-overflow-y-end');
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */
    });
  });

  // Only Safari reports an out-of-range `scrollTop`/`scrollLeft` while rubber-banding, and the
  // browser clamps the property on assignment, so the getter is mocked to emulate it against
  // real layout.
  describe.skipIf(isJSDOM)('overscroll feedback', () => {
    const VIEWPORT_SIZE = 200;
    const CONTENT_SIZE = 1000;
    const MAX_SCROLL = CONTENT_SIZE - VIEWPORT_SIZE;

    async function renderScrollArea(
      orientation: 'vertical' | 'horizontal',
      textDirection: 'ltr' | 'rtl' = 'ltr',
    ) {
      render(() => (
        <DirectionProvider direction={textDirection}>
          <ScrollArea.Root
            style={{
              width: `${VIEWPORT_SIZE}px`,
              height: `${VIEWPORT_SIZE}px`,
              direction: textDirection,
            }}
          >
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div
                style={{
                  width: orientation === 'horizontal' ? `${CONTENT_SIZE}px` : '100%',
                  height: orientation === 'vertical' ? `${CONTENT_SIZE}px` : '100%',
                }}
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation={orientation} data-testid="scrollbar" keepMounted>
              <ScrollArea.Thumb data-testid="thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>
      ));

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const scrollbar = screen.getByTestId('scrollbar');
      const thumb = screen.getByTestId('thumb');
      const axis = orientation === 'vertical' ? 'height' : 'width';
      await waitFor(() => expect(thumb.getBoundingClientRect()[axis]).toBeGreaterThan(0));

      return { viewport, scrollbar, thumb };
    }

    function overscroll(viewport: HTMLDivElement, prop: 'scrollTop' | 'scrollLeft', value: number) {
      Object.defineProperty(viewport, prop, { configurable: true, get: () => value });
      fireEvent.scroll(viewport);
    }

    it('shrinks and pins the thumb to the start edge while overscrolling past the top', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('vertical');

      const restingHeight = thumb.getBoundingClientRect().height;

      overscroll(viewport, 'scrollTop', -50);

      // Shrinks, but damped by the content length rather than subtracting the raw pixels
      // (a 1:1 subtraction of 50px would collapse this thumb to its minimum size).
      await waitFor(() => expect(thumb.getBoundingClientRect().height).toBeLessThan(restingHeight));
      expect(thumb.getBoundingClientRect().height).toBeGreaterThan(restingHeight * 0.9);
      // Pinned to the top edge of the track.
      expect(thumb.getBoundingClientRect().top).toBeCloseTo(
        scrollbar.getBoundingClientRect().top,
        0,
      );
    });

    it('shrinks and pins the thumb to the end edge while overscrolling past the bottom', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('vertical');

      const restingHeight = thumb.getBoundingClientRect().height;

      overscroll(viewport, 'scrollTop', MAX_SCROLL + 50);

      await waitFor(() => expect(thumb.getBoundingClientRect().height).toBeLessThan(restingHeight));
      expect(thumb.getBoundingClientRect().height).toBeGreaterThan(restingHeight * 0.9);
      // Pinned to the bottom edge of the track.
      expect(thumb.getBoundingClientRect().bottom).toBeCloseTo(
        scrollbar.getBoundingClientRect().bottom,
        0,
      );
    });

    it('restores the resting thumb size once the viewport settles back into range', async () => {
      const { viewport, thumb } = await renderScrollArea('vertical');

      const restingHeight = thumb.getBoundingClientRect().height;

      overscroll(viewport, 'scrollTop', -50);
      await waitFor(() => expect(thumb.getBoundingClientRect().height).toBeLessThan(restingHeight));

      overscroll(viewport, 'scrollTop', 100);
      await waitFor(() =>
        expect(thumb.getBoundingClientRect().height).toBeCloseTo(restingHeight, 0),
      );
    });

    it('shrinks and pins the horizontal thumb to the inline start while overscrolling (LTR)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal');

      const restingWidth = thumb.getBoundingClientRect().width;

      overscroll(viewport, 'scrollLeft', -50);

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline start is the left edge in LTR.
      expect(thumb.getBoundingClientRect().left).toBeCloseTo(
        scrollbar.getBoundingClientRect().left,
        0,
      );
    });

    it('shrinks and pins the horizontal thumb to the inline end while overscrolling (LTR)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal');

      const restingWidth = thumb.getBoundingClientRect().width;

      overscroll(viewport, 'scrollLeft', MAX_SCROLL + 50);

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline end is the right edge in LTR.
      expect(thumb.getBoundingClientRect().right).toBeCloseTo(
        scrollbar.getBoundingClientRect().right,
        0,
      );
    });

    it('shrinks and pins the horizontal thumb to the inline start while overscrolling (RTL)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal', 'rtl');

      const restingWidth = thumb.getBoundingClientRect().width;

      // RTL scrolls from 0 toward `-MAX_SCROLL`; overscrolling the inline start goes positive.
      overscroll(viewport, 'scrollLeft', 50);

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline start is the right edge in RTL.
      expect(thumb.getBoundingClientRect().right).toBeCloseTo(
        scrollbar.getBoundingClientRect().right,
        0,
      );
    });

    it('shrinks and pins the horizontal thumb to the inline end while overscrolling (RTL)', async () => {
      const { viewport, scrollbar, thumb } = await renderScrollArea('horizontal', 'rtl');

      const restingWidth = thumb.getBoundingClientRect().width;

      // RTL overscroll past the inline end goes beyond `-MAX_SCROLL`.
      overscroll(viewport, 'scrollLeft', -(MAX_SCROLL + 50));

      await waitFor(() => expect(thumb.getBoundingClientRect().width).toBeLessThan(restingWidth));
      expect(thumb.getBoundingClientRect().width).toBeGreaterThan(restingWidth * 0.9);
      // Inline end is the left edge in RTL.
      expect(thumb.getBoundingClientRect().left).toBeCloseTo(
        scrollbar.getBoundingClientRect().left,
        0,
      );
    });
  });

  it('throws a descriptive error when rendered outside <ScrollArea.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <ScrollArea.Viewport />)).toThrow(
        'Base UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
