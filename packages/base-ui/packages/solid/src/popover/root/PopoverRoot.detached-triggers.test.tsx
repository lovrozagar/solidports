import { act, createRenderer, isJSDOM } from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';
import { screen, waitFor } from '@solidjs/testing-library';
import { createRenderEffect, createSignal, For, Match, Show, Switch, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { vi } from 'vitest';
import { splitProps } from '../../solid-1-compat';

describe('<Popover.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  // Stands in for ref mergers like `@rc-component/util`'s `useComposeRef`, which retain the
  // callback they were first given. Solid: a single-item `For` keyed by `nodeKey` swaps the host
  // node.
  function StaleRefButton(
    props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { nodeKey?: string },
  ) {
    const [local, rest] = splitProps(props, ['nodeKey', 'ref']);
    const staleRef = untrack(() => local.ref);
    return (
      <For each={[local.nodeKey ?? 'default']}>{() => <button {...rest} ref={staleRef} />}</For>
    );
  }

  it('opens by trigger from a descendant layout effect on initial mount', async () => {
    const handle = Popover.createHandle();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function OpenOnMount() {
      // React's `useIsoLayoutEffect(fn, [])`.
      createRenderEffect(
        () => undefined,
        () => {
          handle.open('trigger');
        },
      );
      return null;
    }

    render(() => (
      <Popover.Root handle={handle}>
        <Popover.Trigger id="trigger">Trigger</Popover.Trigger>
        <OpenOnMount />
      </Popover.Root>
    ));

    const detachedWarned = consoleWarn.mock.calls.some(
      ([message]) =>
        typeof message === 'string' && message.includes('no root using this handle is mounted'),
    );
    consoleWarn.mockRestore();

    expect(detachedWarned).to.equal(false);
    expect(handle.isOpen).to.equal(true);
    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('hands off hover between detached triggers when the rendered component retains a stale ref', async () => {
    const handle = Popover.createHandle<number>();
    const fallbackStore = handle.store;

    const { user } = render(() => (
      <>
        {[1, 2].map((payload) => (
          <Popover.Trigger
            handle={handle}
            id={`trigger-${payload}`}
            payload={payload}
            openOnHover
            delay={0}
            // Forces the handoff path: without a close delay the popup just closes and reopens,
            // which works even when the trigger is registered on the wrong store.
            closeDelay={100}
            render={(props) => <StaleRefButton {...props} />}
          >
            Trigger {payload}
          </Popover.Trigger>
        ))}
        <Popover.Root handle={handle}>
          {(data: { payload: number | undefined }) => (
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">{data.payload}</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          )}
        </Popover.Root>
      </>
    ));

    expect(fallbackStore.context.triggerElements.size).to.equal(0);
    expect(handle.store.context.triggerElements.size).to.equal(2);

    await user.hover(screen.getByRole('button', { name: 'Trigger 1' }));
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveTextContent('1');
    });

    await user.hover(screen.getByRole('button', { name: 'Trigger 2' }));
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveTextContent('2');
    });
  });

  it('keeps registration on the attached store when a stale-ref component swaps its host node', async () => {
    const handle = Popover.createHandle<number>();
    const fallbackStore = handle.store;

    function App() {
      const [nodeKey, setNodeKey] = createSignal('a');
      return (
        <>
          <button type="button" onClick={() => setNodeKey('b')}>
            Swap node
          </button>
          <Popover.Trigger
            handle={handle}
            id="trigger"
            payload={1}
            render={(props) => <StaleRefButton {...props} nodeKey={nodeKey()} />}
          >
            Trigger
          </Popover.Trigger>
          <Popover.Root handle={handle}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>
      );
    }

    const { user } = render(() => <App />);

    const initialTrigger = screen.getByRole('button', { name: 'Trigger' });
    expect(fallbackStore.context.triggerElements.size).to.equal(0);
    expect(handle.store.context.triggerElements.getById('trigger')).to.equal(initialTrigger);

    // Replacing the host node re-fires the retained ref callback after the migration.
    await user.click(screen.getByRole('button', { name: 'Swap node' }));

    const swappedTrigger = screen.getByRole('button', { name: 'Trigger' });
    // Guards the setup: without a real host swap the rest of the test proves nothing.
    expect(swappedTrigger).not.to.equal(initialTrigger);
    expect(initialTrigger.isConnected).to.equal(false);
    expect(fallbackStore.context.triggerElements.size).to.equal(0);
    expect(handle.store.context.triggerElements.getById('trigger')).to.equal(swappedTrigger);

    // `open()` searches attached stores first, so a registration left on the wrong store would
    // anchor the popup to the removed node.
    await act(async () => {
      handle.open('trigger');
    });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });
    expect(handle.store.state.activeTriggerElement).to.equal(swappedTrigger);
  });

  it('does not detach the consumer ref when the handle attaches to a root', async () => {
    const handle = Popover.createHandle();
    const refCalls: (Element | null)[] = [];

    render(() => (
      <>
        <Popover.Trigger
          handle={handle}
          id="trigger"
          ref={(element: HTMLElement | null) => {
            refCalls.push(element);
          }}
        >
          Trigger
        </Popover.Trigger>
        <Popover.Root handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </>
    ));

    expect(handle.store.context.triggerElements.getById('trigger')).to.equal(
      screen.getByRole('button', { name: 'Trigger' }),
    );
    // Migrating from the fallback store to the root's store must not churn the merged ref, which
    // would hand the consumer a spurious `null` and back.
    expect(refCalls).to.deep.equal([screen.getByRole('button', { name: 'Trigger' })]);
  });

  describe.skipIf(isJSDOM)('handle-backed root ownership', () => {
    type NumberPayload = { payload: number | undefined };

    it('ignores imperative handle calls made before a root is attached', async () => {
      const handle = Popover.createHandle<number>();

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      handle.open('trigger');
      handle.close();
      const detachedWarnings = consoleWarn.mock.calls.filter(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();

      expect(handle.isOpen).to.equal(false);
      expect(detachedWarnings).toHaveLength(2);

      const { user } = render(() => (
        <>
          <Popover.Trigger handle={handle} id="trigger" payload={1}>
            Trigger
          </Popover.Trigger>
          <Popover.Root handle={handle}>
            {(data: NumberPayload) => (
              <>
                <span data-testid="payload">{data.payload ?? 'No payload'}</span>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup>Popover Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </>
            )}
          </Popover.Root>
        </>
      ));

      expect(screen.queryByText('Popover Content')).to.equal(null);
      expect(screen.getByTestId('payload').textContent).to.equal('No payload');

      await user.click(screen.getByRole('button', { name: 'Trigger' }));
      await waitFor(() => {
        expect(screen.getByText('Popover Content')).toBeVisible();
      });
      expect(screen.getByTestId('payload').textContent).to.equal('1');
    });

    it('ignores imperative handle calls made after the root is detached', async () => {
      const handle = Popover.createHandle<number>();

      function App() {
        const [mounted, setMounted] = createSignal(true);

        return (
          <>
            <Popover.Trigger handle={handle} id="trigger" payload={1}>
              Trigger
            </Popover.Trigger>
            <Show when={!mounted()}>
              <button type="button" onClick={() => setMounted(true)}>
                Remount root
              </button>
            </Show>
            <Show when={mounted()}>
              <Popover.Root handle={handle}>
                {(data: NumberPayload) => (
                  <>
                    <span data-testid="payload">{data.payload ?? 'No payload'}</span>
                    <Popover.Portal>
                      <Popover.Positioner>
                        <Popover.Popup>
                          Popover Content
                          <button type="button" onClick={() => setMounted(false)}>
                            Unmount root
                          </button>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </>
                )}
              </Popover.Root>
            </Show>
          </>
        );
      }

      const { user } = render(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Popover Content')).toBeVisible();
      });
      expect(screen.getByTestId('payload').textContent).to.equal('1');

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(handle.isOpen).to.equal(false);
      await waitFor(() => {
        expect(screen.queryByText('Popover Content')).to.equal(null);
      });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      handle.open('trigger');
      handle.close();
      const detachedWarnings = consoleWarn.mock.calls.filter(
        ([message]) =>
          typeof message === 'string' && message.includes('no root using this handle is mounted'),
      );
      consoleWarn.mockRestore();

      expect(handle.isOpen).to.equal(false);
      expect(detachedWarnings).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      expect(screen.queryByText('Popover Content')).to.equal(null);
      expect(screen.getByTestId('payload').textContent).to.equal('No payload');

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Popover Content')).toBeVisible();
      });
      expect(screen.getByTestId('payload').textContent).to.equal('1');
    });

    it('registers a detached trigger declared after the root', async () => {
      const handle = Popover.createHandle();

      const { user } = render(() => (
        <>
          <Popover.Root handle={handle}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>Popover Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Popover.Trigger handle={handle} id="trigger">
            Trigger
          </Popover.Trigger>
        </>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Popover Content')).toBeVisible();
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('throws when called with an unregistered trigger id', async () => {
      const handle = Popover.createHandle();

      render(() => (
        <>
          <Popover.Root handle={handle}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>Popover Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Popover.Trigger handle={handle} id="trigger">
            Trigger
          </Popover.Trigger>
        </>
      ));

      expect(() => handle.open('missing')).to.throw('was called with the trigger id "missing"');
      expect(handle.isOpen).to.equal(false);
    });

    describe('multiple roots sharing one handle', () => {
      // Fake timers so the deferred overlap check only runs when ticked, after the handoff settles.
      const { render: renderFakeTimers, clock } = createRenderer();
      clock.withFakeTimers();

      it('warns when a handle stays attached to more than one mounted root', async () => {
        const handle = Popover.createHandle();
        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        renderFakeTimers(() => (
          <>
            <Popover.Root handle={handle}>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>First</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <Popover.Root handle={handle}>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Second</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </>
        ));

        // Both roots stay mounted, so the deferred check still sees the overlap and warns.
        clock.tick(20);

        const overlapWarned = consoleWarn.mock.calls.some(
          ([message]) =>
            typeof message === 'string' && message.includes('more than one mounted root'),
        );
        expect(overlapWarned).to.equal(true);
        consoleWarn.mockRestore();
      });

      it('resolves a trigger still registered to the previous root during a transient overlap', async () => {
        const handle = Popover.createHandle();
        const openErrors: unknown[] = [];

        function OpenOnMount() {
          // React's `useLayoutEffect(fn, [])`.
          createRenderEffect(
            () => undefined,
            () => {
              try {
                handle.open('trigger');
              } catch (error) {
                openErrors.push(error);
              }
            },
          );
          return null;
        }

        const [phase, setPhase] = createSignal<'outgoing' | 'overlap' | 'incoming'>('outgoing');

        function App() {
          return (
            <>
              <Popover.Trigger handle={handle} id="trigger">
                Trigger
              </Popover.Trigger>
              <Show when={phase() === 'outgoing' || phase() === 'overlap'}>
                <Popover.Root handle={handle}>
                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Popup>Outgoing</Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </Show>
              <Show when={phase() === 'overlap' || phase() === 'incoming'}>
                <Popover.Root handle={handle}>
                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Popup>Incoming</Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
                <OpenOnMount />
              </Show>
            </>
          );
        }

        // The detached trigger settles into the outgoing root's store (it is no longer in the
        // fallback map). The incoming root then attaches while the outgoing one is still mounted,
        // and a layout effect in that same commit opens by trigger id — before the trigger has
        // migrated to the incoming root's store.
        renderFakeTimers(() => <App />);
        await act(async () => setPhase('overlap'));

        expect(openErrors).toHaveLength(0);
        expect(handle.isOpen).to.equal(true);
        expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
          'aria-expanded',
          'true',
        );

        // Completing the handoff (the outgoing root unmounts) keeps the popup open and associated.
        await act(async () => setPhase('incoming'));
        expect(handle.isOpen).to.equal(true);
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the popover with any trigger', async () => {
      const { user } = render(() => (
        <Popover.Root>
          <Popover.Trigger>Trigger 1</Popover.Trigger>
          <Popover.Trigger>Trigger 2</Popover.Trigger>
          <Popover.Trigger>Trigger 3</Popover.Trigger>

          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                Popover Content
                <Popover.Close>Close</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Popover Content')).to.equal(null);

      await user.click(trigger1);
      expect(screen.getByText('Popover Content')).toBeVisible();
      await user.click(screen.getByText('Close'));
      expect(screen.queryByText('Popover Content')).to.equal(null);

      await user.click(trigger2);
      expect(screen.getByText('Popover Content')).toBeVisible();
      await user.click(screen.getByText('Close'));
      expect(screen.queryByText('Popover Content')).to.equal(null);

      await user.click(trigger3);
      expect(screen.getByText('Popover Content')).toBeVisible();
      await user.click(screen.getByText('Close'));
      expect(screen.queryByText('Popover Content')).to.equal(null);
    });

    it('should set the payload and render content based on its value', async () => {
      const { user } = render(() => (
        <Popover.Root>
          {(data: NumberPayload) => (
            <>
              <Popover.Trigger payload={1}>Trigger 1</Popover.Trigger>
              <Popover.Trigger payload={2}>Trigger 2</Popover.Trigger>

              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </>
          )}
        </Popover.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      expect(screen.getByTestId('content').textContent).to.equal('1');

      await user.click(trigger2);
      expect(screen.getByTestId('content').textContent).to.equal('2');
    });

    it('synchronizes ARIA attributes in controlled mode', async () => {
      render(() => (
        <Popover.Root open triggerId="trigger-2">
          <Popover.Trigger id="trigger-1">Trigger 1</Popover.Trigger>
          <Popover.Trigger id="trigger-2">Trigger 2</Popover.Trigger>

          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Popover Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const popup = await screen.findByRole('dialog');

      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger1).not.toHaveAttribute('aria-controls');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(trigger2.getAttribute('aria-controls')).to.equal(popup.getAttribute('id'));
    });

    it('synchronizes ARIA attributes for a controlled open single trigger without triggerId', async () => {
      render(() => (
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>

          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Popover Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const popup = await screen.findByRole('dialog');

      await waitFor(() => {
        expect(trigger.getAttribute('aria-controls')).to.equal(popup.getAttribute('id'));
      });
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const { user } = render(() => (
        <Popover.Root>
          {(data: NumberPayload) => (
            <>
              <Popover.Trigger payload={1}>Trigger 1</Popover.Trigger>
              <Popover.Trigger payload={2}>Trigger 2</Popover.Trigger>

              <Popover.Portal>
                <Popover.Positioner data-testid="positioner">
                  <Popover.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </>
          )}
        </Popover.Root>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await user.click(trigger2);
      expect(screen.getByTestId('popup')).to.equal(popupElement);
      expect(screen.getByTestId('positioner')).to.equal(positionerElement);
    });

    it('should allow controlling the popover state programmatically', async () => {
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [activeTrigger, setActiveTrigger] = createSignal<string | null>(null);

        return (
          <div>
            <Popover.Root
              open={open()}
              triggerId={activeTrigger()}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
            >
              {(data: NumberPayload) => (
                <>
                  <Popover.Trigger payload={1} id="trigger-1">
                    Trigger 1
                  </Popover.Trigger>
                  <Popover.Trigger payload={2} id="trigger-2">
                    Trigger 2
                  </Popover.Trigger>

                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Popup>
                        <span data-testid="content">{data.payload as number}</span>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </>
              )}
            </Popover.Root>
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

    it('returns focus to the active trigger when opening programmatically from body focus', async () => {
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [activeTrigger, setActiveTrigger] = createSignal<string | null>(null);

        return (
          <>
            <Popover.Root
              open={open()}
              triggerId={activeTrigger()}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
            >
              <Popover.Trigger payload={1} id="trigger-1">
                Trigger 1
              </Popover.Trigger>
              <Popover.Trigger payload={2} id="trigger-2">
                Trigger 2
              </Popover.Trigger>

              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>
                    <span data-testid="content">Content</span>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

            <button
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-2');
              }}
            >
              Open Trigger 2 without focus
            </button>
          </>
        );
      }

      const { user } = render(() => <Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(trigger1).toHaveFocus();
      });

      trigger1.blur();
      expect(document.body).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Open Trigger 2 without focus' }));
      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeVisible();
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(trigger2).toHaveFocus();
      });
    });

    it('returns focus to the previous element when the trigger unmounts while open', async () => {
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [showTrigger, setShowTrigger] = createSignal(true);

        return (
          <>
            <button type="button">Focus fallback</button>

            <Popover.Root
              open={open()}
              onOpenChange={(nextOpen) => {
                if (nextOpen) {
                  setShowTrigger(false);
                }
                setOpen(nextOpen);
              }}
            >
              <Show when={showTrigger()}>
                <Popover.Trigger onMouseDown={(event) => event.preventDefault()}>
                  Disappearing trigger
                </Popover.Trigger>
              </Show>

              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>
                    <span data-testid="content">Content</span>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </>
        );
      }

      const { user } = render(() => <Test />);

      const fallback = screen.getByRole('button', { name: 'Focus fallback' });
      await user.click(fallback);
      expect(fallback).toHaveFocus();

      await user.click(screen.getByRole('button', { name: 'Disappearing trigger' }));
      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeVisible();
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).to.equal(null);
      });
      expect(fallback).toHaveFocus();
    });

    it('allows setting an initially open popover', async () => {
      const testPopover = Popover.createHandle<number>();
      render(() => (
        <Popover.Root handle={testPopover} defaultOpen defaultTriggerId="trigger-2">
          {(data: NumberPayload) => (
            <>
              <Popover.Trigger handle={testPopover} payload={1} id="trigger-1">
                Trigger 1
              </Popover.Trigger>
              <Popover.Trigger handle={testPopover} payload={2} id="trigger-2">
                Trigger 2
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </>
          )}
        </Popover.Root>
      ));

      expect(screen.getByTestId('popup').textContent).to.equal('2');
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    function TriggerWithNesting(props: {
      handle: ReturnType<typeof Popover.createHandle>;
      nesting: 0 | 1 | 2 | 3;
    }) {
      const trigger = () => (
        <Popover.Trigger handle={props.handle} id="trigger">
          Trigger
        </Popover.Trigger>
      );

      return (
        <Switch
          fallback={
            <div>
              <div>
                <div>{trigger()}</div>
              </div>
            </div>
          }
        >
          <Match when={props.nesting === 0}>{trigger()}</Match>
          <Match when={props.nesting === 1}>
            <div>{trigger()}</div>
          </Match>
          <Match when={props.nesting === 2}>
            <div>
              <div>{trigger()}</div>
            </div>
          </Match>
        </Switch>
      );
    }

    function DetachedTriggerReparentingTest(props: {
      handle: ReturnType<typeof Popover.createHandle>;
      nesting: 0 | 1 | 2 | 3;
    }) {
      return (
        <>
          <TriggerWithNesting handle={props.handle} nesting={props.nesting} />
          <Popover.Root handle={props.handle}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>
                  Popover Content
                  <Popover.Close>Close</Popover.Close>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>
      );
    }

    async function openAndClosePopover(user: any) {
      await user.click(screen.getByRole('button', { name: 'Trigger' }));
      await waitFor(() => {
        expect(screen.getByText('Popover Content')).toBeVisible();
      });
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByText('Popover Content')).to.equal(null);
      });
    }

    it('should open the popover with any trigger', async () => {
      const testPopover = Popover.createHandle();
      const { user } = render(() => (
        <div>
          <Popover.Trigger handle={testPopover}>Trigger 1</Popover.Trigger>
          <Popover.Trigger handle={testPopover}>Trigger 2</Popover.Trigger>
          <Popover.Trigger handle={testPopover}>Trigger 3</Popover.Trigger>

          <Popover.Root handle={testPopover}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>
                  Popover Content
                  <Popover.Close>Close</Popover.Close>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Popover Content')).to.equal(null);

      await user.click(trigger1);
      expect(screen.getByText('Popover Content')).toBeVisible();
      await user.click(screen.getByText('Close'));
      expect(screen.queryByText('Popover Content')).to.equal(null);

      await user.click(trigger2);
      expect(screen.getByText('Popover Content')).toBeVisible();
      await user.click(screen.getByText('Close'));
      expect(screen.queryByText('Popover Content')).to.equal(null);

      await user.click(trigger3);
      expect(screen.getByText('Popover Content')).toBeVisible();
      await user.click(screen.getByText('Close'));
      expect(screen.queryByText('Popover Content')).to.equal(null);
    });

    it('should set the payload and render content based on its value', async () => {
      const testPopover = Popover.createHandle<number>();
      const { user } = render(() => (
        <div>
          <Popover.Trigger handle={testPopover} payload={1}>
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={testPopover} payload={2}>
            Trigger 2
          </Popover.Trigger>

          <Popover.Root handle={testPopover}>
            {(data: NumberPayload) => (
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>
                    <span data-testid="content">{data.payload}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            )}
          </Popover.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      expect(screen.getByTestId('content').textContent).to.equal('1');

      await user.click(trigger2);
      expect(screen.getByTestId('content').textContent).to.equal('2');
    });

    it('keeps detached triggers clickable when reparented (remove wrappers)', async () => {
      const testPopover = Popover.createHandle();

      const [nesting, setNesting] = createSignal<0 | 1 | 2 | 3>(3);
      const { user } = render(() => (
        <DetachedTriggerReparentingTest handle={testPopover} nesting={nesting()} />
      ));

      await openAndClosePopover(user);

      act(() => setNesting(2));
      await openAndClosePopover(user);

      act(() => setNesting(1));
      await openAndClosePopover(user);

      act(() => setNesting(0));
      await openAndClosePopover(user);
    });

    it('keeps detached triggers clickable when reparented (add wrappers)', async () => {
      const testPopover = Popover.createHandle();
      const [nesting, setNesting] = createSignal<0 | 1 | 2 | 3>(0);
      const { user } = render(() => (
        <DetachedTriggerReparentingTest handle={testPopover} nesting={nesting()} />
      ));

      await openAndClosePopover(user);

      act(() => setNesting(1));
      await openAndClosePopover(user);

      act(() => setNesting(2));
      await openAndClosePopover(user);

      act(() => setNesting(3));
      await openAndClosePopover(user);
    });

    it('keeps detached triggers clickable when reparented during Fast Refresh-like handle recreation', async () => {
      const handleA = Popover.createHandle();
      const [state, setState] = createSignal<{
        handle: ReturnType<typeof Popover.createHandle>;
        nesting: 0 | 1 | 2 | 3;
      }>({ handle: handleA, nesting: 3 });
      const { user } = render(() => (
        <DetachedTriggerReparentingTest handle={state().handle} nesting={state().nesting} />
      ));

      await openAndClosePopover(user);

      act(() => setState({ handle: Popover.createHandle(), nesting: 2 }));
      await openAndClosePopover(user);

      act(() => setState({ handle: Popover.createHandle(), nesting: 1 }));
      await openAndClosePopover(user);

      act(() => setState({ handle: Popover.createHandle(), nesting: 0 }));
      await openAndClosePopover(user);
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const testPopover = Popover.createHandle<number>();
      const { user } = render(() => (
        <>
          <Popover.Trigger handle={testPopover} payload={1}>
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={testPopover} payload={2}>
            Trigger 2
          </Popover.Trigger>

          <Popover.Root handle={testPopover}>
            {(data: NumberPayload) => (
              <Popover.Portal>
                <Popover.Positioner data-testid="positioner">
                  <Popover.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            )}
          </Popover.Root>
        </>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await user.click(trigger2);
      expect(screen.getByTestId('popup')).to.equal(popupElement);
      expect(screen.getByTestId('positioner')).to.equal(positionerElement);
    });

    it('should allow controlling the popover state programmatically', async () => {
      const testPopover = Popover.createHandle<number>();
      function Test() {
        const [open, setOpen] = createSignal(false);
        const [activeTrigger, setActiveTrigger] = createSignal<string | null>(null);

        return (
          <div style={{ margin: '50px' }}>
            <Popover.Trigger handle={testPopover} payload={1} id="trigger-1">
              Trigger 1
            </Popover.Trigger>
            <Popover.Trigger handle={testPopover} payload={2} id="trigger-2">
              Trigger 2
            </Popover.Trigger>

            <Popover.Root
              open={open()}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
              triggerId={activeTrigger()}
              handle={testPopover}
            >
              {(data: NumberPayload) => (
                <Popover.Portal>
                  <Popover.Positioner data-testid="positioner" side="bottom" align="start">
                    <Popover.Popup>
                      <span data-testid="content">{data.payload}</span>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              )}
            </Popover.Root>

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
        expect(screen.getByTestId('positioner').getBoundingClientRect().left).to.be.closeTo(
          trigger1.getBoundingClientRect().left,
          1,
        );
      });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 2' }));
      expect(screen.getByTestId('content').textContent).to.equal('2');
      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect().left).to.be.closeTo(
          trigger2.getBoundingClientRect().left,
          1,
        );
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('content')).to.equal(null);
    });

    it('allows setting an initially open popover', async () => {
      const testPopover = Popover.createHandle<number>();
      render(() => (
        <>
          <Popover.Trigger handle={testPopover} payload={1} id="trigger-1">
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={testPopover} payload={2} id="trigger-2">
            Trigger 2
          </Popover.Trigger>

          <Popover.Root handle={testPopover} defaultOpen defaultTriggerId="trigger-2">
            {(data: NumberPayload) => (
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popup">
                    <span>{data.payload}</span>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            )}
          </Popover.Root>
        </>
      ));

      expect(screen.getByTestId('popup').textContent).to.equal('2');
    });

    it('should not have inline scale style after switching triggers', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testPopover = Popover.createHandle<number>();

      function Test() {
        return (
          <>
            <Popover.Trigger handle={testPopover} payload={1}>
              Trigger 1
            </Popover.Trigger>
            <Popover.Trigger handle={testPopover} payload={2}>
              Trigger 2
            </Popover.Trigger>

            <Popover.Root handle={testPopover}>
              {(data: NumberPayload) => (
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup data-testid="popup">
                      <Popover.Viewport>
                        <span data-testid="content">{data.payload}</span>
                      </Popover.Viewport>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              )}
            </Popover.Root>
          </>
        );
      }

      const { user } = render(() => <Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      // Open with Trigger 1
      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('1');
      });

      // Switch to Trigger 2
      await user.click(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).to.equal('2');
      });

      // The popup should not have an inline scale style that would override CSS transitions
      const popup = screen.getByTestId('popup');
      expect(popup.style.scale).to.equal('');
    });

    it('keeps positioning correct when conditional triggers unmount and the tree remounts', async () => {
      const testPopover = Popover.createHandle();

      function Test() {
        const [key, setKey] = createSignal(1);
        const [showErrorDemo, setShowErrorDemo] = createSignal(true);

        // Solid: a keyed `Show` remounts the subtree when `key` changes, like React's `key`.
        return (
          <Show when={key()} keyed>
            <>
              <button
                onClick={() => {
                  setShowErrorDemo((prev) => !prev);
                  setKey((prev) => prev + 1);
                }}
              >
                Toggle
              </button>
              <div
                style={{
                  'align-items': 'flex-start',
                  display: 'flex',
                  'flex-direction': 'column',
                  gap: '48px',
                  margin: '50px',
                }}
              >
                <Popover.Trigger handle={testPopover} id="trigger-0">
                  Trigger 0
                </Popover.Trigger>
                {showErrorDemo() && (
                  <Popover.Trigger handle={testPopover} id="trigger-1">
                    Trigger 1
                  </Popover.Trigger>
                )}
              </div>

              <Popover.Root handle={testPopover} triggerId="trigger-0" open>
                <Popover.Portal>
                  <Popover.Positioner data-testid="positioner" sideOffset={4} align="start">
                    <Popover.Popup>Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </>
          </Show>
        );
      }

      const { user } = render(() => <Test />);

      const trigger0 = screen.getByRole('button', { name: 'Trigger 0' });
      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect().left).to.be.closeTo(
          trigger0.getBoundingClientRect().left,
          1,
        );
      });

      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      const trigger0After = screen.getByRole('button', { name: 'Trigger 0' });
      await waitFor(() => {
        expect(screen.getByTestId('positioner').getBoundingClientRect().left).to.be.closeTo(
          trigger0After.getBoundingClientRect().left,
          1,
        );
      });
    });
  });

  describe.skipIf(isJSDOM)('imperative actions on the handle', () => {
    it('opens and closes the dialog', async () => {
      const popover = Popover.createHandle();
      render(() => (
        <div>
          <Popover.Trigger handle={popover} id="trigger">
            Trigger
          </Popover.Trigger>
          <Popover.Root handle={popover}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="content">Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.queryByRole('dialog')).to.equal(null);

      popover.open('trigger');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.to.equal(null);
      });

      expect(screen.getByTestId('content').textContent).to.equal('Content');
      expect(trigger).to.have.attribute('aria-expanded', 'true');

      popover.close();
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).to.equal(null);
      });

      expect(trigger).to.have.attribute('aria-expanded', 'false');
    });

    it('sets the payload assosiated with the trigger', async () => {
      const popover = Popover.createHandle<number>();
      render(() => (
        <div>
          <Popover.Trigger handle={popover} id="trigger1" payload={1}>
            Trigger 1
          </Popover.Trigger>
          <Popover.Trigger handle={popover} id="trigger2" payload={2}>
            Trigger 2
          </Popover.Trigger>
          <Popover.Root handle={popover}>
            {(data: { payload: number | undefined }) => (
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="content">{data.payload}</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            )}
          </Popover.Root>
        </div>
      ));

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      expect(screen.queryByRole('dialog')).to.equal(null);

      popover.open('trigger2');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.to.equal(null);
      });

      expect(screen.getByTestId('content').textContent).to.equal('2');
      expect(trigger2).to.have.attribute('aria-expanded', 'true');
      expect(trigger1).not.to.have.attribute('aria-expanded', 'true');

      popover.close();
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).to.equal(null);
      });

      expect(trigger2).to.have.attribute('aria-expanded', 'false');
    });
  });
});
