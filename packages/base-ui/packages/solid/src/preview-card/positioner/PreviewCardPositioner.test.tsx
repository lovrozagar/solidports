import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { afterEach, expect as vitestExpect, vi } from 'vitest';

// Solid: local copy of React's `#test-utils` helper.
async function waitForPositioned(positioner: HTMLElement) {
  await waitFor(() => {
    expect(positioner.style.opacity).not.to.equal('0');
  });
  await waitFor(() => {
    expect(positioner).toBeVisible();
  });
}

function Trigger(props: PreviewCard.Trigger.Props) {
  return <PreviewCard.Trigger {...props} ref={props.ref} render="div" />;
}

type RectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const multilineWrapperStyle = { width: '140px' };
// These tests dispatch pointer coordinates directly. Exclude the real browser cursor so it cannot
// generate a competing hover event over a different inline line.
const multilineTriggerStyle: JSX.CSSProperties = {
  display: 'inline',
  'line-height': '20px',
  'pointer-events': 'none',
};

function expectWithin(actual: number, expected: number, tolerance = 2) {
  vitestExpect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function hoverAt(element: Element, clientX: number, clientY: number) {
  fireEvent.mouseEnter(element, { clientX, clientY });
  fireEvent.mouseMove(element, { clientX, clientY });
}

// These overrides are safe because each test renders fresh trigger elements before mocking them.
function mockClientRects(element: Element, rects: RectLike[]) {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const boundingRect = DOMRect.fromRect({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });

  Object.defineProperty(element, 'getClientRects', {
    configurable: true,
    value: () =>
      rects.map((rect) =>
        DOMRect.fromRect({
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        }),
      ),
  });

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => boundingRect,
  });
}

describe('<PreviewCard.Positioner />', () => {
  const { render, clock } = createRenderer();

  describeConformance(PreviewCard.Positioner, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>{node(props!)}</PreviewCard.Portal>
        </PreviewCard.Root>
      )),
  }));

  it('throws a descriptive error when rendered outside <PreviewCard.Portal>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <PreviewCard.Root open>
            <PreviewCard.Positioner />
          </PreviewCard.Root>
        )),
      ).to.throw('Base UI: <PreviewCard.Portal> is missing.');
    } finally {
      errorSpy.mockRestore();
    }
  });

  const baselineX = 10;
  const baselineY = 36;
  const popupWidth = 52;
  const popupHeight = 24;
  const anchorWidth = 72;
  const anchorHeight = 36;
  const triggerStyle = { height: `${anchorHeight}px`, width: `${anchorWidth}px` };
  const popupStyle = { height: `${popupHeight}px`, width: `${popupWidth}px` };

  describe.skipIf(isJSDOM)('prop: sideOffset', () => {
    it('offsets the side when a number is specified', async () => {
      const sideOffset = 7;
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner data-testid="positioner" sideOffset={sideOffset}>
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX,
          y: baselineY + sideOffset,
        });
      });
    });

    it('offsets the side when a function is specified', async () => {
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              data-testid="positioner"
              sideOffset={(data) => data.positioner.width + data.anchor.width}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX,
          y: baselineY + popupWidth + anchorWidth,
        });
      });
    });

    it('can read the latest side inside sideOffset', async () => {
      let side = 'none';
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              side="left"
              data-testid="positioner"
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('right');
      });
    });

    it('can read the latest align inside sideOffset', async () => {
      let align = 'none';
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              sideOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      // correctly flips the align in the browser
      await waitFor(() => {
        expect(align).to.equal('end');
      });
    });

    it('reads logical side inside sideOffset', async () => {
      let side = 'none';
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              side="inline-start"
              data-testid="positioner"
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('inline-end');
      });
    });
  });

  describe.skipIf(isJSDOM)('prop: alignOffset', () => {
    it('offsets the align when a number is specified', async () => {
      const alignOffset = 7;
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner data-testid="positioner" alignOffset={alignOffset}>
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX + alignOffset,
          y: baselineY,
        });
      });
    });

    it('offsets the align when a function is specified', async () => {
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              data-testid="positioner"
              alignOffset={(data) => data.positioner.width}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect()).to.include({
          x: baselineX + popupWidth,
          y: baselineY,
        });
      });
    });

    it('can read the latest side inside alignOffset', async () => {
      let side = 'none';
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              side="left"
              data-testid="positioner"
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('right');
      });
    });

    it('can read the latest align inside alignOffset', async () => {
      let align = 'none';
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              alignOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      // correctly flips the align in the browser
      await waitFor(() => {
        expect(align).to.equal('end');
      });
    });

    it('reads logical side inside alignOffset', async () => {
      let side = 'none';
      render(() => (
        <PreviewCard.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              side="inline-start"
              data-testid="positioner"
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      // correctly flips the side in the browser
      await waitFor(() => {
        expect(side).to.equal('inline-end');
      });
    });
  });

  it.skipIf(isJSDOM)('uses transform positioning without Viewport', async () => {
    const { unmount } = render(() => (
      <PreviewCard.Root open>
        <Trigger style={triggerStyle}>Trigger</Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner data-testid="positioner">
            <PreviewCard.Popup style={popupStyle}>Popup</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));

    const positioner = screen.getByTestId('positioner');
    await waitFor(() => {
      expect(positioner.style.transform).not.to.equal('');
    });
    unmount();
  });

  it.skipIf(isJSDOM)('uses top/left positioning with Viewport', async () => {
    const { unmount } = render(() => (
      <PreviewCard.Root open>
        <Trigger style={triggerStyle}>Trigger</Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner data-testid="positioner">
            <PreviewCard.Popup style={popupStyle}>
              <PreviewCard.Viewport>Popup</PreviewCard.Viewport>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));

    const positioner = screen.getByTestId('positioner');
    await waitForPositioned(positioner);
    expect(positioner.style.transform).to.equal('');
    unmount();
  });

  describe.skipIf(isJSDOM)('multiline inline trigger', () => {
    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      window.scrollTo(0, 0);
      document.documentElement.style.height = '';
      document.body.style.height = '';
      document.body.style.margin = '';
    });

    it('positions the popup relative to the hovered line of a multiline trigger', async () => {
      render(() => (
        <div style={multilineWrapperStyle}>
          <PreviewCard.Root>
            <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(2);

      // Enter over the second line so opening on hover uses the correct inline rect.
      const secondLineRect = triggerRects[1];
      const secondLineCenterX = secondLineRect.left + secondLineRect.width / 2;
      const secondLineCenterY = secondLineRect.top + secondLineRect.height / 2;

      hoverAt(trigger, secondLineCenterX, secondLineCenterY);

      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        vitestExpect(positioner).toBeVisible();
      });

      // The positioner should be positioned relative to the second line,
      // not the first line or the bounding client rect.
      // y-coordinate should be close to the second line's bottom + sideOffset
      const expectedY = secondLineRect.bottom + 5;

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });

      // x-coordinate should also be relative to where we hovered on the second line
      const { x: positionerX } = positioner.getBoundingClientRect();
      vitestExpect(positionerX).toBeGreaterThanOrEqual(secondLineRect.left - 10);
      vitestExpect(positionerX).toBeLessThanOrEqual(secondLineRect.right + 10);
    });

    describe('with delayed opening', () => {
      clock.withFakeTimers();

      it('uses the latest hovered line', async () => {
        render(() => (
          <div style={multilineWrapperStyle}>
            <PreviewCard.Root>
              <PreviewCard.Trigger delay={100} data-testid="trigger" style={multilineTriggerStyle}>
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                  <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
        ));

        const trigger = screen.getByTestId('trigger');
        const triggerRects = trigger.getClientRects();

        vitestExpect(triggerRects.length).toBeGreaterThan(2);

        const firstLineRect = triggerRects[0];
        const secondLineRect = triggerRects[1];

        fireEvent.mouseEnter(trigger, {
          clientX: firstLineRect.left + firstLineRect.width / 2,
          clientY: firstLineRect.top + firstLineRect.height / 2,
        });
        fireEvent.mouseMove(trigger, {
          clientX: firstLineRect.left + firstLineRect.width / 2,
          clientY: firstLineRect.top + firstLineRect.height / 2,
        });
        fireEvent.mouseMove(trigger, {
          clientX: secondLineRect.left + secondLineRect.width / 2,
          clientY: secondLineRect.top + secondLineRect.height / 2,
        });

        vitestExpect(screen.queryByTestId('positioner')).toBe(null);

        await clock.tickAsync(100);
        await clock.tickAsync(16);

        const positioner = screen.getByTestId('positioner');
        expectWithin(positioner.getBoundingClientRect().y, secondLineRect.bottom + 5);
      });
    });

    it('keeps the popup aligned after page scroll', async () => {
      document.documentElement.style.height = '4000px';
      document.body.style.height = '4000px';
      document.body.style.margin = '0';

      render(() => (
        <div>
          <div style={{ height: '1200px' }} />
          <div style={multilineWrapperStyle}>
            <PreviewCard.Root>
              <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                  <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
          <div style={{ height: '1200px' }} />
        </div>
      ));

      window.scrollTo(0, 1000);

      await waitFor(() => {
        vitestExpect(window.scrollY).toBe(1000);
      });

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(1);

      const secondLineRect = triggerRects[1];
      const secondLineCenterX = secondLineRect.left + secondLineRect.width / 2;
      const secondLineCenterY = secondLineRect.top + secondLineRect.height / 2;

      hoverAt(trigger, secondLineCenterX, secondLineCenterY);

      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        vitestExpect(positioner).toBeVisible();
      });

      const expectedY = secondLineRect.bottom + 5;

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });

      const { x: positionerX } = positioner.getBoundingClientRect();
      vitestExpect(positionerX).toBeGreaterThanOrEqual(secondLineRect.left - 10);
      vitestExpect(positionerX).toBeLessThanOrEqual(secondLineRect.right + 10);
    });

    it('stays anchored to the opened line while already open', async () => {
      let positionUpdateCount = 0;
      render(() => (
        <div style={multilineWrapperStyle}>
          <PreviewCard.Root>
            <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner
                data-testid="positioner"
                side="bottom"
                sideOffset={() => {
                  positionUpdateCount += 1;
                  return 5;
                }}
              >
                <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(2);

      const firstLineRect = triggerRects[0];
      const secondLineRect = triggerRects[1];

      hoverAt(
        trigger,
        firstLineRect.left + firstLineRect.width / 2,
        firstLineRect.top + firstLineRect.height / 2,
      );

      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 5);
      });
      const positionUpdateCountBeforeReentry = positionUpdateCount;

      fireEvent.mouseLeave(trigger);
      hoverAt(
        trigger,
        secondLineRect.left + secondLineRect.width / 2,
        secondLineRect.top + secondLineRect.height / 2,
      );

      window.dispatchEvent(new Event('resize'));
      await waitFor(() => {
        vitestExpect(positionUpdateCount).toBeGreaterThan(positionUpdateCountBeforeReentry);
      });

      expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 5);
    });

    it('re-anchors to a newly entered line while reopening during close transition', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const style = `
        @keyframes preview-card-inline-reentry-close-transition {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-inline-reentry-close-transition 1000ms linear forwards;
        }
      `;

      render(() => (
        <>
          <style>{style}</style>
          <div style={multilineWrapperStyle}>
            <PreviewCard.Root>
              <PreviewCard.Trigger
                delay={0}
                closeDelay={0}
                data-testid="trigger"
                style={multilineTriggerStyle}
              >
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                  <PreviewCard.Popup data-testid="popup" style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
        </>
      ));

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(2);

      const firstLineRect = triggerRects[0];
      const secondLineRect = triggerRects[1];

      hoverAt(
        trigger,
        firstLineRect.left + firstLineRect.width / 2,
        firstLineRect.top + firstLineRect.height / 2,
      );

      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, firstLineRect.bottom + 5);
      });

      fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        vitestExpect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      fireEvent.mouseMove(trigger, {
        clientX: secondLineRect.left + secondLineRect.width / 2,
        clientY: secondLineRect.top + secondLineRect.height / 2,
      });
      fireEvent.mouseEnter(trigger, {
        clientX: secondLineRect.left + secondLineRect.width / 2,
        clientY: secondLineRect.top + secondLineRect.height / 2,
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, secondLineRect.bottom + 5);
      });
    });

    it('positions the popup relative to the side-aligned rect when open is controlled', async () => {
      const sideOffset = 5;
      const inlinePopupHeight = 40;

      render(() => (
        <div style={multilineWrapperStyle}>
          <PreviewCard.Root open>
            <PreviewCard.Trigger delay={0} data-testid="trigger" style={multilineTriggerStyle}>
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner
                data-testid="positioner"
                side="bottom"
                sideOffset={sideOffset}
              >
                <PreviewCard.Popup style={{ width: '80px', height: `${inlinePopupHeight}px` }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(1);

      const targetRect = triggerRects[triggerRects.length - 1];
      const expectedY = targetRect.bottom + sideOffset;
      const positioner = screen.getByTestId('positioner');

      await waitFor(() => {
        vitestExpect(positioner).toBeVisible();
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });

      const { x: positionerX } = positioner.getBoundingClientRect();
      vitestExpect(positionerX).toBeGreaterThanOrEqual(targetRect.left - 10);
      vitestExpect(positionerX).toBeLessThanOrEqual(targetRect.right + 10);
    });

    it('clears hovered-line coords after close before controlled reopen of the same trigger', async () => {
      const sideOffset = 5;

      function Test() {
        const [open, setOpen] = createSignal(false);
        const [triggerId, setTriggerId] = createSignal<string | null>(null);

        return (
          <div style={multilineWrapperStyle}>
            <PreviewCard.Root
              open={open()}
              triggerId={triggerId()}
              onOpenChange={(nextOpen, eventDetails) => {
                setOpen(nextOpen);
                setTriggerId(eventDetails.trigger?.id ?? null);
              }}
            >
              <PreviewCard.Trigger
                delay={0}
                data-testid="trigger"
                id="trigger"
                style={multilineTriggerStyle}
              >
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner
                  data-testid="positioner"
                  side="bottom"
                  sideOffset={sideOffset}
                >
                  <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>

            <button
              type="button"
              onClick={() => {
                setTriggerId('trigger');
                setOpen(true);
              }}
            >
              Open
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        );
      }

      render(() => <Test />);
      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(2);

      const secondLineRect = triggerRects[1];
      hoverAt(
        trigger,
        secondLineRect.left + secondLineRect.width / 2,
        secondLineRect.top + secondLineRect.height / 2,
      );

      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, secondLineRect.bottom + sideOffset);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        vitestExpect(positioner).toHaveAttribute('hidden');
      });

      fireEvent.click(screen.getByRole('button', { name: 'Open' }));

      const targetRect = triggerRects[triggerRects.length - 1];
      await waitFor(() => {
        vitestExpect(positioner).toBeVisible();
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, targetRect.bottom + sideOffset);
      });
    });

    it('ignores stale hovered coords when a controlled trigger switch reuses the popup', async () => {
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [triggerId, setTriggerId] = createSignal<string | null>(null);

        return (
          <div>
            <PreviewCard.Root
              open={open()}
              triggerId={triggerId()}
              onOpenChange={(nextOpen, eventDetails) => {
                setOpen(nextOpen);
                setTriggerId(eventDetails.trigger?.id ?? null);
              }}
            >
              <PreviewCard.Trigger
                href="#"
                id="trigger-1"
                data-testid="trigger-1"
                delay={0}
                style={{ display: 'inline', 'pointer-events': 'none' }}
              >
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger
                href="#"
                id="trigger-2"
                data-testid="trigger-2"
                delay={0}
                style={{ display: 'inline', 'pointer-events': 'none' }}
              >
                Trigger 2
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" side="bottom" sideOffset={5}>
                  <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>

            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setTriggerId('trigger-2');
              }}
            >
              Switch
            </button>
          </div>
        );
      }

      render(() => <Test />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      mockClientRects(trigger1, [
        { left: 180, top: 0, right: 220, bottom: 10, width: 40, height: 10 },
        { left: 100, top: 20, right: 160, bottom: 30, width: 60, height: 10 },
      ]);
      mockClientRects(trigger2, [
        { left: 180, top: 100, right: 220, bottom: 110, width: 40, height: 10 },
        { left: 100, top: 120, right: 160, bottom: 130, width: 60, height: 10 },
      ]);

      hoverAt(trigger1, 200, 5);

      await waitFor(() => {
        vitestExpect(screen.getByTestId('positioner')).toBeVisible();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

      const positioner = screen.getByTestId('positioner');

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, 135);
      });

      const { x: positionerX } = positioner.getBoundingClientRect();
      vitestExpect(positionerX).toBeGreaterThanOrEqual(90);
      vitestExpect(positionerX).toBeLessThanOrEqual(170);
    });

    it('uses the hovered line with a custom anchor in a clipped keepMounted portal', async () => {
      document.body.style.margin = '0';

      function Test() {
        const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);
        const [portalContainer, setPortalContainer] = createSignal<HTMLDivElement | null>(null);

        return (
          <div>
            <div ref={setPortalContainer} data-testid="portal-container" />
            <PreviewCard.Root>
              <PreviewCard.Trigger
                ref={setTriggerElement}
                href="#"
                delay={0}
                data-testid="trigger"
                style={{ 'pointer-events': 'none' }}
              >
                Trigger
              </PreviewCard.Trigger>
              <PreviewCard.Portal keepMounted container={portalContainer()}>
                <PreviewCard.Positioner
                  anchor={triggerElement}
                  collisionBoundary={{ x: 0, y: 0, width: 300, height: 120 }}
                  collisionPadding={0}
                  data-testid="positioner"
                  side="bottom"
                  sideOffset={5}
                >
                  <PreviewCard.Popup style={{ width: '80px', height: '40px' }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
        );
      }

      render(() => <Test />);
      const portalContainer = screen.getByTestId('portal-container');
      const trigger = screen.getByTestId('trigger');
      const positioner = screen.getByTestId('positioner');

      mockClientRects(trigger, [
        { left: 180, top: 80, right: 220, bottom: 90, width: 40, height: 10 },
        { left: 0, top: 100, right: 60, bottom: 110, width: 60, height: 10 },
      ]);

      hoverAt(trigger, 30, 105);

      await waitFor(() => {
        vitestExpect(positioner).toBeVisible();
      });

      vitestExpect(portalContainer).toContainElement(positioner);

      await waitFor(() => {
        vitestExpect(positioner).toHaveAttribute('data-side', 'top');
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, 55);
      });
    });

    it('positions the popup relative to the side-aligned rect when opened via focus', async () => {
      const sideOffset = 5;
      const inlinePopupHeight = 40;
      const { user } = render(() => (
        <div style={{ ...multilineWrapperStyle, 'margin-top': '100px' }}>
          <PreviewCard.Root>
            <PreviewCard.Trigger
              delay={0}
              data-testid="trigger"
              tabindex={0}
              style={multilineTriggerStyle}
            >
              This is a long text that will wrap across multiple lines in the trigger element
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner data-testid="positioner" side="top" sideOffset={sideOffset}>
                <PreviewCard.Popup style={{ width: '80px', height: `${inlinePopupHeight}px` }}>
                  Preview Content
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(1);

      const targetRect = triggerRects[0];
      const expectedY = targetRect.top - inlinePopupHeight - sideOffset;

      await user.tab();

      const positioner = screen.getByTestId('positioner');

      await waitFor(() => {
        vitestExpect(positioner).toBeVisible();
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });

      const { x: positionerX } = positioner.getBoundingClientRect();
      vitestExpect(positionerX).toBeGreaterThanOrEqual(targetRect.left - 10);
      vitestExpect(positionerX).toBeLessThanOrEqual(targetRect.right + 10);
    });

    it('clears hovered-line coords when opened via focus', async () => {
      const sideOffset = 5;
      const inlinePopupHeight = 40;

      function Test() {
        const [open, setOpen] = createSignal(false);
        const [triggerId, setTriggerId] = createSignal<string | null>(null);

        return (
          <div style={{ ...multilineWrapperStyle, 'margin-top': '100px' }}>
            <PreviewCard.Root
              open={open()}
              triggerId={triggerId()}
              onOpenChange={(nextOpen, eventDetails) => {
                if (eventDetails.reason === 'trigger-focus') {
                  setOpen(nextOpen);
                  setTriggerId(eventDetails.trigger?.id ?? null);
                }
              }}
            >
              <PreviewCard.Trigger
                delay={0}
                data-testid="trigger"
                id="trigger"
                tabindex={0}
                style={multilineTriggerStyle}
              >
                This is a long text that will wrap across multiple lines in the trigger element
              </PreviewCard.Trigger>
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner data-testid="positioner" side="top" sideOffset={sideOffset}>
                  <PreviewCard.Popup style={{ width: '80px', height: `${inlinePopupHeight}px` }}>
                    Preview Content
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
        );
      }

      const { user } = render(() => <Test />);
      const trigger = screen.getByTestId('trigger');
      const triggerRects = trigger.getClientRects();

      vitestExpect(triggerRects.length).toBeGreaterThan(2);

      const secondLineRect = triggerRects[1];
      hoverAt(
        trigger,
        secondLineRect.left + secondLineRect.width / 2,
        secondLineRect.top + secondLineRect.height / 2,
      );

      const targetRect = triggerRects[0];
      const expectedY = targetRect.top - inlinePopupHeight - sideOffset;

      await user.tab();

      const positioner = screen.getByTestId('positioner');

      await waitFor(() => {
        vitestExpect(positioner).toBeVisible();
      });

      await waitFor(() => {
        expectWithin(positioner.getBoundingClientRect().y, expectedY);
      });
    });
  });
});
