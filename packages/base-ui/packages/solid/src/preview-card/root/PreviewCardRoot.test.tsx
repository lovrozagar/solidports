import {
  act,
  advanceClock,
  createRenderer,
  flushMicrotasks,
  isJSDOM,
  popupConformanceTests,
} from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { expect as vitestExpect, vi, describe, beforeEach, it } from 'vitest';
import { REASONS } from '../../utils/reasons';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';
import { splitProps } from '../../solid-1-compat';

describe('<PreviewCard.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <PreviewCard.Root {...props.root}>
        <PreviewCard.Trigger href="#" {...props.trigger}>
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Portal {...props.portal}>
          <PreviewCard.Positioner>
            <PreviewCard.Popup {...props.popup}>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
    render: (...args) => render(...(args as Parameters<typeof render>)),
    triggerMouseAction: 'hover',
  });

  describe.for([
    { Component: ContainedTriggerPreviewCard, name: 'contained triggers' },
    { Component: DetachedTriggerPreviewCard, name: 'detached triggers' },
    { Component: MultipleDetachedTriggersPreviewCard, name: 'multiple detached triggers' },
  ])('when using $name', ({ Component: TestPreviewCard }) => {
    describe('uncontrolled open', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should open when the trigger is hovered', async () => {
        renderFakeTimers(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is unhovered', async () => {
        renderFakeTimers(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        fireEvent.mouseLeave(trigger);

        clock.tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger is focused', async () => {
        if (!isJSDOM) {
          // Ignore due to `:focus-visible` being required in the browser.
          return;
        }

        renderFakeTimers(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        trigger.focus();

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is blurred', async () => {
        renderFakeTimers(() => <TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        trigger.focus();
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        trigger.blur();
        clock.tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: onOpenChange', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestPreviewCard
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

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);

        clock.tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });
      it('does not close after hovering out of a popup opened externally', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <>
              <button type="button" onClick={() => setOpen(true)}>
                Show
              </button>
              <TestPreviewCard rootProps={{ open: open(), onOpenChange: setOpen }} />
            </>
          );
        }

        renderFakeTimers(() => <App />);

        fireEvent.click(screen.getByRole('button', { name: 'Show' }));

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        await flushMicrotasks();

        clock.tick(CLOSE_DELAY);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);

          return <TestPreviewCard rootProps={{ open: open(), onOpenChange: setOpen }} />;
        }

        renderFakeTimers(() => <App />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        await flushMicrotasks();

        clock.tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not call onOpenChange again when the trigger is re-hovered while open', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = createSignal(false);

          return (
            <TestPreviewCard
              rootProps={{
                open: open(),
                onOpenChange: (nextOpen) => {
                  handleChange(open());
                  setOpen(nextOpen);
                },
              }}
            />
          );
        }

        await renderFakeTimers(() => <App />);

        expect(screen.queryByText('Content')).toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await advanceClock(clock, OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);

        // Leave and re-enter before the close delay runs out: the card stays open.
        fireEvent.mouseLeave(trigger);
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await advanceClock(clock, OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenNthCalledWith(1, false);
      });
    });

    describe('prop: defaultOpen', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        renderFakeTimers(() => (
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
            }}
          />
        ));

        expect(screen.getByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        await flushMicrotasks();

        clock.tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('closes when the trigger is unhovered after opening by default', async () => {
        await renderFakeTimers(() => (
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
            }}
          />
        ));

        expect(screen.getByText('Content')).not.toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        await advanceClock(clock, CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: delay', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should open after delay with rest type by default', async () => {
        renderFakeTimers(() => <TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        clock.tick(100);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: closeDelay', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should close after delay', async () => {
        renderFakeTimers(() => <TestPreviewCard triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);

        expect(screen.getByText('Content')).not.toBe(null);

        clock.tick(100);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('dismissal', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('reopens on hover after Escape closes it', async () => {
        renderFakeTimers(() => <TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        // Re-enter with mouse events only. A fresh pointerenter can be missed
        // after the click-driven close, but hover should still work.
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe.skipIf(!isJSDOM)('prop: actionsRef', () => {
      it('unmounts the preview card when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            close: vi.fn(),
            unmount: vi.fn(),
          },
        };

        const { user } = render(() => (
          <TestPreviewCard
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
            triggerProps={{
              closeDelay: 0,
              delay: 0,
            }}
          />
        ));

        const trigger = screen.getByRole('link', { name: 'Link' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await act(async () => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });

      it('closes the preview card when the `close` method is called', async () => {
        const onOpenChange = vi.fn();
        const actionsRef: { current: PreviewCard.Root.Actions | null } = { current: null };

        const { user } = render(() => (
          <TestPreviewCard rootProps={{ actionsRef, onOpenChange }} triggerProps={{ delay: 0 }} />
        ));

        const trigger = screen.getByRole('link', { name: 'Link' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
        });

        await act(async () => actionsRef.current?.close());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });

        vitestExpect(trigger).not.toHaveAttribute('data-popup-open');
        vitestExpect(onOpenChange).toHaveBeenLastCalledWith(
          false,
          vitestExpect.objectContaining({ reason: REASONS.imperativeAction }),
        );
      });
    });
  });

  describe('nested preview card interactions', () => {
    it('keeps the parent preview card open when clicking nested trigger', async () => {
      function Test() {
        return (
          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        );
      }

      render(() => <Test />);

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByRole('link', { name: 'Child' });

      fireEvent.click(childTrigger);

      await flushMicrotasks();

      // Parent popup should still be open after clicking the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when press starts in nested popup and ends outside', async () => {
      function Test() {
        return (
          <div>
            <button type="button" data-testid="outside">
              Outside
            </button>

            <PreviewCard.Root defaultOpen>
              <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="parent-popup">
                    <PreviewCard.Root defaultOpen>
                      <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                      <PreviewCard.Portal>
                        <PreviewCard.Positioner>
                          <PreviewCard.Popup data-testid="child-popup">
                            Child content
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </PreviewCard.Root>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
        );
      }

      render(() => <Test />);

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      expect(screen.queryByTestId('child-popup')).not.toBe(null);

      const childPopup = screen.getByTestId('child-popup');
      const outside = screen.getByTestId('outside');

      fireEvent.pointerDown(childPopup, { pointerType: 'mouse', button: 0 });
      fireEvent.click(outside);

      await waitFor(() => {
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      });
      expect(screen.queryByTestId('child-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when hovering nested trigger', async () => {
      function Test() {
        return (
          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner data-testid="parent-positioner">
                <PreviewCard.Popup data-testid="parent-popup">
                  <div>Parent content</div>
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#" data-testid="child-trigger">
                      Child
                    </PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        );
      }

      render(() => <Test />);

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByTestId('child-trigger');

      // Simulate hovering from parent content to child trigger
      fireEvent.pointerDown(childTrigger, { pointerType: 'mouse' });
      fireEvent.mouseEnter(childTrigger);
      fireEvent.mouseMove(childTrigger);

      await flushMicrotasks();

      // Parent popup should still be open after hovering the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    describe('race condition between close timers and hover-open logic', () => {
      const { render, clock } = createRenderer();

      clock.withFakeTimers();

      it('keeps the parent open and re-opens the child when re-entering after partial close', async () => {
        function Test() {
          return (
            <PreviewCard.Root defaultOpen>
              <PreviewCard.Trigger href="#" data-testid="parent-trigger">
                Parent
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="parent-popup">
                    <div>Parent content</div>
                    <PreviewCard.Root>
                      <PreviewCard.Trigger href="#" data-testid="child-trigger">
                        Child
                      </PreviewCard.Trigger>
                      <PreviewCard.Portal>
                        <PreviewCard.Positioner>
                          <PreviewCard.Popup data-testid="child-popup">
                            Child content
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </PreviewCard.Root>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          );
        }

        render(() => <Test />);

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        fireEvent.mouseEnter(childTrigger);
        fireEvent.mouseMove(childTrigger);

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        let childPopup = screen.getByTestId('child-popup').parentElement!;

        // Step 3: Move mouse outside all previews
        fireEvent.mouseLeave(childPopup);
        fireEvent.mouseLeave(parentPopup);
        fireEvent.mouseMove(document.body);

        // Advance partway through close delay but not all the way
        clock.tick(CLOSE_DELAY / 2);
        await flushMicrotasks();

        // Step 4: Re-enter parent popup before it closes
        fireEvent.mouseEnter(parentPopup);

        // Let the child's close delay finish — child closes
        clock.tick(CLOSE_DELAY);
        await flushMicrotasks();

        // Parent should still be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        // Step 5: Hover child trigger again to re-open child
        fireEvent.mouseEnter(childTrigger);
        fireEvent.mouseMove(childTrigger);

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        // Parent and child should be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        childPopup = screen.getByTestId('child-popup').parentElement!;

        fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        fireEvent.mouseEnter(childPopup);

        clock.tick(CLOSE_DELAY);

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).not.toBe(null);
      });
    });

    describe('synchronized closing', () => {
      const { render, clock } = createRenderer();

      clock.withFakeTimers();

      it('parent popup closes as soon as the child popup closes', async () => {
        function Test() {
          return (
            <PreviewCard.Root>
              <PreviewCard.Trigger href="#" data-testid="parent-trigger">
                Parent
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="parent-popup">
                    <div>Parent content</div>
                    <PreviewCard.Root>
                      <PreviewCard.Trigger href="#" data-testid="child-trigger">
                        Child
                      </PreviewCard.Trigger>
                      <PreviewCard.Portal>
                        <PreviewCard.Positioner>
                          <PreviewCard.Popup data-testid="child-popup">
                            Child content
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </PreviewCard.Root>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          );
        }

        render(() => <Test />);

        const parentTrigger = screen.getByTestId('parent-trigger');
        fireEvent.mouseEnter(parentTrigger);
        clock.tick(OPEN_DELAY);

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        fireEvent.mouseLeave(parentTrigger, { relatedTarget: parentPopup });
        fireEvent.mouseEnter(parentPopup);
        fireEvent.mouseEnter(childTrigger);
        clock.tick(OPEN_DELAY);

        const childPopup = screen.getByTestId('child-popup').parentElement!;

        fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        fireEvent.mouseEnter(childPopup);
        fireEvent.mouseLeave(childPopup);
        fireEvent.mouseMove(document.body);

        clock.tick(CLOSE_DELAY + 10);
        await flushMicrotasks();

        expect(screen.queryByTestId('child-popup')).toBe(null);
        expect(screen.queryByTestId('parent-popup')).toBe(null);
      });
    });
  });
});

type TestPreviewCardProps = {
  rootProps?: PreviewCard.Root.Props;
  triggerProps?: PreviewCard.Trigger.Props;
  portalProps?: PreviewCard.Portal.Props;
  positionerProps?: PreviewCard.Positioner.Props;
  popupProps?: PreviewCard.Popup.Props;
};

function ContainedTriggerPreviewCard(props: TestPreviewCardProps) {
  const [localTriggerProps, restTriggerProps] = splitProps(props.triggerProps ?? {}, ['children']);
  const [localPopupProps, restPopupProps] = splitProps(props.popupProps ?? {}, ['children']);
  const [localPortalProps, restPortalProps] = splitProps(props.portalProps ?? {}, ['children']);

  const triggerContent = () => localTriggerProps.children ?? 'Link';
  const popupContent = () => localPopupProps.children ?? 'Content';

  return (
    <PreviewCard.Root {...props.rootProps}>
      <PreviewCard.Trigger href="#" data-testid="trigger" {...restTriggerProps}>
        {triggerContent()}
      </PreviewCard.Trigger>
      <PreviewCard.Portal {...restPortalProps}>
        {localPortalProps.children}
        <PreviewCard.Positioner data-testid="positioner" {...props.positionerProps}>
          <PreviewCard.Popup data-testid="popup" {...restPopupProps}>
            {popupContent()}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function DetachedTriggerPreviewCard(props: TestPreviewCardProps) {
  const [localTriggerProps, restTriggerProps] = splitProps(props.triggerProps ?? {}, ['children']);
  const [localPopupProps, restPopupProps] = splitProps(props.popupProps ?? {}, ['children']);
  const [localPortalProps, restPortalProps] = splitProps(props.portalProps ?? {}, ['children']);

  const triggerContent = () => localTriggerProps.children ?? 'Link';
  const popupContent = () => localPopupProps.children ?? 'Content';

  const previewCardHandle = PreviewCard.createHandle();

  return (
    <>
      <PreviewCard.Trigger
        href="#"
        data-testid="trigger"
        {...restTriggerProps}
        handle={previewCardHandle}
      >
        {triggerContent()}
      </PreviewCard.Trigger>
      <PreviewCard.Root {...props.rootProps} handle={previewCardHandle}>
        <PreviewCard.Portal {...restPortalProps}>
          {localPortalProps.children}
          <PreviewCard.Positioner data-testid="positioner" {...props.positionerProps}>
            <PreviewCard.Popup data-testid="popup" {...restPopupProps}>
              {popupContent()}
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    </>
  );
}

function MultipleDetachedTriggersPreviewCard(props: TestPreviewCardProps) {
  const [localTriggerProps, restTriggerProps] = splitProps(props.triggerProps ?? {}, ['children']);
  const [localPopupProps, restPopupProps] = splitProps(props.popupProps ?? {}, ['children']);
  const [localPortalProps, restPortalProps] = splitProps(props.portalProps ?? {}, ['children']);

  const triggerContent = () => localTriggerProps.children ?? 'Link';
  const popupContent = () => localPopupProps.children ?? 'Content';

  const previewCardHandle = PreviewCard.createHandle();

  return (
    <>
      <PreviewCard.Trigger
        href="#"
        data-testid="trigger"
        {...restTriggerProps}
        handle={previewCardHandle}
      >
        {triggerContent()}
      </PreviewCard.Trigger>
      <PreviewCard.Trigger href="#" data-testid="trigger-2" handle={previewCardHandle}>
        Another link
      </PreviewCard.Trigger>

      <PreviewCard.Root {...props.rootProps} handle={previewCardHandle}>
        <PreviewCard.Portal {...restPortalProps}>
          {localPortalProps.children}
          <PreviewCard.Positioner data-testid="positioner" {...props.positionerProps}>
            <PreviewCard.Popup data-testid="popup" {...restPopupProps}>
              {popupContent()}
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    </>
  );
}
