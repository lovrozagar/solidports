import { act, createRenderer, flushMicrotasks, isJSDOM, randomStringValue } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { screen, waitFor } from '@solidjs/testing-library';
import { createSignal, onSettled, Show } from 'solid-js';
import { render as solidRender } from '@solidjs/web';
import { vi } from 'vitest';
import { OPEN_DELAY } from '../utils/constants';
import { autofocus } from '../../solid-helpers';

// do not treeshake autofocus
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
autofocus;

const CLOSE_TRANSITION_MS = 50;
const CLOSE_TRANSITION_TIMEOUT = 300;

describe('<PreviewCard.Root />', () => {
  beforeEach(async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, clock } = createRenderer();

  describe.skipIf(isJSDOM)('handle-backed root ownership', () => {
    type NumberPayload = { payload: number | undefined };

    it('keeps a default-open root open while a detached trigger migrates after the initial commit', async () => {
      const handle = PreviewCard.createHandle();
      const onOpenChange = vi.fn();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const container = document.createElement('div');
      document.body.appendChild(container);

      let isOpen = false;
      let popupIsOpen = false;
      let unexpectedErrors: unknown[][] = [];
      let dispose: () => void = () => {};

      try {
        // Solid: rendered with `@solidjs/web` directly, outside the test renderer's `act`.
        dispose = solidRender(
          () => (
            <>
              <PreviewCard.Root
                handle={handle}
                defaultOpen
                defaultTriggerId="trigger"
                onOpenChange={onOpenChange}
              >
                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup data-testid="default-open-content">
                      Content
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </PreviewCard.Root>
              <PreviewCard.Trigger handle={handle} id="trigger" href="#">
                Trigger
              </PreviewCard.Trigger>
            </>
          ),
          container,
        );

        await waitFor(() => {
          expect(screen.getByRole('link', { name: 'Trigger' })).toHaveAttribute('data-popup-open');
        });

        isOpen = handle.isOpen;
        popupIsOpen =
          document
            .querySelector('[data-testid="default-open-content"]')
            ?.hasAttribute('data-open') ?? false;
      } finally {
        dispose();
        container.remove();
        unexpectedErrors = consoleError.mock.calls;
        consoleError.mockRestore();
      }

      expect(unexpectedErrors).toEqual([]);
      expect(isOpen).toBe(true);
      expect(popupIsOpen).toBe(true);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('ignores imperative handle calls made before a root is attached', async () => {
      const handle = PreviewCard.createHandle<number>();

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
          <PreviewCard.Trigger handle={handle} id="trigger" href="#" payload={1}>
            Trigger
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle}>
            {(data: NumberPayload) => (
              <>
                <span data-testid="payload">{data.payload ?? 'No payload'}</span>
                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup data-testid="content">Content</PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </>
            )}
          </PreviewCard.Root>
        </div>
      ));

      const trigger = screen.getByRole('link', { name: 'Trigger' });
      expect(screen.queryByTestId('content')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      await act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });
      expect(screen.getByTestId('payload').textContent).toBe('1');
      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('ignores imperative handle calls made after the root is detached', async () => {
      const handle = PreviewCard.createHandle<number>();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <div>
            <PreviewCard.Trigger handle={handle} id="trigger" href="#" payload={1}>
              Trigger
            </PreviewCard.Trigger>
            <Show when={!mounted()}>
              <button type="button" onClick={() => setMounted(true)}>
                Remount root
              </button>
            </Show>
            <Show when={mounted()}>
              <PreviewCard.Root handle={handle}>
                {(data: NumberPayload) => (
                  <>
                    <span data-testid="payload">{data.payload ?? 'No payload'}</span>
                    <button type="button" onClick={() => setMounted(false)}>
                      Unmount root
                    </button>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="content">Content</PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </>
                )}
              </PreviewCard.Root>
            </Show>
          </div>
        );
      }

      const { user } = render(() => <App />);

      await act(() => handle.open('trigger'));
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

      await act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });
      expect(screen.getByTestId('payload').textContent).toBe('1');
    });

    it('registers a detached trigger declared after the root', async () => {
      const handle = PreviewCard.createHandle();

      render(() => (
        <div>
          <PreviewCard.Root handle={handle}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="content">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
          <PreviewCard.Trigger handle={handle} id="trigger" href="#">
            Trigger
          </PreviewCard.Trigger>
        </div>
      ));

      const trigger = screen.getByRole('link', { name: 'Trigger' });

      await act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('throws when called with an unregistered trigger id', async () => {
      const handle = PreviewCard.createHandle();

      render(() => (
        <div>
          <PreviewCard.Root handle={handle}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="content">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
          <PreviewCard.Trigger handle={handle} id="trigger" href="#">
            Trigger
          </PreviewCard.Trigger>
        </div>
      ));

      expect(() => handle.open('missing')).toThrow('was called with the trigger id "missing"');
      expect(handle.isOpen).toBe(false);
    });

    describe('multiple roots sharing one handle', () => {
      // Fake timers so the deferred overlap check only runs when ticked, after the handoff settles.
      clock.withFakeTimers();

      it('warns when a handle stays attached to more than one mounted root', async () => {
        const handle = PreviewCard.createHandle();
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(() => (
          <div>
            <PreviewCard.Root handle={handle}>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>First</PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
            <PreviewCard.Root handle={handle}>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>Second</PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
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
        const handle = PreviewCard.createHandle();
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

        type Phase = 'outgoing' | 'overlap' | 'incoming';

        function App(props: { phase: Phase }) {
          return (
            <>
              <PreviewCard.Trigger handle={handle} id="trigger" href="#">
                Trigger
              </PreviewCard.Trigger>
              <Show when={props.phase === 'outgoing' || props.phase === 'overlap'}>
                <PreviewCard.Root handle={handle}>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup>Outgoing</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
              </Show>
              <Show when={props.phase === 'overlap' || props.phase === 'incoming'}>
                <PreviewCard.Root handle={handle}>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup>Incoming</PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </PreviewCard.Root>
                <OpenOnMount />
              </Show>
            </>
          );
        }

        // The detached trigger settles into the outgoing root's store (it is no longer in the
        // fallback map). The incoming root then attaches while the outgoing one is still mounted,
        // and a mount effect in that same update opens by trigger id — before the trigger has
        // migrated to the incoming root's store.
        const [phase, setPhase] = createSignal<Phase>('outgoing');
        render(() => <App phase={phase()} />);
        act(() => setPhase('overlap'));

        expect(openErrors).toHaveLength(0);
        expect(handle.isOpen).toBe(true);
        expect(screen.getByRole('link', { name: 'Trigger' })).toHaveAttribute('data-popup-open');

        // Completing the handoff (the outgoing root unmounts) keeps the popup open and associated.
        act(() => setPhase('incoming'));
        expect(handle.isOpen).toBe(true);
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the preview card with any trigger on hover', async () => {
      const popupId = randomStringValue();
      const { user } = render(() => (
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid={popupId}>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

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

    it('should open the preview card immediately when hovering another trigger', async () => {
      const popupId = randomStringValue();
      const { user } = render(() => (
        <PreviewCard.Root>
          {(data: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
              <PreviewCard.Trigger href="#" delay={0} payload={1}>
                Trigger 1
              </PreviewCard.Trigger>

              {/* delay should be ignored when moving from already active trigger */}
              <PreviewCard.Trigger href="#" delay={2000} payload={2}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid={popupId}>
                    Content: {data.payload}
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      expect(screen.getByTestId(popupId).textContent).to.equal('Content: 1');

      await user.hover(trigger2);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      expect(screen.getByTestId(popupId).textContent).to.equal('Content: 2');
    });

    it('should open the preview card with any trigger on focus', async () => {
      render(() => (
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

      expect(screen.queryByText('Content')).to.equal(null);

      trigger1.focus();
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      trigger1.blur();
      await waitFor(() => {
        expect(screen.queryByText('Content')).to.equal(null);
      });

      trigger2.focus();
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      trigger2.blur();
      await waitFor(() => {
        expect(screen.queryByText('Content')).to.equal(null);
      });

      trigger3.focus();
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      trigger3.blur();
      await waitFor(() => {
        expect(screen.queryByText('Content')).to.equal(null);
      });
    });

    it('should open again after escape when focusing another trigger', async () => {
      const popupId = randomStringValue();
      const { user } = render(() => (
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid={popupId}>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      trigger1.focus();
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).to.equal(null);
      });

      trigger2.focus();
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
    });

    it('should switch immediately when focusing another trigger while open', async () => {
      render(() => (
        <PreviewCard.Root>
          {(data: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
              <PreviewCard.Trigger href="#" payload={1} delay={0}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" payload={2} delay={2000}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      trigger1.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('1');
      });

      trigger2.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('2');
      });
    });

    it('should set the payload and render content based on its value', async () => {
      const { user } = render(() => (
        <PreviewCard.Root>
          {(data: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
              <PreviewCard.Trigger href="#" payload={1} delay={0}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" payload={2} delay={0}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.getByTestId('content').textContent).to.equal('1');

      await user.unhover(trigger1);
      await user.hover(trigger2);
      expect(screen.getByTestId('content').textContent).to.equal('2');
    });

    it('should close when the active trigger unmounts', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      function Test() {
        return (
          <div style={{ padding: '50px' }}>
            <PreviewCard.Root defaultOpen defaultTriggerId="trigger-1">
              {(data: NumberPayload) => (
                <>
                  <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
                  <div style={{ display: 'flex', gap: '120px' }}>
                    <Show when={showFirstTrigger()}>
                      <PreviewCard.Trigger href="#" id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </PreviewCard.Trigger>
                    </Show>
                    <PreviewCard.Trigger href="#" id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </PreviewCard.Trigger>
                  </div>

                  <PreviewCard.Portal>
                    <PreviewCard.Positioner side="bottom" align="start">
                      <PreviewCard.Popup>
                        <span data-testid="content">{data.payload}</span>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </>
              )}
            </PreviewCard.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);
      const onOpenChange = vi.fn((nextOpen, details: PreviewCard.Root.ChangeEventDetails) => {
        if (!nextOpen) {
          details.cancel();
        }
      });

      function Test() {
        return (
          <div style={{ padding: '50px' }}>
            <PreviewCard.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={onOpenChange}>
              {(data: NumberPayload) => (
                <>
                  <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
                  <div style={{ display: 'flex', gap: '120px' }}>
                    <Show when={showFirstTrigger()}>
                      <PreviewCard.Trigger href="#" id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </PreviewCard.Trigger>
                    </Show>
                    <PreviewCard.Trigger href="#" id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </PreviewCard.Trigger>
                  </div>

                  <PreviewCard.Portal>
                    <PreviewCard.Positioner side="bottom" align="start">
                      <PreviewCard.Popup>
                        <span data-testid="content">{data.payload}</span>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </>
              )}
            </PreviewCard.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
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
        <PreviewCard.Root>
          {(data: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
              <PreviewCard.Trigger href="#" payload={1} delay={0}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" payload={2} delay={0}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner">
                  <PreviewCard.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('positioner')).to.equal(positionerElement);
      expect(screen.getByTestId('popup')).to.equal(popupElement);
    });

    it('should allow controlling the preview card state programmatically', async () => {
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [activeTrigger, setActiveTrigger] = createSignal<string | null>(null);

        return (
          <div>
            <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
            <PreviewCard.Root
              open={open()}
              triggerId={activeTrigger()}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
            >
              {(data: NumberPayload) => (
                <>
                  <PreviewCard.Trigger href="#" payload={1} id="trigger-1" delay={0}>
                    Trigger 1
                  </PreviewCard.Trigger>
                  <PreviewCard.Trigger href="#" payload={2} id="trigger-2" delay={0}>
                    Trigger 2
                  </PreviewCard.Trigger>

                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup>
                        <span data-testid="content">{data.payload as number}</span>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </>
              )}
            </PreviewCard.Root>
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

    it('allows setting an initially open preview card', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const triggerId = randomStringValue();
      render(() => (
        <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId={triggerId}>
          {(data: NumberPayload) => (
            <>
              <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
              <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} id={triggerId}>
                Trigger 2
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </>
          )}
        </PreviewCard.Root>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).to.equal('2');
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the preview card with any trigger on hover', async () => {
      const testPreviewCard = PreviewCard.createHandle();
      const popupId = randomStringValue();
      const { user } = render(() => (
        <div>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid={popupId}>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

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

    it('should open the preview card with any trigger on focus', async () => {
      const testPreviewCard = PreviewCard.createHandle();
      render(() => (
        <div>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

      expect(screen.queryByText('Content')).to.equal(null);

      trigger1.focus();
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      trigger1.blur();
      await waitFor(() => {
        expect(screen.queryByText('Content')).to.equal(null);
      });

      trigger2.focus();
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      trigger2.blur();
      await waitFor(() => {
        expect(screen.queryByText('Content')).to.equal(null);
      });

      trigger3.focus();
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      trigger3.blur();
      await waitFor(() => {
        expect(screen.queryByText('Content')).to.equal(null);
      });
    });

    it('should reposition to a different trigger when reopened with keepMounted=true', async () => {
      const previewCardHandle = PreviewCard.createHandle();
      const { user } = render(() => (
        <div style={{ margin: '50px' }}>
          <PreviewCard.Trigger href="#" handle={previewCardHandle} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={previewCardHandle} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={previewCardHandle}>
            <PreviewCard.Portal keepMounted>
              <PreviewCard.Positioner data-testid="positioner" side="bottom" align="start">
                <PreviewCard.Popup>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const positioner = screen.getByTestId('positioner');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });

      await waitFor(() => {
        expect(
          Math.abs(positioner.getBoundingClientRect().left - trigger1.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });

      await user.unhover(trigger1);

      await waitFor(() => {
        expect(positioner).toHaveAttribute('hidden');
      });

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });

      await waitFor(() => {
        expect(
          Math.abs(positioner.getBoundingClientRect().left - trigger2.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });
    });

    it('should set the payload and render content based on its value', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const { user } = render(() => (
        <div>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {(data: NumberPayload) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.getByTestId('content').textContent).to.equal('1');

      await user.unhover(trigger1);
      await user.hover(trigger2);
      expect(screen.getByTestId('content').textContent).to.equal('2');
    });

    it('should close when the active detached trigger unmounts', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const [showFirstTrigger, setShowFirstTrigger] = createSignal(true);

      function Test() {
        return (
          <div style={{ padding: '50px' }}>
            <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
            <div style={{ display: 'flex', gap: '120px' }}>
              <Show when={showFirstTrigger()}>
                <PreviewCard.Trigger
                  href="#"
                  handle={testPreviewCard}
                  id="trigger-1"
                  payload={1}
                  delay={0}
                >
                  Trigger 1
                </PreviewCard.Trigger>
              </Show>
              <PreviewCard.Trigger
                href="#"
                handle={testPreviewCard}
                id="trigger-2"
                payload={2}
                delay={0}
              >
                Trigger 2
              </PreviewCard.Trigger>
            </div>

            <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId="trigger-1">
              {(data: NumberPayload) => (
                <PreviewCard.Portal>
                  <PreviewCard.Positioner side="bottom" align="start">
                    <PreviewCard.Popup>
                      <span data-testid="content">{data.payload}</span>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              )}
            </PreviewCard.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => setShowFirstTrigger(false));

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      render(() => (
        <>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {(data: NumberPayload) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner">
                  <PreviewCard.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('popup')).to.equal(popupElement);
      expect(screen.getByTestId('positioner')).to.equal(positionerElement);
    });

    it('should allow controlling the preview card state programmatically', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [activeTrigger, setActiveTrigger] = createSignal<string | null>(null);

        return (
          <div style={{ margin: '50px' }}>
            <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
            <PreviewCard.Trigger
              href="#"
              handle={testPreviewCard}
              payload={1}
              id="trigger-1"
              delay={0}
            >
              Trigger 1
            </PreviewCard.Trigger>
            <PreviewCard.Trigger
              href="#"
              handle={testPreviewCard}
              payload={2}
              id="trigger-2"
              delay={0}
            >
              Trigger 2
            </PreviewCard.Trigger>

            <PreviewCard.Root
              open={open()}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
              triggerId={activeTrigger()}
              handle={testPreviewCard}
            >
              {(data: NumberPayload) => (
                <PreviewCard.Portal>
                  <PreviewCard.Positioner data-testid="positioner" side="bottom" align="start">
                    <PreviewCard.Popup>
                      <span data-testid="content">{data.payload}</span>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              )}
            </PreviewCard.Root>

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

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

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

    it('allows setting an initially open preview card', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const triggerId = randomStringValue();
      render(() => (
        <>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} id={triggerId}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId={triggerId}>
            {(data: NumberPayload) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).to.equal('2');
      });
    });

    it('should not have inline scale style after switching triggers', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testPreviewCard = PreviewCard.createHandle<number>();

      function Test() {
        return (
          <>
            <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
            <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
              Trigger 1
            </PreviewCard.Trigger>
            <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={0}>
              Trigger 2
            </PreviewCard.Trigger>

            <PreviewCard.Root handle={testPreviewCard}>
              {(data: NumberPayload) => (
                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup data-testid="popup">
                      <PreviewCard.Viewport>
                        <span data-testid="content">{data.payload}</span>
                      </PreviewCard.Viewport>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              )}
            </PreviewCard.Root>
          </>
        );
      }

      const { user } = render(() => <Test />);

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

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

    it('opens immediately when entering trigger B during trigger A close transition', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-a-to-b-close-transition {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-a-to-b-close-transition ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;
      const { user } = render(() => (
        <>
          <style>{style}</style>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={OPEN_DELAY}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {(data: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      await user.hover(trigger2);

      await waitFor(
        () => {
          expect(screen.getByTestId('content').textContent).toBe('2');
        },
        { timeout: 200 },
      );
    });

    it('still respects trigger B open delay after trigger A close transition finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-a-to-b-post-close-delay {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-a-to-b-post-close-delay ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;
      const { user } = render(() => (
        <>
          <style>{style}</style>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={OPEN_DELAY}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {(data: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      // Once close transition is done, this should behave like a normal delayed open.
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-ending-style');
        },
        { timeout: CLOSE_TRANSITION_TIMEOUT },
      );
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      });

      await user.hover(trigger2);

      // Must not open immediately once close transition has finished.
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
    });

    it('reopens immediately when re-hovering trigger A during its close transition', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-reopen-during-close {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-reopen-during-close ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;

      const { user } = render(() => (
        <>
          <style>{style}</style>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={OPEN_DELAY}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={testPreviewCard}>
            {(data: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      await user.hover(trigger1);

      await waitFor(
        () => {
          expect(screen.getByTestId('content').textContent).toBe('1');
          expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );
    });

    it('respects open delay on later same-trigger hovers after close lifecycle finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-reopen-during-close-delay {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-reopen-during-close-delay ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;

      const { user } = render(() => (
        <>
          <style>{style}</style>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={OPEN_DELAY}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={testPreviewCard}>
            {(data: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{data.payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });

      // First cycle: close and immediate re-hover during close lifecycle should reopen.
      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });
      await user.hover(trigger1);
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );

      // Second cycle: once close lifecycle has fully finished, a fresh hover must honor OPEN_DELAY.
      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      });
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-ending-style');
        },
        { timeout: CLOSE_TRANSITION_TIMEOUT },
      );

      await user.hover(trigger1);

      // Should not reopen immediately this time.
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
    });
  });

  describe.skipIf(isJSDOM)('imperative actions on the handle', () => {
    it('opens and closes the preview card', async () => {
      const handle = PreviewCard.createHandle();
      render(() => (
        <div>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={handle} id="trigger">
            Trigger
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="content">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      const trigger = screen.getByRole('link', { name: 'Trigger' });
      expect(screen.queryByTestId('content')).to.equal(null);

      handle.open('trigger');
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.to.equal(null);
      });

      expect(screen.getByTestId('content').textContent).to.equal('Content');
      expect(trigger).to.have.attribute('data-popup-open');

      handle.close();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).to.equal(null);
      });

      expect(trigger).not.to.have.attribute('data-popup-open');
    });

    it('sets the payload associated with the trigger', async () => {
      const handle = PreviewCard.createHandle<number>();
      render(() => (
        <div>
          <button type="button" aria-label="Initial focus" autofocus ref={autofocus} />
          <PreviewCard.Trigger href="#" handle={handle} id="trigger1" payload={1}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={handle} id="trigger2" payload={2}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle}>
            {(data: { payload: number | undefined }) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="content">{data.payload}</PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      expect(screen.queryByTestId('content')).to.equal(null);

      handle.open('trigger2');
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.to.equal(null);
      });

      expect(screen.getByTestId('content').textContent).to.equal('2');
      expect(trigger2).to.have.attribute('data-popup-open');
      expect(trigger1).not.to.have.attribute('data-popup-open');

      handle.close();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).to.equal(null);
      });

      expect(trigger2).not.to.have.attribute('data-popup-open');
    });
  });
});
