import { createRenderer, describeConformance, isJSDOM, waitSingleFrame } from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { createSignal } from 'solid-js';
import { act } from '#test-utils';

describe('<Tooltip.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(Tooltip.Viewport, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Tooltip.Root open>
          <Tooltip.Trigger>Trigger</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>{node(props!)}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
    },
  }));

  it('should render children in the `current` container by default', async () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>
              <Tooltip.Viewport>
                <div data-testid="content">Content</div>
              </Tooltip.Viewport>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const currentContainer = screen.getByTestId('content').closest('[data-current]');
    expect(currentContainer).not.to.equal(null);
    expect(currentContainer!.textContent).to.equal('Content');
  });

  it.skipIf(isJSDOM)('should mirror the instant animation type of the tooltip', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger delay={0} closeDelay={0}>
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>
              <Tooltip.Viewport data-testid="viewport">Content</Tooltip.Viewport>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Trigger' });

    await act(async () => trigger.focus());

    await waitFor(() => {
      expect(screen.getByTestId('viewport')).to.have.attribute('data-instant', 'focus');
    });
  });

  it('should remount the `current` container when the active trigger changes', async () => {
    render(() => (
      <Tooltip.Root>
        {(data) => (
          <>
            <Tooltip.Trigger payload="first" delay={0} data-testid="trigger1">
              Trigger 1
            </Tooltip.Trigger>
            <Tooltip.Trigger payload="second" delay={0} data-testid="trigger2">
              Trigger 2
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>
                  <Tooltip.Viewport>
                    {data.payload === 'first' ? (
                      <img data-testid="payload-image-1" src="about:blank" alt="Preview 1" />
                    ) : null}
                    {data.payload === 'second' ? (
                      <img data-testid="payload-image-2" src="about:blank" alt="Preview 2" />
                    ) : null}
                  </Tooltip.Viewport>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </>
        )}
      </Tooltip.Root>
    ));

    const trigger1 = screen.getByTestId('trigger1');
    const trigger2 = screen.getByTestId('trigger2');

    await waitSingleFrame();
    trigger1.focus();

    const firstImage = await screen.findByTestId('payload-image-1');
    const firstContainer = firstImage.closest('[data-current]');
    expect(firstContainer).not.to.equal(null);

    await waitSingleFrame();
    trigger2.focus();

    await waitFor(() => {
      const secondImage = screen.getByTestId('payload-image-2');
      const secondContainer = secondImage.closest('[data-current]');
      expect(secondContainer).not.to.equal(null);
      expect(secondContainer).not.to.equal(firstContainer);
    });
  });

  describe.skipIf(isJSDOM)('morphing containers with multiple triggers and payloads', () => {
    beforeEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
    });

    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('should create morphing containers during transitions', async () => {
      render(() => (
        <div>
          <style>
            {`
              [data-transitioning] [data-previous] {
                animation: slide-out 0.3s ease-out forwards;
              }
              [data-transitioning] [data-current] {
                animation: slide-in 0.3s ease-out forwards;
              }
              @keyframes slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(-30%); opacity: 0; }
              }
              @keyframes slide-in {
                from { transform: translateX(30%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}
          </style>
          <Tooltip.Root>
            {(data) => (
              <>
                <Tooltip.Trigger
                  payload={0}
                  delay={0}
                  data-testid="trigger1"
                  style={{
                    height: '50px',
                    left: '10px',
                    position: 'absolute',
                    top: '10px',
                    width: '100px',
                  }}
                >
                  Trigger 1
                </Tooltip.Trigger>
                <Tooltip.Trigger
                  payload={1}
                  delay={0}
                  data-testid="trigger2"
                  style={{
                    height: '50px',
                    left: '200px',
                    position: 'absolute',
                    top: '100px',
                    width: '100px',
                  }}
                >
                  Trigger 2
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup>
                      <Tooltip.Viewport>
                        <div data-testid="content">Content {data.payload as number}</div>
                      </Tooltip.Viewport>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </>
            )}
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByTestId('trigger1');
      const trigger2 = screen.getByTestId('trigger2');

      await waitSingleFrame();
      trigger1.focus();

      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });

      await waitSingleFrame();
      trigger2.focus();

      // Check for morphing containers during transition
      let previousContainer: HTMLElement | null = null;
      await waitFor(() => {
        previousContainer = document.querySelector('[data-previous]');
        expect(previousContainer).not.to.equal(null);
      });

      expect(previousContainer).to.have.attribute('inert');
      expect(previousContainer!.textContent).to.equal('Content 0');

      const nextContainer = document.querySelector('[data-current]');
      expect(nextContainer).not.to.equal(null);
      expect(nextContainer!.textContent).to.equal('Content 1');

      // Verify they are cleaned up after animation
      await waitFor(() => {
        expect(document.querySelector('[data-previous]')).to.equal(null);
      });

      expect(document.querySelector('[data-current]')).toBeVisible();
      expect(await screen.findByText('Content 1')).toBeVisible();
    });

    it('keeps the latest transition active during rapid trigger changes', async () => {
      function TestComponent() {
        return (
          <div>
            <style>
              {`
              [data-transitioning] [data-previous] {
                animation: slide-out 10s ease-out forwards;
              }
              [data-transitioning] [data-current] {
                animation: slide-in 10s ease-out forwards;
              }
              @keyframes slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(-30%); opacity: 0; }
              }
              @keyframes slide-in {
                from { transform: translateX(30%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}
            </style>
            <Tooltip.Root>
              {(data) => (
                <>
                  <Tooltip.Trigger payload={1} delay={0} data-testid="trigger1">
                    Trigger 1
                  </Tooltip.Trigger>
                  <Tooltip.Trigger payload={2} delay={0} data-testid="trigger2">
                    Trigger 2
                  </Tooltip.Trigger>
                  <Tooltip.Trigger payload={3} delay={0} data-testid="trigger3">
                    Trigger 3
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>
                        <Tooltip.Viewport data-testid="viewport">
                          Content {data.payload as number}
                        </Tooltip.Viewport>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      render(() => <TestComponent />);

      const trigger1 = screen.getByTestId('trigger1');
      const trigger2 = screen.getByTestId('trigger2');
      const trigger3 = screen.getByTestId('trigger3');

      await waitSingleFrame();
      await act(async () => trigger1.focus());
      await waitSingleFrame();
      await act(async () => trigger2.focus());

      await waitFor(() => {
        const currentContainer = screen.getByText('Content 2').closest('[data-current]');
        expect(currentContainer?.getAnimations().length).to.equal(1);
      });
      // Allow `useAnimationsFinished` to begin waiting before replacing the current container.
      await waitSingleFrame();

      await act(async () => trigger3.focus());
      await waitSingleFrame();

      const currentContainer = screen.getByText('Content 3').closest('[data-current]');
      expect(currentContainer?.getAnimations().length).to.equal(1);
      expect(screen.getByTestId('viewport')).to.have.attribute('data-transitioning');
      expect(document.querySelector('[data-previous]')?.textContent).to.include('Content 2');
    });

    it('cleans up the transition when a lagging payload remounts the current container', async () => {
      const [payload2, setPayload2] = createSignal<string | undefined>(undefined);

      function TestComponent() {
        return (
          <div>
            <style>
              {`
              [data-transitioning] [data-current] {
                transition: transform 10s linear, opacity 10s linear;
              }
              [data-transitioning] [data-current][data-starting-style] {
                transform: translateX(30%);
                opacity: 0;
              }
              [data-transitioning] [data-previous] {
                transition: transform 10s linear, opacity 10s linear;
              }
              [data-transitioning] [data-previous][data-ending-style] {
                transform: translateX(-30%);
                opacity: 0;
              }
            `}
            </style>
            <Tooltip.Root>
              {(data) => (
                <>
                  <Tooltip.Trigger
                    delay={0}
                    data-testid="trigger1"
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      width: '100px',
                      height: '50px',
                    }}
                  >
                    Trigger 1
                  </Tooltip.Trigger>
                  <Tooltip.Trigger
                    payload={payload2()}
                    delay={0}
                    data-testid="trigger2"
                    style={{
                      position: 'absolute',
                      top: '100px',
                      left: '200px',
                      width: '100px',
                      height: '50px',
                    }}
                  >
                    Trigger 2
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>
                        <Tooltip.Viewport data-testid="viewport">
                          Content {String(data.payload)}
                        </Tooltip.Viewport>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      render(() => <TestComponent />);

      const trigger1 = screen.getByTestId('trigger1');
      const trigger2 = screen.getByTestId('trigger2');

      await waitSingleFrame();
      await act(async () => trigger1.focus());

      await waitFor(() => {
        expect(document.querySelector('[data-current]')).not.to.equal(null);
      });

      await waitSingleFrame();
      await act(async () => trigger2.focus());

      // The morph is in progress: the previous snapshot exists and both containers
      // are running their (long) transitions.
      await waitFor(() => {
        expect(document.querySelector('[data-previous]')).not.to.equal(null);
      });
      await waitFor(() => {
        expect(
          document.querySelector('[data-previous]')?.getAnimations().length,
        ).to.be.greaterThanOrEqual(1);
      });
      await waitFor(() => {
        expect(
          document.querySelector('[data-current]')?.getAnimations().length,
        ).to.be.greaterThanOrEqual(1);
      });

      // Allow `useAnimationsFinished` to begin waiting before the container is replaced.
      await waitSingleFrame();
      await waitSingleFrame();

      const containerBeforePayload = document.querySelector('[data-current]');

      // The payload for the already-active trigger arrives a render later, which
      // bumps the content key and remounts the current container mid-morph.
      await act(async () => {
        setPayload2('ready');
      });

      await waitFor(() => {
        expect(document.querySelector('[data-current]')).not.to.equal(containerBeforePayload);
      });

      // The remounted container must restart its entry transition, otherwise the
      // cleanup watcher finds nothing to await and truncates the exit transition.
      await waitFor(() => {
        expect(
          document.querySelector('[data-current]')?.getAnimations().length,
        ).to.be.greaterThanOrEqual(1);
      });

      // The previous container's exit transition is still running, so it must not
      // have been torn down in the frames right after the remount.
      await waitSingleFrame();
      await waitSingleFrame();
      await waitSingleFrame();
      await waitSingleFrame();
      expect(document.querySelector('[data-previous]')).not.to.equal(null);

      // Finish the live animations so the cleanup watcher can settle.
      await waitFor(async () => {
        await act(async () => {
          document.querySelectorAll('[data-previous], [data-current]').forEach((el) => {
            el.getAnimations().forEach((animation) => animation.finish());
          });
        });
        expect(document.querySelector('[data-previous]')).to.equal(null);
      });

      await waitFor(() => {
        expect(screen.getByTestId('viewport')).not.to.have.attribute('data-transitioning');
      });
    });

    it.each([
      {
        expectedDirection: ['right', 'down'],
        name: 'should calculate "right down" direction',
        trigger1: { left: 10, top: 10 },
        trigger2: { left: 200, top: 100 },
      },
      {
        expectedDirection: ['left', 'up'],
        name: 'should calculate "left up" direction',
        trigger1: { left: 200, top: 100 },
        trigger2: { left: 10, top: 10 },
      },
      {
        name: 'should calculate "right" direction (horizontal only)',
        trigger1: { left: 10, top: 50 },
        trigger2: { left: 200, top: 52 }, // 2px vertical difference within tolerance
        expectedDirection: ['right'],
      },
      {
        name: 'should calculate "down" direction (vertical only)',
        trigger1: { left: 50, top: 10 },
        trigger2: { left: 52, top: 100 }, // 2px horizontal difference within tolerance
        expectedDirection: ['down'],
      },
      {
        name: 'should handle tolerance for small differences',
        trigger1: { left: 50, top: 50 },
        trigger2: { left: 52, top: 52 }, // Both differences within 5px tolerance
        expectedDirection: [],
      },
      {
        expectedDirection: ['left', 'down'],
        name: 'should calculate "left down" direction',
        trigger1: { left: 200, top: 10 },
        trigger2: { left: 10, top: 100 },
      },
      {
        expectedDirection: ['right', 'up'],
        name: 'should calculate "right up" direction',
        trigger1: { left: 10, top: 100 },
        trigger2: { left: 200, top: 10 },
      },
    ])('$name', async ({ trigger1, trigger2, expectedDirection }) => {
      render(() => (
        <div>
          <style>
            {`
              [data-transitioning] [data-previous] {
                animation: slide-out 0.2s ease-out forwards;
              }
              [data-transitioning] [data-current] {
                animation: slide-in 0.2s ease-out forwards;
              }
              @keyframes slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(-30%); opacity: 0; }
              }
              @keyframes slide-in {
                from { transform: translateX(30%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}
          </style>
          <Tooltip.Root>
            {(data) => (
              <>
                <Tooltip.Trigger
                  payload={0}
                  delay={0}
                  data-testid="trigger1"
                  style={{
                    height: '50px',
                    left: `${trigger1.left}px`,
                    position: 'absolute',
                    top: `${trigger1.top}px`,
                    width: '100px',
                  }}
                >
                  Trigger 1
                </Tooltip.Trigger>
                <Tooltip.Trigger
                  payload={1}
                  delay={0}
                  data-testid="trigger2"
                  style={{
                    height: '50px',
                    left: `${trigger2.left}px`,
                    position: 'absolute',
                    top: `${trigger2.top}px`,
                    width: '100px',
                  }}
                >
                  Trigger 2
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup>
                      <Tooltip.Viewport data-testid="viewport">
                        <div data-testid="content">Content {data.payload as number}</div>
                      </Tooltip.Viewport>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </>
            )}
          </Tooltip.Root>
        </div>
      ));

      const triggerElement1 = screen.getByTestId('trigger1');
      const triggerElement2 = screen.getByTestId('trigger2');

      await waitSingleFrame();
      triggerElement1.focus();

      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });

      await waitSingleFrame();
      triggerElement2.focus();

      const viewport = screen.getByTestId('viewport');
      await waitFor(() => {
        expect(viewport).to.have.attribute('data-activation-direction');
      });

      const direction = viewport.getAttribute('data-activation-direction');

      if (expectedDirection.length === 0) {
        expect(direction?.trim()).to.equal('');
      } else {
        expectedDirection.forEach((dir) => {
          expect(direction).to.contain(dir);
        });
      }
    });
  });
});
