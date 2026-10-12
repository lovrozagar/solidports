import { expect, vi, describe, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import type { UserEvent } from '@testing-library/user-event';
import { createSignal, For, onSettled, Show } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import { isJSDOM } from '../src/utils/testUtils';
import { act } from './act';
import type { BaseUITestRenderer } from './createRenderer';

/**
 * Behavior shared by every popup that supports multiple triggers and detached triggers
 * (`handle` + `createHandle()`).
 *
 * Each multi-trigger scenario runs in two modes:
 * - `contained`: the triggers are children of the Root and no handle is involved, so they register
 *   through the Root's context.
 * - `detached`: the triggers are rendered outside the Root and connected to it with a handle, so they
 *   register through the handle's store.
 *
 * Handle-only behavior (imperative methods, root ownership, reparenting) runs in `detached` mode
 * only. The handle's store bookkeeping is unit tested in `popupHandle.test.ts`; the cases here are
 * the ones that depend on rendering.
 */
export function detachedTriggersConformanceTests(config: DetachedTriggersTestConfig) {
  const {
    render,
    createHandle,
    Root,
    Trigger,
    Portal,
    Positioner,
    Popup,
    Viewport,
    Close,
    triggerProps,
    openInteractions,
    ariaExpanded,
    throwOnMissingTrigger,
  } = config;

  const primaryInteraction = openInteractions[0];
  // Switching the active trigger must keep the popup mounted. Hover-opened popups close on
  // `mouseleave` before the next trigger is entered, so they switch with focus instead.
  const switchInteraction: OpenInteraction = openInteractions.includes('focus')
    ? 'focus'
    : primaryInteraction;

  /**
   * Solid: every option may be a getter, so a signal-backed option updates the fixture as React's
   * `setProps` does.
   */
  function Fixture(props: FixtureProps) {
    const detached = () => props.mode === 'detached';
    const triggerCount = () => props.triggerCount ?? 2;
    const numbers = () => Array.from({ length: triggerCount() }, (_, index) => index + 1);

    function Triggers() {
      return (
        <For each={numbers()}>
          {(number) => (
            <Dynamic
              component={Trigger}
              {...triggerProps}
              {...(detached() ? { handle: props.handle } : {})}
              id={`trigger-${number}`}
              data-testid={`trigger-${number}`}
              payload={number}
            >
              {`Trigger ${number}`}
            </Dynamic>
          )}
        </For>
      );
    }

    function Nested(nestedProps: { level: number }): JSX.Element {
      return (
        <Show when={nestedProps.level > 0} fallback={<Triggers />}>
          <div>
            <Nested level={nestedProps.level - 1} />
          </div>
        </Show>
      );
    }

    // A new nesting depth (or handle) remounts the triggers, as React's reparenting does.
    const triggers = () => (
      <Show when={[props.nesting ?? 0, props.handle] as const} keyed>
        {([nesting]) => <Nested level={nesting} />}
      </Show>
    );

    function renderPopup(payload: () => unknown) {
      const content = () => {
        const span = <span data-testid="content">{String(payload())}</span>;
        return props.withViewport && Viewport ? (
          <Dynamic component={Viewport}>{span}</Dynamic>
        ) : (
          span
        );
      };

      const popup = () => (
        <Dynamic component={Popup} data-testid="popup">
          {content()}
          {Close && <Dynamic component={Close}>Close popup</Dynamic>}
        </Dynamic>
      );

      return (
        <Dynamic component={Portal}>
          {Positioner ? (
            <Dynamic component={Positioner} data-testid="positioner" {...props.positionerProps}>
              {popup()}
            </Dynamic>
          ) : (
            popup()
          )}
        </Dynamic>
      );
    }

    const root = () => (
      <Show when={props.rootMounted ?? true}>
        <Show when={[props.handle] as const} keyed>
          {([handle]) => (
            <Dynamic component={Root} {...(detached() ? { handle } : {})} {...props.rootProps}>
              {(data: { payload: unknown }) => (
                <>
                  {!detached() && triggers()}
                  <span data-testid="root-payload">
                    {data.payload === undefined ? 'No payload' : String(data.payload)}
                  </span>
                  {renderPopup(() => data.payload)}
                </>
              )}
            </Dynamic>
          )}
        </Show>
      </Show>
    );

    return (
      <Show when={detached()} fallback={root()}>
        {props.rootFirst ? (
          <>
            {root()}
            {triggers()}
          </>
        ) : (
          <>
            {triggers()}
            {root()}
          </>
        )}
      </Show>
    );
  }

  function getTrigger(number: number) {
    return screen.getByTestId(`trigger-${number}`);
  }

  async function openWith(interaction: OpenInteraction, user: UserEvent, trigger: HTMLElement) {
    if (interaction === 'click') {
      await user.click(trigger);
    } else if (interaction === 'hover') {
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
    } else {
      await act(async () => trigger.focus());
    }
  }

  async function closeWith(interaction: OpenInteraction, user: UserEvent, trigger: HTMLElement) {
    if (interaction === 'click') {
      if (Close) {
        await user.click(screen.getByText('Close popup'));
      } else {
        await user.keyboard('{Escape}');
      }
    } else if (interaction === 'hover') {
      fireEvent.mouseLeave(trigger);
    } else {
      await act(async () => trigger.blur());
    }
  }

  async function switchTrigger(
    interaction: OpenInteraction,
    user: UserEvent,
    from: HTMLElement,
    to: HTMLElement,
  ) {
    if (interaction === 'hover') {
      fireEvent.mouseLeave(from);
      fireEvent.mouseEnter(to);
      fireEvent.mouseMove(to);
    } else {
      await openWith(interaction, user, to);
    }
  }

  async function waitForPopupOpen() {
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });
  }

  async function waitForPopupClosed() {
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  }

  async function waitForContent(text: string) {
    await waitFor(() => {
      expect(screen.getByTestId('content').textContent).toBe(text);
    });
  }

  /**
   * Asserts that only the trigger with the given number is marked as the popup's active trigger
   * (or that none is, when `activeNumber` is `null`).
   */
  function expectActiveTrigger(activeNumber: number | null, triggerCount = 2) {
    const popupId = activeNumber === null ? null : screen.getByTestId('popup').id;

    for (let number = 1; number <= triggerCount; number += 1) {
      const trigger = getTrigger(number);
      const active = number === activeNumber;

      if (active) {
        expect(trigger).toHaveAttribute('data-popup-open');
      } else {
        expect(trigger).not.toHaveAttribute('data-popup-open');
      }

      if (ariaExpanded) {
        expect(trigger).toHaveAttribute('aria-expanded', String(active));
        if (active) {
          expect(popupId).not.toBe('');
          expect(trigger).toHaveAttribute('aria-controls', popupId);
        } else if (popupId !== null) {
          expect(trigger).not.toHaveAttribute('aria-controls');
        }
      }
    }
  }

  function countWarnings(consoleWarn: { mock: { calls: unknown[][] } }, text: string) {
    return consoleWarn.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes(text),
    ).length;
  }

  describe('detached triggers conformance', () => {
    describe.each([{ mode: 'contained' as const }, { mode: 'detached' as const }])(
      '$mode triggers',
      ({ mode }) => {
        // In `contained` mode the handle is never passed to the parts.
        const getHandle = () => (mode === 'detached' ? createHandle() : undefined);

        describe.skipIf(isJSDOM)('multiple triggers', () => {
          it.each(openInteractions.map((interaction) => ({ interaction })))(
            'opens with any trigger on $interaction and marks only that trigger as active',
            async ({ interaction }) => {
              const handle = getHandle();
              const { user } = render(() => (
                <Fixture mode={mode} handle={handle} triggerCount={3} />
              ));

              expect(screen.queryByTestId('popup')).toBe(null);
              expectActiveTrigger(null, 3);

              for (const number of [1, 2, 3]) {
                const trigger = getTrigger(number);

                // eslint-disable-next-line no-await-in-loop
                await openWith(interaction, user, trigger);
                // eslint-disable-next-line no-await-in-loop
                await waitForPopupOpen();
                expectActiveTrigger(number, 3);
                // eslint-disable-next-line no-await-in-loop
                await closeWith(interaction, user, trigger);
                // eslint-disable-next-line no-await-in-loop
                await waitForPopupClosed();
                expectActiveTrigger(null, 3);
              }
            },
          );

          it('sets the payload of the active trigger and renders content based on it', async () => {
            const handle = getHandle();
            const { user } = render(() => <Fixture mode={mode} handle={handle} />);

            await openWith(primaryInteraction, user, getTrigger(1));
            await waitForContent('1');
            expect(screen.getByTestId('root-payload').textContent).toBe('1');

            await switchTrigger(primaryInteraction, user, getTrigger(1), getTrigger(2));
            await waitForContent('2');
            expect(screen.getByTestId('root-payload').textContent).toBe('2');
            expectActiveTrigger(2);
          });

          it('reuses the popup DOM nodes when switching triggers', async () => {
            const handle = getHandle();
            const { user } = render(() => <Fixture mode={mode} handle={handle} />);

            await openWith(switchInteraction, user, getTrigger(1));
            await waitForContent('1');
            const popupElement = screen.getByTestId('popup');
            const positionerElement = screen.queryByTestId('positioner');

            await switchTrigger(switchInteraction, user, getTrigger(1), getTrigger(2));
            await waitForContent('2');
            expect(screen.getByTestId('popup')).toBe(popupElement);
            expect(screen.queryByTestId('positioner')).toBe(positionerElement);
          });

          it('marks the trigger matching a controlled `triggerId` as active', async () => {
            const handle = getHandle();
            render(() => (
              <Fixture
                mode={mode}
                handle={handle}
                rootProps={{ open: true, triggerId: 'trigger-2' }}
              />
            ));

            await waitForPopupOpen();
            expect(screen.getByTestId('content').textContent).toBe('2');
            expectActiveTrigger(2);
          });

          it('opens initially with the payload of a non-first `defaultTriggerId`', async () => {
            const handle = getHandle();
            render(() => (
              <Fixture
                mode={mode}
                handle={handle}
                triggerCount={3}
                rootProps={{ defaultOpen: true, defaultTriggerId: 'trigger-2' }}
              />
            ));

            await waitForContent('2');
            expectActiveTrigger(2, 3);
          });

          it('allows controlling the open state and active trigger programmatically', async () => {
            const handle = getHandle();

            function Controlled() {
              const [open, setOpen] = createSignal(false);
              const [triggerId, setTriggerId] = createSignal<string | null>(null);

              return (
                <div style={{ margin: '50px' }}>
                  <Fixture
                    mode={mode}
                    handle={handle}
                    rootProps={{
                      get open() {
                        return open();
                      },
                      get triggerId() {
                        return triggerId();
                      },
                      onOpenChange: (
                        nextOpen: boolean,
                        details: { trigger: Element | undefined },
                      ) => {
                        setTriggerId(details.trigger?.id ?? null);
                        setOpen(nextOpen);
                      },
                    }}
                    positionerProps={{ side: 'bottom', align: 'start' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(true);
                      setTriggerId('trigger-1');
                    }}
                  >
                    Open Trigger 1
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(true);
                      setTriggerId('trigger-2');
                    }}
                  >
                    Open Trigger 2
                  </button>
                  <button type="button" onClick={() => setOpen(false)}>
                    Close externally
                  </button>
                </div>
              );
            }

            const { user } = render(() => <Controlled />);

            // Queried up front: a modal popup hides the rest of the page from the accessibility tree.
            const openTrigger1 = screen.getByRole('button', { name: 'Open Trigger 1' });
            const openTrigger2 = screen.getByRole('button', { name: 'Open Trigger 2' });
            const closeExternally = screen.getByRole('button', { name: 'Close externally' });

            await user.click(openTrigger1);
            await waitForContent('1');
            expectActiveTrigger(1);
            await expectPositionerAlignedWith(getTrigger(1));

            await user.click(openTrigger2);
            await waitForContent('2');
            expectActiveTrigger(2);
            await expectPositionerAlignedWith(getTrigger(2));

            if (Close) {
              await user.click(screen.getByText('Close popup'));
              await waitForPopupClosed();
              // Focus returns to the element that opened the popup.
              await waitFor(() => {
                // eslint-disable-next-line vitest/no-conditional-expect -- only popups with a Close part can be closed from inside
                expect(openTrigger2).toHaveFocus();
              });
            } else {
              await user.click(closeExternally);
              await waitForPopupClosed();
            }
            expectActiveTrigger(null);
          });

          if (Viewport) {
            it('does not leave an inline scale style on the popup after switching triggers', async () => {
              globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

              try {
                const onOpenChange = vi.fn();
                const handle = getHandle();
                const { user } = render(() => (
                  <Fixture mode={mode} handle={handle} rootProps={{ onOpenChange }} withViewport />
                ));

                await openWith(switchInteraction, user, getTrigger(1));
                await waitForContent('1');

                await switchTrigger(switchInteraction, user, getTrigger(1), getTrigger(2));
                await waitForContent('2');

                // The trigger changed while the popup stayed open, rather than closing and reopening.
                expect(onOpenChange).toHaveBeenCalled();
                expect(onOpenChange.mock.calls.map(([open]) => open)).not.toContain(false);
                // An inline scale would override CSS transitions on the popup.
                expect(screen.getByTestId('popup').style.scale).toBe('');
              } finally {
                globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
              }
            });
          }
        });
      },
    );

    describe('detached triggers', () => {
      describe('imperative actions on the handle', () => {
        it('opens by trigger id with its payload and closes', async () => {
          const handle = createHandle();
          render(() => <Fixture mode="detached" handle={handle} />);

          expect(screen.queryByTestId('popup')).toBe(null);
          expect(handle.isOpen).toBe(false);

          act(() => handle.open('trigger-2'));
          await waitForContent('2');
          expect(handle.isOpen).toBe(true);
          expectActiveTrigger(2);

          act(() => handle.close());
          await waitForPopupClosed();
          expect(handle.isOpen).toBe(false);
          expectActiveTrigger(null);
        });

        if (throwOnMissingTrigger) {
          it('throws when opened with an unregistered trigger id', async () => {
            const handle = createHandle();
            render(() => <Fixture mode="detached" handle={handle} />);

            expect(() => handle.open('missing')).toThrow(
              'was called with the trigger id "missing", but no matching trigger is registered',
            );
            expect(handle.isOpen).toBe(false);
          });
        } else {
          it('opens unassociated with a warning when opened with an unregistered trigger id', async () => {
            const handle = createHandle();
            render(() => <Fixture mode="detached" handle={handle} />);

            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            try {
              act(() => handle.open('missing'));
              expect(countWarnings(consoleWarn, 'No trigger found with id "missing"')).toBe(1);
            } finally {
              consoleWarn.mockRestore();
            }

            await waitForPopupOpen();
            expect(handle.isOpen).toBe(true);
            expectActiveTrigger(null);
          });
        }
      });

      describe('root ownership', () => {
        it('ignores imperative calls while no root is attached and follows the root across remounts', async () => {
          const handle = createHandle();
          const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

          try {
            handle.open('trigger-1');
            handle.close();
            expect(handle.isOpen).toBe(false);
            expect(countWarnings(consoleWarn, 'no root using this handle is mounted')).toBe(2);

            const [rootMounted, setRootMounted] = createSignal(true);
            render(() => <Fixture mode="detached" handle={handle} rootMounted={rootMounted()} />);
            expect(screen.queryByTestId('popup')).toBe(null);
            expect(screen.getByTestId('root-payload').textContent).toBe('No payload');

            act(() => handle.open('trigger-1'));
            await waitForContent('1');
            expect(handle.isOpen).toBe(true);

            // Unmounting the root while open detaches it from the handle.
            act(() => setRootMounted(false));
            expect(handle.isOpen).toBe(false);
            expect(screen.queryByTestId('popup')).toBe(null);

            consoleWarn.mockClear();
            handle.open('trigger-1');
            handle.close();
            expect(handle.isOpen).toBe(false);
            expect(countWarnings(consoleWarn, 'no root using this handle is mounted')).toBe(2);

            // A remounted root starts closed, without the previous payload, and is controllable.
            act(() => setRootMounted(true));
            expect(screen.queryByTestId('popup')).toBe(null);
            expect(screen.getByTestId('root-payload').textContent).toBe('No payload');

            act(() => handle.open('trigger-2'));
            await waitForContent('2');
            expect(handle.isOpen).toBe(true);
          } finally {
            consoleWarn.mockRestore();
          }
        });

        it('registers a detached trigger declared after the root', async () => {
          const handle = createHandle();
          const { user } = render(() => <Fixture mode="detached" handle={handle} rootFirst />);

          await openWith(primaryInteraction, user, getTrigger(2));
          await waitForContent('2');
          expectActiveTrigger(2);
        });

        it('resolves a trigger still registered to the previous root during a transient overlap', async () => {
          const handle = createHandle();
          const openErrors: unknown[] = [];
          const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

          function OpenOnMount() {
            onSettled(() => {
              try {
                handle.open('trigger-2');
              } catch (error) {
                openErrors.push(error);
              }
            });
            return null;
          }

          function RootWithPopup(rootProps: { label: string }) {
            const popup = () => <Dynamic component={Popup}>{rootProps.label}</Dynamic>;
            return (
              <Dynamic component={Root} handle={handle}>
                <Dynamic component={Portal}>
                  {Positioner ? <Dynamic component={Positioner}>{popup()}</Dynamic> : popup()}
                </Dynamic>
              </Dynamic>
            );
          }

          const [phase, setPhase] = createSignal<'outgoing' | 'overlap' | 'incoming'>('outgoing');

          function App() {
            return (
              <>
                <For each={[1, 2]}>
                  {(number) => (
                    <Dynamic
                      component={Trigger}
                      {...triggerProps}
                      handle={handle}
                      id={`trigger-${number}`}
                      data-testid={`trigger-${number}`}
                    >
                      {`Trigger ${number}`}
                    </Dynamic>
                  )}
                </For>
                <Show when={phase() === 'outgoing' || phase() === 'overlap'}>
                  <RootWithPopup label="outgoing" />
                </Show>
                <Show when={phase() === 'overlap' || phase() === 'incoming'}>
                  <RootWithPopup label="incoming" />
                  <OpenOnMount />
                </Show>
              </>
            );
          }

          try {
            // The detached trigger settles into the outgoing root's store (it is no longer in the
            // fallback map). The incoming root then attaches while the outgoing one is still
            // mounted, and a mount callback in that same flush opens by trigger id, before the
            // trigger has migrated to the incoming root's store.
            render(() => <App />);
            act(() => setPhase('overlap'));
            await Promise.resolve();

            expect(openErrors).toEqual([]);
            expect(countWarnings(consoleWarn, 'No trigger found')).toBe(0);
            expect(handle.isOpen).toBe(true);
            expect(getTrigger(2)).toHaveAttribute('data-popup-open');
            expect(getTrigger(1)).not.toHaveAttribute('data-popup-open');

            // Completing the handoff (the outgoing root unmounts) keeps the popup open and
            // associated.
            act(() => setPhase('incoming'));
            expect(handle.isOpen).toBe(true);
            expect(getTrigger(2)).toHaveAttribute('data-popup-open');
            expect(getTrigger(1)).not.toHaveAttribute('data-popup-open');
          } finally {
            consoleWarn.mockRestore();
          }
        });
      });

      describe.skipIf(isJSDOM)('reparenting', () => {
        async function expectOpensAndCloses(user: UserEvent) {
          await openWith(primaryInteraction, user, getTrigger(1));
          await waitForPopupOpen();
          expectActiveTrigger(1, 1);
          await closeWith(primaryInteraction, user, getTrigger(1));
          await waitForPopupClosed();
        }

        it.each([
          { name: 'when wrappers are removed', nestings: [3, 2, 1, 0], recreateHandle: false },
          { name: 'when wrappers are added', nestings: [0, 1, 2, 3], recreateHandle: false },
          {
            name: 'during Fast Refresh-like handle recreation',
            nestings: [1, 1, 1],
            recreateHandle: true,
          },
          {
            name: 'when reparented during Fast Refresh-like handle recreation',
            nestings: [3, 2, 1, 0],
            recreateHandle: true,
          },
        ])('keeps a detached trigger working $name', async ({ nestings, recreateHandle }) => {
          const [initialNesting, ...nextNestings] = nestings;
          const [nesting, setNesting] = createSignal(initialNesting);
          const [handle, setHandle] = createSignal(createHandle());
          const { user } = render(() => (
            <Fixture mode="detached" handle={handle()} triggerCount={1} nesting={nesting()} />
          ));

          await expectOpensAndCloses(user);

          for (const next of nextNestings) {
            act(() => {
              setNesting(next);
              if (recreateHandle) {
                setHandle(createHandle());
              }
            });
            // eslint-disable-next-line no-await-in-loop
            await expectOpensAndCloses(user);
          }
        });
      });
    });
  });

  async function expectPositionerAlignedWith(trigger: HTMLElement) {
    if (!Positioner) {
      return;
    }

    await waitFor(() => {
      expect(
        Math.abs(
          screen.getByTestId('positioner').getBoundingClientRect().left -
            trigger.getBoundingClientRect().left,
        ),
      ).toBeLessThanOrEqual(1);
    });
  }
}

type OpenInteraction = 'click' | 'hover' | 'focus';

// Parts of different components have unrelated prop types; the suite only passes props that every
// tested component accepts.
type AnyComponent = Component<any>;

export interface DetachedTriggersTestHandle {
  open(triggerId: string): void;
  close(): void;
  readonly isOpen: boolean;
}

export interface DetachedTriggersTestConfig {
  /**
   * Render function returned from `createRenderer`.
   */
  render: BaseUITestRenderer['render'];
  /**
   * Creates a new handle for the tested component, e.g. `Popover.createHandle`.
   */
  createHandle: () => DetachedTriggersTestHandle;
  Root: AnyComponent;
  Trigger: AnyComponent;
  Portal: AnyComponent;
  /**
   * Omit for popups that are not anchored to their trigger.
   */
  Positioner?: AnyComponent;
  Popup: AnyComponent;
  /**
   * Enables the inline scale check after switching triggers.
   */
  Viewport?: AnyComponent;
  /**
   * When provided, click-opened popups are closed with it, and the programmatic test checks that
   * focus returns to the element that opened the popup.
   */
  Close?: AnyComponent;
  /**
   * Props applied to every trigger, e.g. `{ href: '#', delay: 0 }`.
   */
  triggerProps?: Record<string, unknown>;
  /**
   * Interactions that open the popup from a trigger. The first one is the primary interaction.
   */
  openInteractions: readonly [OpenInteraction, ...OpenInteraction[]];
  /**
   * Whether triggers expose `aria-expanded` and `aria-controls`.
   */
  ariaExpanded: boolean;
  /**
   * Whether `handle.open()` throws for an unregistered trigger id (anchored popups) instead of
   * opening unassociated with a warning (Dialog).
   */
  throwOnMissingTrigger: boolean;
}

interface FixtureProps {
  mode: 'contained' | 'detached';
  handle?: DetachedTriggersTestHandle | undefined;
  triggerCount?: number;
  rootProps?: Record<string, unknown>;
  rootMounted?: boolean;
  /**
   * Renders the detached triggers after the Root.
   */
  rootFirst?: boolean;
  /**
   * Number of wrapper elements around the triggers.
   */
  nesting?: number;
  positionerProps?: Record<string, unknown>;
  withViewport?: boolean;
}
