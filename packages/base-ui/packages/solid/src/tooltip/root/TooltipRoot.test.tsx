import { createRenderer, flushMicrotasks, isJSDOM, popupConformanceTests, act } from '#test-utils';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { spy } from 'sinon';
import { createSignal, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { REASONS } from '../../utils/reasons';
import { OPEN_DELAY } from '../utils/constants';
import { splitProps } from '../../solid-1-compat';

// Solid: local copy of React's `#test-utils` helper.
async function waitForPositioned(positioner: HTMLElement) {
  await waitFor(() => {
    expect(positioner.style.opacity).not.to.equal('0');
  });
  await waitFor(() => {
    expect(positioner).toBeVisible();
  });
}

describe('<Tooltip.Root />', () => {
  beforeEach(async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  afterEach(async () => {
    act(() => document.body.click());
  });

  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        <Tooltip.Trigger {...props.trigger}>Open menu</Tooltip.Trigger>
        <Tooltip.Portal {...props.portal}>
          <Tooltip.Positioner>
            <Tooltip.Popup {...props.popup}>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
    render,
    triggerMouseAction: 'hover',
  });

  describe.for([
    { Component: ContainedTriggerTooltip, name: 'contained triggers' },
    { Component: DetachedTriggerTooltip, name: 'detached triggers' },
    { Component: MultipleDetachedTriggersTooltip, name: 'multiple detached triggers' },
  ])('when using $name', ({ Component: TestTooltip }) => {
    describe('uncontrolled open', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should open when the trigger is hovered', async () => {
        renderFakeTimers(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
      });

      it('should close when the trigger is unhovered', async () => {
        renderFakeTimers(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        fireEvent.mouseLeave(trigger);

        await flushMicrotasks();
        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('should open when the trigger is focused', async ({ skip }) => {
        if (isJSDOM) {
          skip();
        }

        renderFakeTimers(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
      });

      it('should close when the trigger is blurred', async () => {
        renderFakeTimers(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        trigger.blur();

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        trigger.blur();

        clock.tick(OPEN_DELAY);

        expect(screen.queryByText('Content')).to.equal(null);
      });
    });

    describe('controlled open', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = spy();

        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestTooltip
              rootProps={{
                onOpenChange: (nextOpen) => {
                  handleChange(open());
                  setOpen(nextOpen);
                },
                open: open(),
              }}
            />
          );
        }

        renderFakeTimers(() => <App />);

        expect(screen.queryByText('Content')).to.equal(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);

        fireEvent.mouseLeave(trigger);

        expect(screen.queryByText('Content')).to.equal(null);
        expect(handleChange.callCount).to.equal(2);
        expect(handleChange.firstCall.args[0]).to.equal(false);
        expect(handleChange.secondCall.args[0]).to.equal(true);
      });

      it('should not call onChange when the open state does not change', async () => {
        const handleChange = spy();

        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestTooltip
              rootProps={{
                onOpenChange: (nextOpen) => {
                  handleChange(open());
                  setOpen(nextOpen);
                },
                open: open(),
              }}
            />
          );
        }

        renderFakeTimers(() => <App />);

        expect(screen.queryByText('Content')).to.equal(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
        expect(handleChange.callCount).to.equal(1);
        expect(handleChange.firstCall.args[0]).to.equal(false);
      });
    });

    describe('prop: defaultOpen', () => {
      it('should open when the component is rendered', async () => {
        render(() => <TestTooltip rootProps={{ defaultOpen: true }} />);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
      });

      it('should not open when the component is rendered and open is controlled', async () => {
        render(() => <TestTooltip rootProps={{ defaultOpen: true, open: false }} />);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('should not close when the component is rendered and open is controlled', async () => {
        render(() => <TestTooltip rootProps={{ defaultOpen: true, open: true }} />);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
      });

      it('should remain uncontrolled', async () => {
        render(() => <TestTooltip rootProps={{ defaultOpen: true }} />);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
      });
    });

    describe('prop: delay', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should open after rest delay', async () => {
        renderFakeTimers(() => <TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);

        clock.tick(100);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
      });
    });

    describe('prop: closeDelay', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should close after delay', async () => {
        renderFakeTimers(() => <TestTooltip triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);

        fireEvent.mouseLeave(trigger);

        expect(screen.getByText('Content')).not.to.equal(null);

        clock.tick(100);

        expect(screen.queryByText('Content')).to.equal(null);
      });
    });

    describe('preventUnmountOnClose()', () => {
      it('does not prevent unmounting on later closes', async () => {
        let preventNextClose = true;
        const { user } = render(() => (
          <TestTooltip
            rootProps={{
              onOpenChange: (open, details) => {
                if (!open && preventNextClose) {
                  preventNextClose = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
            triggerProps={{
              delay: 0,
              closeDelay: 0,
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.to.equal(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.to.equal(null);
        });

        await user.hover(trigger);

        await waitFor(() => {
          expect(trigger).to.have.attribute('data-popup-open');
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).to.equal(null);
        });
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the tooltip when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            close: spy(),
            unmount: spy(),
          },
        };

        const { user } = render(() => (
          <TestTooltip
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.to.equal(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.to.equal(null);
        });

        act(() => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).to.equal(null);
        });
      });

      it('closes the tooltip when the `close` method is called', async () => {
        const onOpenChange = spy();
        const actionsRef = {
          current: {
            close: spy(),
            unmount: spy(),
          },
        };

        const { user } = render(() => (
          <TestTooltip rootProps={{ actionsRef, onOpenChange }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.to.equal(null);
        });

        act(() => actionsRef.current.close());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).to.equal(null);
        });

        expect(trigger).not.to.have.attribute('data-popup-open');
        expect(onOpenChange.lastCall.args[0]).to.equal(false);
        expect(onOpenChange.lastCall.args[1].reason).to.equal(REASONS.imperativeAction);
      });
    });

    describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
      it('is called on close when there is no exit animation defined', async () => {
        const onOpenChangeComplete = spy();

        function Test() {
          const [open, setOpen] = createSignal(true);
          return (
            <div>
              <button onClick={() => setOpen(false)}>Close</button>
              <Tooltip.Root open={open()} onOpenChangeComplete={onOpenChangeComplete}>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          );
        }

        const { user } = render(() => <Test />);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).to.equal(null);
        });

        expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
        expect(onOpenChangeComplete.lastCall.args[0]).to.equal(false);
      });

      it('is called on close when the exit animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = spy();

        function Test() {
          const style = `
          @keyframes test-anim {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = createSignal(true);

          return (
            <div>
              {/* eslint-disable-next-line solid/no-innerhtml */}
              <style innerHTML={style} />
              <button onClick={() => setOpen(false)}>Close</button>
              <Tooltip.Root open={open()} onOpenChangeComplete={onOpenChangeComplete}>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup class="animation-test-indicator" data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          );
        }

        const { user } = render(() => <Test />);

        expect(screen.getByTestId('popup')).not.to.equal(null);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
        });

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).to.equal(null);
        });

        expect(onOpenChangeComplete.lastCall.args[0]).to.equal(false);
      });

      it('is called on open when there is no enter animation defined', async () => {
        const onOpenChangeComplete = spy();

        function Test() {
          const [open, setOpen] = createSignal(false);
          return (
            <div>
              <button onClick={() => setOpen(true)}>Open</button>
              <Tooltip.Root open={open()} onOpenChangeComplete={onOpenChangeComplete}>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          );
        }

        const { user } = render(() => <Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.to.equal(null);
        });

        expect(onOpenChangeComplete.callCount).to.equal(1);
        expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
      });

      it('is called on open when the enter animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = spy();

        function Test() {
          const style = `
          @keyframes test-anim {
            from {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-starting-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = createSignal(false);

          return (
            <div>
              {/* eslint-disable-next-line solid/no-innerhtml */}
              <style innerHTML={style} />
              <button onClick={() => setOpen(true)}>Open</button>
              <Tooltip.Root
                open={open()}
                onOpenChange={setOpen}
                onOpenChangeComplete={onOpenChangeComplete}
              >
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup class="animation-test-indicator" data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          );
        }

        const { user } = render(() => <Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.firstCall.args[0]).to.equal(true);
        });

        expect(screen.queryByTestId('popup')).not.to.equal(null);
      });

      it('does not get called on mount when not open', async () => {
        const onOpenChangeComplete = spy();

        render(() => (
          <Tooltip.Root onOpenChangeComplete={onOpenChangeComplete}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup" />
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ));

        expect(onOpenChangeComplete.callCount).to.equal(0);
      });
    });

    describe.skipIf(isJSDOM)('animations', () => {
      it('toggles instant animations for adjacent tooltips only while opening', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const style = `
          .tooltip {
            transition: opacity 20ms;
          }
          .tooltip[data-starting-style],
          .tooltip[data-ending-style] {
            opacity: 0;
          }

          .tooltip[data-instant] {
            transition: none;
          }
        `;

        const { user } = render(() => (
          <Tooltip.Provider>
            {/* eslint-disable-next-line solid/no-innerhtml */}
            <style innerHTML={style} />
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="trigger-1" delay={0}>
                First
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup class="tooltip" data-testid="popup-1">
                    First tooltip
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="trigger-2" delay={0}>
                Second
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup class="tooltip" data-testid="popup-2">
                    Second tooltip
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        ));

        const firstTrigger = screen.getByTestId('trigger-1');
        const secondTrigger = screen.getByTestId('trigger-2');

        await user.hover(firstTrigger);

        const firstPopup = await screen.findByTestId('popup-1');
        expect(firstPopup.dataset.instant).to.equal(undefined);

        await user.unhover(firstTrigger);
        await user.hover(secondTrigger);

        const secondPopup = await screen.findByTestId('popup-2');

        await waitFor(() => {
          expect(secondPopup.dataset.instant).to.equal('delay');
          expect(secondPopup.getAnimations().length).to.equal(0);
        });

        await user.unhover(secondTrigger);

        await waitFor(() => {
          expect(secondPopup.dataset.endingStyle).to.equal('');
          expect(secondPopup.dataset.instant).to.equal(undefined);
          expect(secondPopup.getAnimations().length).to.equal(1);
        });
      });

      it('unmounts an exiting tooltip when another tooltip opens', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const style = `
          .tooltip[data-ending-style] {
            transition: opacity 10s;
            opacity: 0;
          }

          .tooltip[data-instant] {
            transition: none;
          }
        `;

        const { user } = render(() => (
          <Tooltip.Provider timeout={30000}>
            <style innerHTML={style} />
            <For each={['First', 'Second']}>
              {(name, index) => (
                <Tooltip.Root>
                  <Tooltip.Trigger data-testid={`trigger-${index() + 1}`} delay={0}>
                    {name}
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup class="tooltip" data-testid={`popup-${index() + 1}`}>
                        {name} tooltip
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )}
            </For>
          </Tooltip.Provider>
        ));

        const firstTrigger = screen.getByTestId('trigger-1');
        const secondTrigger = screen.getByTestId('trigger-2');

        await user.hover(firstTrigger);

        const firstPopup = await screen.findByTestId('popup-1');

        await user.unhover(firstTrigger);

        await waitFor(() => {
          expect(firstPopup.getAnimations().length).to.equal(1);
        });

        await user.hover(secondTrigger);
        await screen.findByTestId('popup-2');

        await waitFor(() => {
          expect(screen.queryByTestId('popup-1')).to.equal(null);
        });
      });

      it('inline opacity: 0 is removed before user CSS transitions run', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        // The inline opacity: 0 applied before positioning must be removed
        // before CSS transitions start, so it does not trigger an unwanted
        // opacity transition.
        const style = `
          .tooltip {
            transition: opacity 200ms;
            opacity: 1;
          }
        `;

        const { user } = render(() => (
          <Tooltip.Root>
            {/* eslint-disable-next-line solid/no-innerhtml */}
            <style innerHTML={style} />
            <Tooltip.Trigger data-testid="trigger" delay={0}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup class="tooltip" data-testid="popup">
                  Tooltip
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ));

        await user.hover(screen.getByTestId('trigger'));

        const popup = await screen.findByTestId('popup');

        // Opacity should be 1 immediately — no unwanted fade from 0 to 1.
        // No opacity transition should be running.
        await waitFor(() => {
          expect(Number(getComputedStyle(popup).opacity)).to.equal(1);
          const opacityAnimations = popup
            .getAnimations()
            .filter((a) => (a as CSSTransition).transitionProperty === 'opacity');
          expect(opacityAnimations.length).to.equal(0);
        });
      });
    });

    describe('prop: disabled', () => {
      it('should not open when disabled', async () => {
        render(() => <TestTooltip rootProps={{ disabled: true }} triggerProps={{ delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);

        trigger.focus();

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('should not open on focus when the trigger is disabled', async () => {
        render(() => <TestTooltip triggerProps={{ delay: 0, disabled: true }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('should close if open when becoming disabled', async () => {
        function App() {
          const [disabled, setDisabled] = createSignal(false);
          return (
            <div>
              <TestTooltip
                rootProps={{ defaultOpen: true, disabled: disabled() }}
                triggerProps={{ delay: 0 }}
              />
              <button
                data-testid="disabled"
                onClick={() => {
                  setDisabled(true);
                }}
              />
            </div>
          );
        }

        render(() => <App />);

        expect(screen.queryByText('Content')).not.to.equal(null);

        const disabledButton = screen.getByTestId('disabled');
        fireEvent.click(disabledButton);

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('does not throw error when combined with defaultOpen', async () => {
        render(() => <TestTooltip rootProps={{ defaultOpen: true, disabled: true }} />);

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('marks the trigger as disabled when the root is disabled', async () => {
        render(() => <TestTooltip rootProps={{ disabled: true }} />);

        expect(screen.getByRole('button', { name: 'Toggle' })).to.have.attribute(
          'data-trigger-disabled',
        );
      });

      it('keeps the tooltip disabled when the root is disabled and the trigger opts back in', async () => {
        render(() => (
          <TestTooltip
            rootProps={{ disabled: true }}
            triggerProps={{ disabled: false, delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        expect(trigger).not.to.have.attribute('data-trigger-disabled');

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
      });
    });

    describe('prop: disableHoverablePopup', () => {
      it('applies pointer-events: none to the positioner when `disableHoverablePopup = true`', async () => {
        render(() => (
          <TestTooltip rootProps={{ disableHoverablePopup: true }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).to.equal('none');
      });

      it('does not apply pointer-events: none to the positioner when `disableHoverablePopup = false`', async () => {
        render(() => (
          <TestTooltip rootProps={{ disableHoverablePopup: false }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).to.equal('');
      });
    });

    describe('prop: trackCursorAxis', () => {
      it('makes the positioner inert when tracking both axes', async () => {
        render(() => (
          <TestTooltip rootProps={{ trackCursorAxis: 'both' }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).to.equal('none');
      });

      it('keeps the positioner hoverable when tracking a single axis', async () => {
        render(() => (
          <TestTooltip rootProps={{ trackCursorAxis: 'x' }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).to.equal('');
      });
    });

    describe.skipIf(isJSDOM)('instant animations', () => {
      it('marks the popup as instant when opened by focus, but not when opened by hover', async () => {
        render(() => <TestTooltip triggerProps={{ delay: 0, closeDelay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        act(() => trigger.focus());
        await flushMicrotasks();

        expect(screen.getByTestId('popup')).to.have.attribute('data-instant', 'focus');

        act(() => trigger.blur());
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).to.equal(null);
        });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.to.equal(null);
        });

        expect(screen.getByTestId('popup')).not.to.have.attribute('data-instant');
      });
    });

    describe('BaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
        render(() => (
          <TestTooltip
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />
        ));

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('allowPropagation() prevents stopPropagation on Escape while still closing', async () => {
        const stopPropagationSpy = spy(Event.prototype as any, 'stopPropagation');

        render(() => (
          <TestTooltip
            rootProps={{
              defaultOpen: true,
              onOpenChange: (nextOpen, eventDetails) => {
                if (!nextOpen && eventDetails.reason === REASONS.escapeKey) {
                  eventDetails.allowPropagation();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />
        ));

        expect(screen.getByText('Content')).not.to.equal(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });

        await waitFor(() => {
          expect(screen.queryByText('Content')).to.equal(null);
        });

        expect(stopPropagationSpy.called).to.equal(false);
        stopPropagationSpy.restore();
      });
    });

    describe('dismissal', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should close when Escape is pressed', async () => {
        const onOpenChange = spy();
        renderFakeTimers(() => (
          <TestTooltip
            rootProps={{ defaultOpen: true, onOpenChange }}
            triggerProps={{ delay: 0 }}
          />
        ));

        expect(screen.getByText('Content')).not.to.equal(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
        expect(onOpenChange.calledWithMatch(false, { reason: REASONS.escapeKey })).to.equal(true);
      });

      it('should not open when the trigger was clicked before delay duration', async () => {
        renderFakeTimers(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY / 2);

        fireEvent.click(trigger);

        clock.tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('should not open when the trigger receives pointerdown before delay duration', async () => {
        renderFakeTimers(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY / 2);

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

        clock.tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('should open when the trigger was clicked before delay duration and closeOnClick is false', async () => {
        renderFakeTimers(() => <TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY / 2);

        fireEvent.click(trigger);

        clock.tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
      });

      it('should close when the trigger is clicked after delay duration', async () => {
        renderFakeTimers(() => <TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);

        fireEvent.click(trigger);

        expect(screen.queryByText('Content')).to.equal(null);
      });

      it('should not close when the trigger is clicked after delay duration and closeOnClick is false', async () => {
        renderFakeTimers(() => <TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);

        fireEvent.click(trigger);

        expect(screen.getByText('Content')).not.to.equal(null);
      });

      it('reopens on hover after the trigger is clicked closed', async () => {
        renderFakeTimers(() => <TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);

        fireEvent.click(trigger);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).to.equal(null);

        // Re-enter with mouse events only. A fresh pointerenter can be missed
        // after the click-driven close, but hover should still work.
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.to.equal(null);
      });
    });
  });

  describe('preventUnmountOnClose()', () => {
    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const tooltip = Tooltip.createHandle();

      function App() {
        const [showRoot, setShowRoot] = createSignal(true);
        const [remountOpen, setRemountOpen] = createSignal(false);
        let preventNextUnmountRef = true;

        return (
          <>
            <Tooltip.Trigger handle={tooltip} id="trigger" delay={0}>
              Toggle
            </Tooltip.Trigger>
            <button type="button" onClick={() => tooltip.open('trigger')}>
              Open tooltip
            </button>
            <button type="button" onClick={() => tooltip.close()}>
              Close tooltip
            </button>
            <button type="button" onClick={() => setShowRoot(false)}>
              Unmount root
            </button>
            <button
              type="button"
              onClick={() => {
                setRemountOpen(true);
                setShowRoot(true);
              }}
            >
              Remount open
            </button>
            <Show when={showRoot()}>
              <Tooltip.Root
                handle={tooltip}
                defaultOpen={remountOpen()}
                defaultTriggerId="trigger"
                onOpenChange={(open, details) => {
                  if (!open && preventNextUnmountRef) {
                    preventNextUnmountRef = false;
                    details.preventUnmountOnClose();
                  }
                }}
              >
                <Tooltip.Portal>
                  <Tooltip.Positioner data-testid="positioner">
                    <Tooltip.Popup>Content</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Show>
          </>
        );
      }

      const { user } = render(() => <App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(screen.getByRole('button', { name: 'Open tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).not.to.equal(null);
      });

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(trigger).not.to.have.attribute('data-popup-open');
      });
      expect(screen.queryByTestId('positioner')).not.to.equal(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(screen.queryByTestId('positioner')).to.equal(null);

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).to.have.attribute('data-popup-open');
      });
      expect(screen.queryByTestId('positioner')).not.to.equal(null);

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).to.equal(null);
      });
    });
  });

  it.skipIf(isJSDOM)(
    'tracks the cursor on the first delayed hover when trackCursorAxis is x',
    async () => {
      render(() => (
        <div style={{ 'padding-top': '100px', 'padding-left': '40px' }}>
          <Tooltip.Root trackCursorAxis="x">
            <Tooltip.Trigger delay={100} style={{ width: '300px', height: '40px' }}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom">
                <Tooltip.Popup style={{ width: '40px', height: '20px' }}>Tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const cursorX = triggerRect.left + 240;
      const cursorY = triggerRect.top + 20;

      fireEvent.pointerDown(trigger, { pointerType: 'mouse', clientX: cursorX, clientY: cursorY });
      fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const positioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = positioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - cursorX)).to.be.lessThanOrEqual(2);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'stops tracking the cursor after trackCursorAxis is disabled while closed',
    async () => {
      function App() {
        const [trackCursorAxis, setTrackCursorAxis] = createSignal<'none' | 'x'>('x');

        return (
          <div style={{ 'padding-top': '100px', 'padding-left': '40px' }}>
            <button onClick={() => setTrackCursorAxis('none')}>Disable tracking</button>
            <Tooltip.Root trackCursorAxis={trackCursorAxis()}>
              <Tooltip.Trigger delay={100} style={{ width: '300px', height: '40px' }}>
                Trigger
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner data-testid="positioner" side="bottom">
                  <Tooltip.Popup style={{ width: '40px', height: '20px' }}>Tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        );
      }

      const { user } = render(() => <App />);

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const cursorX = triggerRect.left + 240;
      const cursorY = triggerRect.top + 20;

      fireEvent.pointerDown(trigger, { pointerType: 'mouse', clientX: cursorX, clientY: cursorY });
      fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const trackedPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = trackedPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - cursorX)).to.be.lessThanOrEqual(2);
      });

      fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).to.equal(null);
      });

      await user.click(screen.getByRole('button', { name: 'Disable tracking' }));

      fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const untrackedPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = untrackedPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        const triggerCenterX = triggerRect.left + triggerRect.width / 2;

        expect(Math.abs(positionerCenterX - triggerCenterX)).to.be.lessThanOrEqual(2);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'updates the tracked cursor position after closing and reopening',
    async () => {
      render(() => (
        <div style={{ 'padding-top': '100px', 'padding-left': '40px' }}>
          <Tooltip.Root trackCursorAxis="x">
            <Tooltip.Trigger delay={100} style={{ width: '300px', height: '40px' }}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom">
                <Tooltip.Popup style={{ width: '40px', height: '20px' }}>Tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      ));

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const firstCursorX = triggerRect.left + 240;
      const secondCursorX = triggerRect.left + 60;
      const cursorY = triggerRect.top + 20;

      fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        clientX: firstCursorX,
        clientY: cursorY,
      });
      fireEvent.mouseEnter(trigger, { clientX: firstCursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: firstCursorX, clientY: cursorY });

      const firstPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = firstPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - firstCursorX)).to.be.lessThanOrEqual(2);
      });

      fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).to.equal(null);
      });

      fireEvent.mouseEnter(trigger, { clientX: secondCursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: secondCursorX, clientY: cursorY });

      const secondPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = secondPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - secondCursorX)).to.be.lessThanOrEqual(2);
      });
    },
  );

  describe.skipIf(isJSDOM)('hoverable popup', () => {
    function HoverableTooltip(props: { disableHoverablePopup?: boolean }) {
      return (
        <div style={{ 'padding-top': '100px', 'padding-left': '100px' }}>
          <Tooltip.Root disableHoverablePopup={props.disableHoverablePopup}>
            <Tooltip.Trigger delay={0} closeDelay={0} style={{ width: '120px', height: '40px' }}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom" sideOffset={0}>
                <Tooltip.Popup data-testid="popup" style={{ width: '120px', height: '40px' }}>
                  Content
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <button type="button">Outside</button>
        </div>
      );
    }

    async function openByHover() {
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      const popup = await screen.findByTestId('popup');
      // Solid: React's `findBy*` runs inside `act`, which settles Floating UI's async positioning
      // before the popup's geometry is read; wait for it.
      await waitForPositioned(screen.getByTestId('positioner'));
      return { trigger, popup };
    }

    function center(element: Element) {
      const rect = element.getBoundingClientRect();
      return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    }

    it('survives the trip from the trigger to the popup, then closes after leaving it', async () => {
      render(() => <HoverableTooltip />);

      const { trigger, popup } = await openByHover();

      fireEvent.mouseLeave(trigger, center(popup));
      fireEvent.mouseEnter(popup);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).not.to.equal(null);

      fireEvent.mouseLeave(popup, {
        relatedTarget: document.body,
        ...center(screen.getByRole('button', { name: 'Outside' })),
      });

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).to.equal(null);
      });
    });

    it('closes on that same trip when `disableHoverablePopup` is set', async () => {
      render(() => <HoverableTooltip disableHoverablePopup />);

      const { trigger, popup } = await openByHover();

      fireEvent.mouseLeave(trigger, center(popup));
      fireEvent.mouseEnter(popup);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).to.equal(null);
    });
  });

  it('keeps the tooltip open when moving across spaced triggers without a closeDelay', async () => {
    const testTooltip = Tooltip.createHandle();
    const { user } = render(() => (
      <Tooltip.Provider timeout={400}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 3
          </Tooltip.Trigger>
        </div>

        <Tooltip.Root handle={testTooltip}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const [trigger1, trigger2, trigger3] = screen.getAllByRole('button');

    await user.hover(trigger1);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    await user.unhover(trigger1);
    await user.hover(trigger2);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    fireEvent.mouseLeave(trigger2, { clientX: 120, clientY: 0, relatedTarget: document.body });
    await user.hover(trigger3);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    fireEvent.mouseMove(document.body, { clientX: 300, clientY: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });
  });
});

describe('nested tooltips', () => {
  const { render, clock } = createRenderer();
  clock.withFakeTimers();

  it('should not open the outer tooltip when hovering over a nested tooltip trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.to.equal(null);
    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should not open the outer tooltip when moving between sibling nested triggers', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-a-trigger">Inner A</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-a-popup">Inner A tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-b-trigger">Inner B</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-b-popup">Inner B tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerATrigger = screen.getByTestId('inner-a-trigger');
    const innerBTrigger = screen.getByTestId('inner-b-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerATrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    fireEvent.mouseEnter(innerATrigger);
    fireEvent.mouseOver(innerATrigger);
    fireEvent.mouseMove(innerATrigger, { clientX: 30, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-a-popup')).not.to.equal(null);
    expect(screen.queryByTestId('inner-b-popup')).to.equal(null);
    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    fireEvent.mouseOut(innerATrigger, { relatedTarget: innerBTrigger });
    fireEvent.pointerEnter(innerBTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerBTrigger);
    fireEvent.mouseOver(innerBTrigger);
    fireEvent.mouseMove(innerBTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-a-popup')).to.equal(null);
    expect(screen.getByTestId('inner-b-popup')).not.to.equal(null);
    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should not open ancestor tooltips when hovering over a third-level nested trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="grandparent-trigger" render="span">
          Grandparent
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="parent-trigger" render="span">
              Parent
              <Tooltip.Root>
                <Tooltip.Trigger data-testid="child-trigger">Child</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="child-popup">Child tooltip</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="parent-popup">Parent tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="grandparent-popup">Grandparent tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const grandparentTrigger = screen.getByTestId('grandparent-trigger');
    const parentTrigger = screen.getByTestId('parent-trigger');
    const childTrigger = screen.getByTestId('child-trigger');

    fireEvent.pointerEnter(grandparentTrigger, {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseEnter(grandparentTrigger);
    fireEvent.pointerEnter(parentTrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    fireEvent.mouseEnter(parentTrigger);
    fireEvent.pointerEnter(childTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(childTrigger);
    fireEvent.mouseOver(childTrigger);
    fireEvent.mouseMove(childTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('child-popup')).not.to.equal(null);
    expect(screen.queryByTestId('parent-popup')).to.equal(null);
    expect(screen.queryByTestId('grandparent-popup')).to.equal(null);
  });

  it('should open the outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
  });

  it('should not open a disabled outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={0} disabled>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should reopen the delayed outer tooltip when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    render(() => (
      <Tooltip.Provider delay={delay}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render="span">
            <span data-testid="outer-area">Outer</span>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
                Inner
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
  });

  // Solid: React passes only because StrictMode double-invokes the popup's hover effect, whose dispose
  // clears the trigger's pending rest timer; verified 2026-10-05 that React's own test fails with
  // `createRenderer({ strict: false })`, so production React behaves as Solid does.
  it.skip('should not re-announce an open outer tooltip when the pending reopen fires', async () => {
    const delay = 100;
    const onOpenChange = spy();

    function App() {
      const [open, setOpen] = createSignal(false);

      return (
        <div>
          <button data-testid="open-outer" onClick={() => setOpen(true)} type="button" />
          <Tooltip.Provider delay={delay}>
            <Tooltip.Root
              open={open()}
              onOpenChange={(nextOpen, eventDetails) => {
                onOpenChange(nextOpen, eventDetails);
                setOpen(nextOpen);
              }}
            >
              <Tooltip.Trigger data-testid="outer-trigger" render="span">
                <span data-testid="outer-area">Outer</span>
                <Tooltip.Root>
                  <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
                    Inner
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      );
    }

    render(() => <App />);

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    // Move back to the parent area so the local reopen is scheduled but not yet due.
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    // The tooltip is opened from the outside before the pending reopen fires.
    fireEvent.click(screen.getByTestId('open-outer'));
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
    expect(onOpenChange.callCount).to.equal(0);
  });

  it('should support nested triggers inside a detached parent trigger', async () => {
    const delay = 100;
    const rowHandle = Tooltip.createHandle<string>();

    render(() => (
      <Tooltip.Provider delay={delay}>
        <Tooltip.Trigger handle={rowHandle} payload="Row" data-testid="outer-trigger" render="div">
          <span data-testid="outer-area">Row</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={0}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>

        <Tooltip.Root handle={rowHandle}>
          {(data) => (
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="outer-popup">{data.payload} tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.to.equal(null);
    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup').textContent).to.equal('Row tooltip');
  });

  it('should not reopen the outer tooltip when rapidly moving back to a nested trigger', async () => {
    const delay = 100;

    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay / 2);

    fireEvent.mouseOut(outerArea, { relatedTarget: innerTrigger });
    fireEvent.mouseOver(innerTrigger);

    clock.tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should not reopen the outer tooltip when hovering the nested tooltip popup', async () => {
    const delay = 100;

    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={0}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    const innerPopup = screen.getByTestId('inner-popup');
    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    fireEvent.mouseOver(innerPopup);

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should cancel the pending parent reopen when the pointer leaves the parent trigger', async () => {
    const delay = 100;

    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay / 2);

    fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should not open the outer tooltip when the pointer moves onto a nested trigger before the delay expires', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY / 2);

    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.pointerMove(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should restart the parent delay when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(delay / 2);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();
    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);

    clock.tick(delay / 2);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
  });

  it('should close the outer tooltip when the pointer moves from outer area onto a nested trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // First open the outer tooltip by hovering the outer area
    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);

    // Now move onto the inner trigger — mouseover bubbles to the outer trigger,
    // which detects the nested trigger and closes itself.
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    // The outer tooltip should close
    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should keep a focus-opened outer tooltip open when hovering over a nested trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger
          data-testid="outer-trigger"
          render={(props) => <span tabindex={0} {...props} />}
        >
          <span>Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await act(async () => {
      outerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
  });

  it('should keep a controlled-open outer tooltip open when hovering over a nested trigger', async () => {
    const onOpenChange = spy();

    render(() => (
      <Tooltip.Root open onOpenChange={onOpenChange}>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          <span>Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
    expect(onOpenChange.callCount).to.equal(0);
  });

  it('should not open the outer tooltip when focusing a nested tooltip trigger', async () => {
    render(() => (
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render="div">
            row label
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">button with tooltip</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">inner popup</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">outer popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');

    await act(async () => {
      innerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.to.equal(null);
    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should close a focus-opened inner tooltip when the inner trigger loses focus', async () => {
    render(() => (
      <Tooltip.Provider delay={0}>
        <Tooltip.Root open={false}>
          <Tooltip.Trigger data-testid="outer-trigger" render="div">
            row label
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">button with tooltip</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">inner popup</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <button data-testid="after">button</button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">outer popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const innerTrigger = screen.getByTestId('inner-trigger');
    const after = screen.getByTestId('after');

    await act(async () => {
      innerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.to.equal(null);

    await act(async () => {
      after.focus();
    });
    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-popup')).to.equal(null);
  });

  it('should allow the parent tooltip to open when a nested trigger is disabled', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" disabled>
              Inner (disabled)
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    // The outer tooltip should open since the nested trigger is disabled
    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
    expect(screen.queryByTestId('inner-popup')).to.equal(null);
  });

  it('should not open the outer tooltip when hovering over a nested trigger inside a shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);

    try {
      render(
        () => (
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="outer-trigger" render="span">
              Outer
              <Tooltip.Root>
                <Tooltip.Trigger data-testid="inner-trigger" render="div">
                  Inner
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ),
        {},
        { container },
      );

      const outerTrigger = shadowRoot.querySelector('[data-testid="outer-trigger"]') as HTMLElement;
      const innerTrigger = shadowRoot.querySelector('[data-testid="inner-trigger"]') as HTMLElement;
      const innerShadowRoot = innerTrigger.attachShadow({ mode: 'open' });
      const innerShadowTarget = document.createElement('span');
      innerShadowTarget.textContent = 'Inner shadow target';
      innerShadowRoot.appendChild(innerShadowTarget);

      // Hover the outer trigger first so the outer tooltip starts its open delay.
      fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
      fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
      fireEvent.mouseEnter(outerTrigger);
      fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

      // Move onto a target inside the inner trigger's shadow root before the delay expires.
      // The composed mouseover bubbles to the outer trigger, and the target
      // traversal walks out of the shadow tree to find the private marker on
      // the inner trigger, suppressing the outer tooltip.
      fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
      fireEvent.mouseEnter(innerTrigger);
      innerShadowTarget.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          composed: true,
          clientX: 50,
          clientY: 10,
        }),
      );
      fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('outer-popup')).to.equal(null);
    } finally {
      await act(async () => {
        host.remove();
      });
    }
  });

  it.each([
    {
      name: 'starts with a ShadowRoot',
      getPath(innerTrigger: HTMLElement, outerTrigger: HTMLElement) {
        const shadowRoot = document.createElement('div').attachShadow({ mode: 'open' });
        return [shadowRoot, innerTrigger, outerTrigger, document.body, document, window];
      },
    },
    {
      name: 'is empty',
      getPath() {
        return [];
      },
    },
  ])('handles a composed path that $name', async ({ getPath }) => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse' });
    fireEvent.mouseEnter(outerTrigger);

    const mouseOverEvent = new MouseEvent('mouseover', { bubbles: true, composed: true });
    Object.defineProperty(mouseOverEvent, 'composedPath', {
      value: () => getPath(innerTrigger, outerTrigger),
    });
    innerTrigger.dispatchEvent(mouseOverEvent);

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should open the outer tooltip when hovering over the non-nested area', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
    expect(screen.queryByTestId('inner-popup')).to.equal(null);
  });

  it('should not reopen the outer tooltip via the local reopen path for touch pointers', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // A touch interaction sets pointerTypeRef to 'touch'.
    fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'touch', clientX: 50, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    // Move from the inner trigger back to the outer area; the local reopen
    // path is gated on `isMouseLikePointerType`, so a touch pointer must not
    // queue or fire a reopen.
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should allow mouse hover after leaving a touch interaction', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span" delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // Start with a touch interaction, then leave the trigger before the next hover.
    fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    // A later mouse-only hover should not be suppressed by the previous touch input.
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
  });

  it('should not open the outer tooltip when moving from the outer popup to a nested trigger', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // Open the outer tooltip via hover.
    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    const outerPopup = screen.getByTestId('outer-popup');
    expect(outerPopup).not.to.equal(null);

    // Hover the outer popup (it's portaled outside the trigger).
    fireEvent.pointerEnter(outerPopup, { pointerType: 'mouse', clientX: 200, clientY: 200 });
    fireEvent.mouseOver(outerPopup);

    await flushMicrotasks();

    // Move back onto the nested trigger. The bubbling mouseover hits the
    // outer trigger and the close-on-nested-hover branch runs.
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should suppress the safePolygon-driven open while a nested trigger is hovered', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render="span">
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    // Repeated mouseMoves keep the safePolygon / mouseover path active, which
    // calls `setOpen(true)` via `useHoverReferenceInteraction`'s onMouseMove
    // handler — that path is now gated by `checkShouldOpen()`.
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseMove(innerTrigger, { clientX: 51, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
  });

  it('should support nested triggers with a Provider delay={0}', async () => {
    render(() => (
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render="span">
            <span data-testid="outer-area">Outer</span>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    ));

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).to.equal(null);
    expect(screen.getByTestId('inner-popup')).not.to.equal(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.to.equal(null);
  });
});

type TestTooltipProps = {
  rootProps?: Tooltip.Root.Props;
  triggerProps?: Tooltip.Trigger.Props;
  portalProps?: Tooltip.Portal.Props;
  positionerProps?: Tooltip.Positioner.Props;
  popupProps?: Tooltip.Popup.Props;
  beforeTrigger?: JSX.Element;
  betweenTriggerAndPortal?: JSX.Element;
  afterPortal?: JSX.Element;
};

function ContainedTriggerTooltip(props: TestTooltipProps) {
  const [triggerLocal, restTriggerProps] = splitProps(props.triggerProps ?? {}, ['children']);
  const [popupLocal, restPopupProps] = splitProps(props.popupProps ?? {}, ['children']);
  const [portalLocal, restPortalProps] = splitProps(props.portalProps ?? {}, ['children']);

  return (
    <Tooltip.Root {...props.rootProps}>
      {props.beforeTrigger}
      <Tooltip.Trigger data-testid="trigger" {...restTriggerProps}>
        {triggerLocal.children ?? 'Toggle'}
      </Tooltip.Trigger>
      {props.betweenTriggerAndPortal}
      <Tooltip.Portal {...restPortalProps}>
        {portalLocal.children}
        <Tooltip.Positioner data-testid="positioner" {...props.positionerProps}>
          <Tooltip.Popup data-testid="popup" {...restPopupProps}>
            {popupLocal.children ?? 'Content'}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
      {props.afterPortal}
    </Tooltip.Root>
  );
}

function DetachedTriggerTooltip(props: TestTooltipProps) {
  const [triggerLocal, restTriggerProps] = splitProps(props.triggerProps ?? {}, ['children']);
  const [popupLocal, restPopupProps] = splitProps(props.popupProps ?? {}, ['children']);
  const [portalLocal, restPortalProps] = splitProps(props.portalProps ?? {}, ['children']);

  const tooltipHandle = Tooltip.createHandle();

  return (
    <>
      {props.beforeTrigger}
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...restTriggerProps}>
        {triggerLocal.children ?? 'Toggle'}
      </Tooltip.Trigger>
      {props.betweenTriggerAndPortal}
      <Tooltip.Root handle={tooltipHandle} {...props.rootProps}>
        <Tooltip.Portal {...restPortalProps}>
          {portalLocal.children}
          <Tooltip.Positioner data-testid="positioner" {...props.positionerProps}>
            <Tooltip.Popup data-testid="popup" {...restPopupProps}>
              {popupLocal.children ?? 'Content'}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
        {props.afterPortal}
      </Tooltip.Root>
    </>
  );
}

function MultipleDetachedTriggersTooltip(props: TestTooltipProps) {
  const [triggerLocal, restTriggerProps] = splitProps(props.triggerProps ?? {}, ['children']);
  const [popupLocal, restPopupProps] = splitProps(props.popupProps ?? {}, ['children']);
  const [portalLocal, restPortalProps] = splitProps(props.portalProps ?? {}, ['children']);

  const tooltipHandle = Tooltip.createHandle();

  return (
    <>
      {props.beforeTrigger}
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...restTriggerProps}>
        {triggerLocal.children ?? 'Toggle'}
      </Tooltip.Trigger>
      <Tooltip.Trigger data-testid="trigger-2" handle={tooltipHandle}>
        Toggle another
      </Tooltip.Trigger>
      {props.betweenTriggerAndPortal}
      <Tooltip.Root handle={tooltipHandle} {...props.rootProps}>
        <Tooltip.Portal {...restPortalProps}>
          {portalLocal.children}
          <Tooltip.Positioner data-testid="positioner" {...props.positionerProps}>
            <Tooltip.Popup data-testid="popup" {...restPopupProps}>
              {popupLocal.children ?? 'Content'}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
        {props.afterPortal}
      </Tooltip.Root>
    </>
  );
}
