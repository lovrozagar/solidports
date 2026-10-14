import {
  act,
  createRenderer,
  detachedTriggersConformanceTests,
  flushMicrotasks,
  isJSDOM,
  randomStringValue,
} from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect, vi, describe, beforeEach, it } from 'vitest';
import { createSignal, onSettled, Show } from 'solid-js';
import { render as renderSolid } from '@solidjs/web';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures, { fixtureState } from './TooltipRoot.detached-triggers.ssr-fixtures';
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
      expect(tooltips.length).toBe(0);
    });
  });

  const { render, clock } = createRenderer();

  it.skipIf(!isJSDOM)(
    'keeps a default-open root open until its detached trigger hydrates',
    async () => {
      fixtureState.reset();
      // Solid: the gate resolves after `hydrate()` has returned, so Solid mounts the trigger fresh
      // instead of claiming its server node (and warns once about the unclaimed node); React keeps
      // the server node. The behavior under test, the root staying open until the trigger mounts,
      // is the same.
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { hydrate } = renderServer(fixtures, 'delayedTrigger');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(trigger).not.toHaveAttribute('data-popup-open');

      fixtureState.suspend = true;
      hydrate();
      const handle = fixtureState.handle;

      try {
        await waitFor(() => {
          expect(handle.isOpen).toBe(true);
        });
        await flushMicrotasks();
        expect(handle.isOpen).toBe(true);
      } finally {
        fixtureState.suspend = false;
        await act(async () => {
          fixtureState.resume?.();
          await fixtureState.gate;
        });
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute('data-popup-open');
      });
      expect(warn.mock.calls.map((args) => String(args[0]))).toEqual([
        expect.stringMatching(/^Hydration completed with 1 unclaimed server-rendered node/),
      ]);
      warn.mockRestore();
    },
  );

  it('keeps an open root open when ownership moves to a trigger that has not hydrated', async () => {
    fixtureState.reset();
    const onOpenChange = vi.fn();
    fixtureState.onOpenChange = onOpenChange;
    const handle = fixtureState.handle;

    const { hydrate } = renderServer(fixtures, 'switchingApp');
    const triggerB = renderServer(fixtures, 'triggerB');

    hydrate();

    await waitFor(() => {
      expect(handle.isOpen).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Switch to B' }));
    await flushMicrotasks();

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(handle.isOpen).toBe(true);

    await act(async () => {
      triggerB.hydrate();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Trigger B' })).toHaveAttribute('data-popup-open');
    });
  });

  detachedTriggersConformanceTests({
    render,
    createHandle: Tooltip.createHandle,
    Root: Tooltip.Root,
    Trigger: Tooltip.Trigger,
    Portal: Tooltip.Portal,
    Positioner: Tooltip.Positioner,
    Popup: Tooltip.Popup,
    Viewport: Tooltip.Viewport,
    // Keeps the real browser pointer from hovering the triggers; the suite dispatches the events.
    triggerProps: { delay: 0, style: { pointerEvents: 'none' } },
    openInteractions: ['hover', 'focus'],
    ariaExpanded: false,
    throwOnMissingTrigger: true,
  });

  describe('does not re-render inactive triggers', () => {
    async function renderTooltip() {
      const handle = Tooltip.createHandle();
      const bystander = { renders: 0 };

      await render(() => (
        <div>
          <Tooltip.Trigger handle={handle} id="trigger-1" delay={0} closeDelay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={handle} id="trigger-2" delay={0} closeDelay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger
            handle={handle}
            id="trigger-3"
            render={(props) => {
              bystander.renders += 1;
              return <button {...props} />;
            }}
          >
            Trigger 3
          </Tooltip.Trigger>
          <Tooltip.Root handle={handle}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      ));

      bystander.renders = 0;
      return {
        handle,
        bystander,
        trigger1: screen.getByRole('button', { name: 'Trigger 1' }),
        trigger2: screen.getByRole('button', { name: 'Trigger 2' }),
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
      const { handle, bystander, trigger1 } = await renderTooltip();

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
      const { handle, bystander, trigger1, trigger2 } = await renderTooltip();

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
      const { bystander, trigger1 } = await renderTooltip();

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
      const { bystander, trigger1, trigger2 } = await renderTooltip();

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

  it('closes a cursor-tracking tooltip when an inactive trigger is pressed', async () => {
    const handle = Tooltip.createHandle();

    await render(() => (
      <div>
        <Tooltip.Trigger handle={handle} id="trigger-1">
          Trigger 1
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="trigger-2">
          Trigger 2
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle} trackCursorAxis="both">
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    ));

    await act(() => handle.open('trigger-1'));
    expect(await screen.findByTestId('popup')).not.toBe(null);

    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    fireEvent.pointerDown(trigger2, { pointerType: 'touch' });
    fireEvent.click(trigger2);

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

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
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

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
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
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
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('content')).toHaveTextContent('1');
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

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
      expect(screen.getByTestId('content').textContent).toBe('1');

      trigger2.focus();
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
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
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
      expect(trigger2).not.toHaveAttribute('data-popup-open');
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
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
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
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
      expect(trigger2).toHaveAttribute('data-popup-open');
    });
  });
});
