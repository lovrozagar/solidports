import {
  act,
  createRenderer,
  detachedTriggersConformanceTests,
  flushMicrotasks,
  isJSDOM,
  randomStringValue,
} from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, onSettled, Show } from 'solid-js';
import { render as solidRender } from '@solidjs/web';
import { expect, vi, describe, beforeEach, it } from 'vitest';
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

  detachedTriggersConformanceTests({
    render,
    createHandle: PreviewCard.createHandle,
    Root: PreviewCard.Root,
    Trigger: PreviewCard.Trigger,
    Portal: PreviewCard.Portal,
    Positioner: PreviewCard.Positioner,
    Popup: PreviewCard.Popup,
    Viewport: PreviewCard.Viewport,
    // Keeps the real browser pointer from hovering the triggers; the suite dispatches the events.
    triggerProps: { href: '#', delay: 0, closeDelay: 0, style: { pointerEvents: 'none' } },
    openInteractions: ['hover', 'focus'],
    ariaExpanded: false,
    throwOnMissingTrigger: true,
  });

  describe('does not re-render inactive triggers', () => {
    async function renderPreviewCard() {
      const handle = PreviewCard.createHandle();
      const bystander = { renders: 0 };

      await render(() => (
        <div>
          <PreviewCard.Trigger handle={handle} id="trigger-1" href="#" delay={0} closeDelay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger handle={handle} id="trigger-2" href="#" delay={0} closeDelay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger
            handle={handle}
            id="trigger-3"
            render={(props) => {
              bystander.renders += 1;
              return <a {...props} />;
            }}
          >
            Trigger 3
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="popup">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>
      ));

      bystander.renders = 0;
      return {
        handle,
        bystander,
        trigger1: screen.getByText('Trigger 1'),
        trigger2: screen.getByText('Trigger 2'),
      };
    }

    async function expectOpenedBy(trigger: HTMLElement) {
      expect(await screen.findByTestId('popup')).not.toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-popup-open');
      });
    }

    async function expectClosed(trigger: HTMLElement) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).not.toHaveAttribute('data-popup-open');
    }

    it('when opened and closed imperatively', async () => {
      const { handle, bystander, trigger1 } = await renderPreviewCard();

      async function openAndClose() {
        await act(() => handle.open('trigger-1'));
        await expectOpenedBy(trigger1);
        await act(() => handle.close());
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { handle, bystander, trigger1, trigger2 } = await renderPreviewCard();

      await act(() => handle.open('trigger-1'));
      await expectOpenedBy(trigger1);
      await act(() => handle.open('trigger-2'));
      await expectOpenedBy(trigger2);
      expect(trigger1).not.toHaveAttribute('data-popup-open');
      await act(() => handle.close());
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });

    it('when focus opens and closes the popup', async () => {
      const { bystander, trigger1 } = await renderPreviewCard();

      async function openAndClose() {
        await act(async () => trigger1.focus());
        await expectOpenedBy(trigger1);
        await act(async () => trigger1.blur());
        await expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when hover opens and closes the popup', async () => {
      const { bystander, trigger1, trigger2 } = await renderPreviewCard();

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      await expectOpenedBy(trigger1);
      fireEvent.mouseLeave(trigger1);
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await expectOpenedBy(trigger2);
      fireEvent.mouseLeave(trigger2);
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });
  });

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
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

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
      expect(screen.getByTestId(popupId).textContent).toBe('Content: 1');

      await user.hover(trigger2);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      expect(screen.getByTestId(popupId).textContent).toBe('Content: 2');
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
        expect(screen.queryByTestId(popupId)).toBe(null);
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
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      trigger2.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
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
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
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
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content')).toHaveTextContent('1');
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

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
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
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
          expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
        },
        { timeout: 200 },
      );
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
      expect(screen.getByTestId('content').textContent).toBe('1');
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
        },
        { timeout: 200 },
      );
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');

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
});
