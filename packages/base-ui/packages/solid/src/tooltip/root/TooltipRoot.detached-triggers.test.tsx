import { createRenderer, flushMicrotasks, isJSDOM, randomStringValue, act } from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal, onSettled, Show } from 'solid-js';
import { render as renderSolid } from '@solidjs/web';
import { autofocus } from '../../solid-helpers';

// do not treeshake autofocus
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
autofocus;

describe('<Tooltip.Root />', () => {
  beforeEach(async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;

    act(() => document.body.click());
    // Wait for all tooltips to unmount
    await waitFor(() => {
      const tooltips = document.querySelectorAll('[data-open]');
      expect(tooltips.length).to.equal(0);
    });
  });

  const { render, clock } = createRenderer();

  // Solid: jsdom resolves the client build of `@solidjs/web`, which has no `renderToString`.
  it.skip('keeps a default-open root open until its detached trigger hydrates', () => {});

  // Solid: jsdom resolves the client build of `@solidjs/web`, which has no `renderToString`.
  it.skip('keeps an open root open when ownership moves to a trigger that has not hydrated', () => {});

  describe.skipIf(isJSDOM)('handle-backed root ownership', () => {
    type NumberPayload = { payload: number | undefined };

    it('keeps a default-open root open while a detached trigger migrates after the initial commit', async () => {
      const handle = Tooltip.createHandle();
      const onOpenChange = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);

      let isOpen = false;
      let popupIsOpen = false;

      // Solid: rendered outside the test renderer to keep the browser's native task ordering.
      const dispose = renderSolid(
        () => (
          <>
            <Tooltip.Root
              handle={handle}
              defaultOpen
              defaultTriggerId="trigger"
              onOpenChange={onOpenChange}
            >
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="default-open-content">Content</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Trigger handle={handle} id="trigger">
              Trigger
            </Tooltip.Trigger>
          </>
        ),
        container,
      );

      try {
        await waitFor(() => {
          expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
            'data-popup-open',
          );
        });

        isOpen = handle.isOpen;
        popupIsOpen =
          document
            .querySelector('[data-testid="default-open-content"]')
            ?.hasAttribute('data-open') ?? false;
      } finally {
        dispose();
        container.remove();
      }

      expect(isOpen).toBe(true);
      expect(popupIsOpen).toBe(true);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('ignores imperative handle calls made before a root is attached', async () => {
      const handle = Tooltip.createHandle<number>();

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      handle.open('trigger');
      handle.close();
      const detachedWarnings = consoleWarn.mock.calls.filter(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();

      expect(handle.isOpen).toBe(false);
      expect(detachedWarnings).toHaveLength(2);

      render(() => (
        <div>
          <Tooltip.Trigger handle={handle} id="trigger" payload={1}>
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Root handle={handle}>
            {(data: NumberPayload) => (
              <>
                <span data-testid="payload">{data.payload ?? 'No payload'}</span>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="content">Content</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </>
            )}
          </Tooltip.Root>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.queryByTestId('content')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });
      expect(screen.getByTestId('payload').textContent).toBe('1');
      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('ignores imperative handle calls made after the root is detached', async () => {
      const handle = Tooltip.createHandle<number>();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <div>
            <Tooltip.Trigger handle={handle} id="trigger" payload={1}>
              Trigger
            </Tooltip.Trigger>
            <Show when={!mounted()}>
              <button type="button" onClick={() => setMounted(true)}>
                Remount root
              </button>
            </Show>
            <Show when={mounted()}>
              <Tooltip.Root handle={handle}>
                {(data: NumberPayload) => (
                  <>
                    <span data-testid="payload">{data.payload ?? 'No payload'}</span>
                    <button type="button" onClick={() => setMounted(false)}>
                      Unmount root
                    </button>
                    <Tooltip.Portal>
                      <Tooltip.Positioner>
                        <Tooltip.Popup data-testid="content">Content</Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </>
                )}
              </Tooltip.Root>
            </Show>
          </div>
        );
      }

      const { user } = render(() => <App />);

      act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });
      expect(screen.getByTestId('payload').textContent).toBe('1');

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(handle.isOpen).toBe(false);
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      handle.open('trigger');
      handle.close();
      const detachedWarnings = consoleWarn.mock.calls.filter(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();

      expect(handle.isOpen).toBe(false);
      expect(detachedWarnings).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      expect(screen.queryByTestId('content')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });
      expect(screen.getByTestId('payload').textContent).toBe('1');
    });

    it('registers a detached trigger declared after the root', async () => {
      const handle = Tooltip.createHandle();

      render(() => (
        <div>
          <Tooltip.Root handle={handle}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="content">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Trigger handle={handle} id="trigger">
            Trigger
          </Tooltip.Trigger>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('throws when called with an unregistered trigger id', async () => {
      const handle = Tooltip.createHandle();

      render(() => (
        <div>
          <Tooltip.Root handle={handle}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="content">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Trigger handle={handle} id="trigger">
            Trigger
          </Tooltip.Trigger>
        </div>
      ));

      expect(() => handle.open('missing')).toThrow('was called with the trigger id "missing"');
      expect(handle.isOpen).toBe(false);
    });

    describe('multiple roots sharing one handle', () => {
      // Fake timers so the deferred overlap check only runs when ticked, after the handoff settles.
      clock.withFakeTimers();

      it('warns when a handle stays attached to more than one mounted root', async () => {
        const handle = Tooltip.createHandle();
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(() => (
          <div>
            <Tooltip.Root handle={handle}>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>First</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root handle={handle}>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>Second</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        ));

        // Both roots stay mounted, so the deferred check still sees the overlap and warns.
        clock.tick(20);

        const overlapWarned = consoleWarn.mock.calls.some(
          ([message]) =>
            typeof message === 'string' && message.includes('more than one mounted root'),
        );
        expect(overlapWarned).toBe(true);
        consoleWarn.mockRestore();
      });

      it('resolves a trigger still registered to the previous root during a transient overlap', async () => {
        const handle = Tooltip.createHandle();
        const openErrors: unknown[] = [];

        function OpenOnMount() {
          onSettled(() => {
            try {
              handle.open('trigger');
            } catch (error) {
              openErrors.push(error);
            }
          });
          return null;
        }

        const [phase, setPhase] = createSignal<'outgoing' | 'overlap' | 'incoming'>('outgoing');

        function App() {
          return (
            <>
              <Tooltip.Trigger handle={handle} id="trigger">
                Trigger
              </Tooltip.Trigger>
              <Show when={phase() === 'outgoing' || phase() === 'overlap'}>
                <Tooltip.Root handle={handle}>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>Outgoing</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Show>
              <Show when={phase() === 'overlap' || phase() === 'incoming'}>
                <Tooltip.Root handle={handle}>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>Incoming</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <OpenOnMount />
              </Show>
            </>
          );
        }

        // The detached trigger settles into the outgoing root's store (it is no longer in the
        // fallback map). The incoming root then attaches while the outgoing one is still mounted,
        // and an effect in that same commit opens by trigger id — before the trigger has
        // migrated to the incoming root's store.
        render(() => <App />);
        act(() => setPhase('overlap'));

        expect(openErrors).toHaveLength(0);
        expect(handle.isOpen).toBe(true);
        expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute('data-popup-open');

        // Completing the handoff (the outgoing root unmounts) keeps the popup open and associated.
        act(() => setPhase('incoming'));
        expect(handle.isOpen).toBe(true);
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the tooltip with any trigger on hover', async () => {
      vi.spyOn(console, 'error').mockImplementation((...args) => {
        if (args[0] === 'null') {
          // a bug in vitest prints specific browser errors as "null"
          // See https://github.com/vitest-dev/vitest/issues/9285
          // TODO(@mui/base): debug why this test triggers "ResizeObserver loop completed with undelivered notifications"
          // It seems related to @testing-library/user-event. Native vitest `userEvent` does not trigger it.
          return;
        }
        console.error(...args);
      });

      const popupId = randomStringValue();
      const { user } = render(() => (
        <Tooltip.Root>
          <input type="text" aria-label="Initial focus" autofocus ref={autofocus} />
          <Tooltip.Trigger delay={0}>Trigger 1</Tooltip.Trigger>
          <Tooltip.Trigger delay={0}>Trigger 2</Tooltip.Trigger>
          <Tooltip.Trigger delay={0}>Trigger 3</Tooltip.Trigger>

          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid={popupId}>Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });

      await user.hover(trigger1);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      await user.hover(document.body);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });

      await user.hover(trigger2);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      await user.hover(document.body);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });

      await user.hover(trigger3);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      await user.hover(document.body);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });
    });

    it('should open the tooltip with any trigger on focus', async () => {
      render(() => (
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger 1</Tooltip.Trigger>
          <Tooltip.Trigger>Trigger 2</Tooltip.Trigger>
          <Tooltip.Trigger>Trigger 3</Tooltip.Trigger>

          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Tooltip Content')).to.equal(null);

      trigger1.focus();
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      trigger1.blur();
      await waitFor(() => {
        expect(screen.queryByText('Tooltip Content')).to.equal(null);
      });

      trigger2.focus();
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      trigger2.blur();
      await waitFor(() => {
        expect(screen.queryByText('Tooltip Content')).to.equal(null);
      });

      trigger3.focus();
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      trigger3.blur();
      await waitFor(() => {
        expect(screen.queryByText('Tooltip Content')).to.equal(null);
      });
    });

    it('should set the payload and render content based on its value', async () => {
      const { user } = render(() => (
        <Tooltip.Root>
          {(data: NumberPayload) => (
            <>
              <Tooltip.Trigger payload={1} delay={0}>
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger payload={2} delay={0}>
                Trigger 2
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </>
          )}
        </Tooltip.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.getByTestId('content').textContent).to.equal('1');

      await user.unhover(trigger1);
      await user.hover(trigger2);
      expect(screen.getByTestId('content').textContent).to.equal('2');
    });

    it('hands off open state and payload to a trigger with its own DOM id while open', async () => {
      render(() => (
        <Tooltip.Root>
          {(data: NumberPayload) => (
            <>
              <Tooltip.Trigger
                payload={1}
                delay={0}
                closeDelay={0}
                style={{ 'pointer-events': 'none' }}
              >
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger
                payload={2}
                delay={0}
                closeDelay={0}
                style={{ 'pointer-events': 'none' }}
                render={(props) => <button {...props} id="custom-button" type="button" />}
              >
                Trigger 2
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </>
          )}
        </Tooltip.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      // Focus handoff keeps the popup open across the switch, so `open`/`triggerCount` do not change.
      act(() => trigger1.focus());
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('1');

      act(() => trigger2.focus());
      await flushMicrotasks();
      expect(trigger2).toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    it('should close when the active trigger unmounts', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      function Test() {
        return (
          <div style={{ padding: '50px' }}>
            <Tooltip.Root defaultOpen defaultTriggerId="trigger-1">
              {(data: NumberPayload) => (
                <>
                  <div style={{ display: 'flex', gap: '120px' }}>
                    <Show when={showFirstTrigger()}>
                      <Tooltip.Trigger id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </Tooltip.Trigger>
                    </Show>
                    <Tooltip.Trigger id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </Tooltip.Trigger>
                  </div>

                  <Tooltip.Portal>
                    <Tooltip.Positioner side="bottom" align="start">
                      <Tooltip.Popup>
                        <span data-testid="content">{data.payload}</span>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);
      const onOpenChange = vi.fn((nextOpen: boolean, details: Tooltip.Root.ChangeEventDetails) => {
        if (!nextOpen) {
          details.cancel();
        }
      });

      function Test() {
        return (
          <div style={{ padding: '50px' }}>
            <Tooltip.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={onOpenChange}>
              {(data: NumberPayload) => (
                <>
                  <div style={{ display: 'flex', gap: '120px' }}>
                    <Show when={showFirstTrigger()}>
                      <Tooltip.Trigger id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </Tooltip.Trigger>
                    </Show>
                    <Tooltip.Trigger id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </Tooltip.Trigger>
                  </div>

                  <Tooltip.Portal>
                    <Tooltip.Positioner side="bottom" align="start">
                      <Tooltip.Popup>
                        <span data-testid="content">{data.payload}</span>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.getByTestId('content')).toHaveTextContent('1');
      });
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      render(() => (
        <Tooltip.Root>
          {(data: NumberPayload) => (
            <>
              <Tooltip.Trigger payload={1} delay={0}>
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger payload={2} delay={0}>
                Trigger 2
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Positioner data-testid="positioner">
                  <Tooltip.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </>
          )}
        </Tooltip.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('positioner')).to.equal(positionerElement);
      expect(screen.getByTestId('popup')).to.equal(popupElement);
    });

    it('should allow controlling the tooltip state programmatically', async () => {
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [activeTrigger, setActiveTrigger] = createSignal<string | null>(null);

        return (
          <div>
            <Tooltip.Root
              open={open()}
              triggerId={activeTrigger()}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
            >
              {(data: NumberPayload) => (
                <>
                  <Tooltip.Trigger payload={1} id="trigger-1" delay={0}>
                    Trigger 1
                  </Tooltip.Trigger>
                  <Tooltip.Trigger payload={2} id="trigger-2" delay={0}>
                    Trigger 2
                  </Tooltip.Trigger>

                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>
                        <span data-testid="content">{data.payload}</span>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </>
              )}
            </Tooltip.Root>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-1');
              }}
            >
              Open Trigger 1
            </button>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-2');
              }}
            >
              Open Trigger 2
            </button>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        );
      }

      const { user } = render(() => <Test />);
      await user.click(screen.getByRole('button', { name: 'Open Trigger 1' }));
      expect(screen.getByTestId('content').textContent).to.equal('1');
      await user.click(screen.getByRole('button', { name: 'Open Trigger 2' }));
      expect(screen.getByTestId('content').textContent).to.equal('2');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('content')).to.equal(null);
    });

    it('allows setting an initially open tooltip', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const triggerId = randomStringValue();
      render(() => (
        <Tooltip.Root handle={testTooltip} defaultOpen defaultTriggerId={triggerId}>
          {(data: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
              <Tooltip.Trigger handle={testTooltip} payload={1}>
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger handle={testTooltip} payload={2} id={triggerId}>
                Trigger 2
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </>
          )}
        </Tooltip.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).to.equal('2');
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the tooltip with any trigger on hover', async () => {
      const testTooltip = Tooltip.createHandle();
      const popupId = randomStringValue();
      const { user } = render(() => (
        <div>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 3
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid={popupId}>Tooltip Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
      await user.unhover(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });

      await user.hover(trigger3);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
      await user.unhover(trigger3);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });
    });

    it('should open the tooltip with any trigger on focus', async () => {
      const testTooltip = Tooltip.createHandle();
      render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip}>Trigger 1</Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip}>Trigger 2</Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip}>Trigger 3</Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Tooltip Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Tooltip Content')).to.equal(null);

      trigger1.focus();
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      trigger1.blur();
      await waitFor(() => {
        expect(screen.queryByText('Tooltip Content')).to.equal(null);
      });

      trigger2.focus();
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      trigger2.blur();
      await waitFor(() => {
        expect(screen.queryByText('Tooltip Content')).to.equal(null);
      });

      trigger3.focus();
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      trigger3.blur();
      await waitFor(() => {
        expect(screen.queryByText('Tooltip Content')).to.equal(null);
      });
    });

    it('should close when focusing a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {(data: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      trigger1.focus();
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).to.equal('1');

      trigger2.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).to.equal(null);
      });
      expect(trigger2).not.to.have.attribute('data-popup-open');
    });

    it('should set the payload and render content based on its value', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const { user } = render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} delay={0}>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {(data: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.getByTestId('content').textContent).to.equal('1');

      await user.unhover(trigger1);
      await user.hover(trigger2);
      expect(screen.getByTestId('content').textContent).to.equal('2');
    });

    it('should close when the active detached trigger unmounts', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      function Test() {
        return (
          <div style={{ padding: '50px' }}>
            <div style={{ display: 'flex', gap: '120px' }}>
              <Show when={showFirstTrigger()}>
                <Tooltip.Trigger handle={testTooltip} id="trigger-1" payload={1} delay={0}>
                  Trigger 1
                </Tooltip.Trigger>
              </Show>
              <Tooltip.Trigger handle={testTooltip} id="trigger-2" payload={2} delay={0}>
                Trigger 2
              </Tooltip.Trigger>
            </div>

            <Tooltip.Root handle={testTooltip} defaultOpen defaultTriggerId="trigger-1">
              {(data: NumberPayload) => (
                <Tooltip.Portal>
                  <Tooltip.Positioner side="bottom" align="start">
                    <Tooltip.Popup>
                      <span data-testid="content">{data.payload}</span>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      act(() => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should close when hovering a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const { user } = render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {(data: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('1');
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId('content')).to.equal(null);
      });
      expect(trigger2).not.to.have.attribute('data-popup-open');
    });

    it('should switch to a rendered disabled button trigger when trigger hover is enabled', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const { user } = render(() => (
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger
            handle={testTooltip}
            payload={2}
            delay={0}
            render={(props) => (
              <button {...props} type="button" disabled>
                Trigger 2
              </button>
            )}
          />

          <Tooltip.Root handle={testTooltip}>
            {(data: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('1');
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('2');
      });
      expect(trigger2).to.have.attribute('data-popup-open');
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      render(() => (
        <>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} delay={0}>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {(data: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner data-testid="positioner">
                  <Tooltip.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('popup')).to.equal(popupElement);
      expect(screen.getByTestId('positioner')).to.equal(positionerElement);
    });

    it('should allow controlling the tooltip state programmatically', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [activeTrigger, setActiveTrigger] = createSignal<string | null>(null);

        return (
          <div style={{ margin: '50px' }}>
            <Tooltip.Trigger handle={testTooltip} payload={1} id="trigger-1" delay={0}>
              Trigger 1
            </Tooltip.Trigger>
            <Tooltip.Trigger handle={testTooltip} payload={2} id="trigger-2" delay={0}>
              Trigger 2
            </Tooltip.Trigger>

            <Tooltip.Root
              open={open()}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
              triggerId={activeTrigger()}
              handle={testTooltip}
            >
              {(data: NumberPayload) => (
                <Tooltip.Portal>
                  <Tooltip.Positioner data-testid="positioner" side="bottom" align="start">
                    <Tooltip.Popup>
                      <span data-testid="content">{data.payload}</span>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>

            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-1');
              }}
            >
              Open Trigger 1
            </button>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-2');
              }}
            >
              Open Trigger 2
            </button>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        );
      }

      const { user } = render(() => <Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 1' }));
      expect(screen.getByTestId('content').textContent).to.equal('1');

      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect().left).to.be.approximately(
          trigger1.getBoundingClientRect().left,
          1,
        );
      });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 2' }));
      expect(screen.getByTestId('content').textContent).to.equal('2');
      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect().left).to.be.approximately(
          trigger2.getBoundingClientRect().left,
          1,
        );
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('content')).to.equal(null);
    });

    it('allows setting an initially open tooltip', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const triggerId = randomStringValue();
      render(() => (
        <>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <Tooltip.Trigger handle={testTooltip} payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} id={triggerId}>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip} defaultOpen defaultTriggerId={triggerId}>
            {(data: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).to.equal('2');
      });
    });

    it('should not have inline scale style after switching triggers', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testTooltip = Tooltip.createHandle<number>();

      function Test() {
        return (
          <>
            <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
            <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
              Trigger 1
            </Tooltip.Trigger>
            <Tooltip.Trigger handle={testTooltip} payload={2} delay={0}>
              Trigger 2
            </Tooltip.Trigger>

            <Tooltip.Root handle={testTooltip}>
              {(data: NumberPayload) => (
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="popup">
                      <Tooltip.Viewport>
                        <span data-testid="content">{data.payload}</span>
                      </Tooltip.Viewport>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>
          </>
        );
      }

      const { user } = render(() => <Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      // Open with Trigger 1
      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('1');
      });

      // Switch to Trigger 2
      await user.unhover(trigger1);
      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('2');
      });

      // The popup should not have an inline scale style that would override CSS transitions
      const popup = screen.getByTestId('popup');
      expect(popup.style.scale).to.equal('');
    });
  });

  describe.skipIf(isJSDOM)('imperative actions on the handle', () => {
    it('opens and closes the tooltip', async () => {
      const tooltip = Tooltip.createHandle();
      render(() => (
        <div>
          <Tooltip.Trigger handle={tooltip} id="trigger">
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Root handle={tooltip}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="content">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.queryByTestId('content')).to.equal(null);

      tooltip.open('trigger');
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.to.equal(null);
      });

      expect(screen.getByTestId('content').textContent).to.equal('Content');
      expect(trigger).to.have.attribute('data-popup-open');

      tooltip.close();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).to.equal(null);
      });

      expect(trigger).not.to.have.attribute('data-popup-open');
    });

    it('sets the payload associated with the trigger', async () => {
      const tooltip = Tooltip.createHandle<number>();
      render(() => (
        <div>
          <Tooltip.Trigger handle={tooltip} id="trigger1" payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={tooltip} id="trigger2" payload={2}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Root handle={tooltip}>
            {(data: { payload: number | undefined }) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="content">{data.payload}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      expect(screen.queryByTestId('content')).to.equal(null);

      tooltip.open('trigger2');
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.to.equal(null);
      });

      expect(screen.getByTestId('content').textContent).to.equal('2');
      expect(trigger2).to.have.attribute('data-popup-open');
      expect(trigger1).not.to.have.attribute('data-popup-open');

      tooltip.close();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).to.equal(null);
      });

      expect(trigger2).not.to.have.attribute('data-popup-open');
    });
  });
});
