import { act, flushMicrotasks } from '#test-utils';
import { isJSDOM } from '#utils/detectBrowser';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { vi } from 'vitest';
import { access } from '../../solid-helpers';
import { REASONS } from '../../utils/reasons';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import {
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFocus,
  useInteractions,
} from '../index';
import type { UseDismissProps } from './useDismiss';
import { normalizeProp } from './useDismiss';
import { splitProps } from '../../solid-1-compat';

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );
});

function App(
  props: UseDismissProps & {
    onClose?: () => void;
  },
) {
  const [open, setOpen] = createSignal(true);
  const { context, refs } = useFloating({
    onOpenChange(openArg, data) {
      act(() => setOpen(openArg));
      const reason = data?.reason;
      const outsidePress =
        typeof props.outsidePress === 'function'
          ? props.outsidePress(event as MouseEvent)
          : props.outsidePress;

      if (outsidePress) {
        expect(reason).toBe(REASONS.outsidePress);
      } else if (access(props.escapeKey)) {
        expect(reason).toBe(REASONS.escapeKey);
        if (!openArg) {
          props.onClose?.();
        }
      } else if (access(props.referencePress)) {
        expect(reason).toBe(REASONS.triggerPress);
      } else if (access(props.ancestorScroll)) {
        expect(reason).toBe(REASONS.none);
      }
    },
    get open() {
      return open();
    },
  });

  const dismiss = useDismiss({ context, props });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  return (
    <>
      <button {...getReferenceProps({ ref: refs.setReference })} />
      <Show when={open()}>
        <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
          <input />
        </div>
      </Show>
    </>
  );
}

describe.skipIf(!isJSDOM)('useDismiss', () => {
  describe('default options', () => {
    test('registers outside press touch listeners as passive', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      try {
        render(() => <App />);

        await Promise.all(
          ['touchstart', 'touchmove', 'touchend'].map((eventName) =>
            waitFor(() => {
              expect(addEventListenerSpy).toHaveBeenCalledWith(eventName, expect.any(Function), {
                capture: true,
                passive: true,
              });
            }),
          ),
        );
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    test('dismisses with escape key', async () => {
      render(() => <App />);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      await flushMicrotasks();
    });

    test('calls preventDefault on escape key dismiss', async () => {
      render(() => <App />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        document.body.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      await flushMicrotasks();
    });

    test('does not call preventDefault on escape key if close is canceled', async () => {
      function CancelApp() {
        const [open, setOpen] = createSignal(true);
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange(_openArg, data) {
            data?.cancel();
            setOpen(true);
          },
        });
        const { getReferenceProps, getFloatingProps } = useInteractions([useDismiss({ context })]);

        return (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            <Show when={open()}>
              <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
            </Show>
          </>
        );
      }

      render(() => <CancelApp />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        document.body.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('does not dismiss with escape key if IME is active', async () => {
      const onClose = vi.fn();

      render(() => <App onClose={onClose} escapeKey={true} />);

      const textbox = screen.getByRole('textbox');

      textbox.focus();

      // Simulate behavior when "あ" (Japanese) is entered and Esc is pressed for IME
      // cancellation.
      fireEvent.input(textbox, { target: { value: 'あ' } });
      fireEvent.compositionStart(textbox);
      fireEvent.keyDown(textbox, { key: 'Escape' });
      fireEvent.compositionEnd(textbox);

      // Wait for the compositionend timeout tick due to Safari
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(onClose).toHaveBeenCalledTimes(0);

      fireEvent.keyDown(textbox, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('dismisses with outside pointer press', async () => {
      render(() => <App />);
      await userEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    // Solid: there is no StrictMode, so both variants run the same way.
    test.each([false, true])(
      'clears the inside marker when the interaction owner unmounts (strict: %s)',
      () => {
        function DismissInteraction(props: {
          context: ReturnType<typeof useFloating>['context'];
          outsidePress: boolean;
        }) {
          const { getFloatingProps } = useInteractions([
            useDismiss({
              context: props.context,
              props: {
                get outsidePress() {
                  return props.outsidePress;
                },
                outsidePressEvent: 'sloppy',
              },
            }),
          ]);

          return <button type="button" {...getFloatingProps()} />;
        }

        const [interactionMounted, setInteractionMounted] = createSignal(true);
        const [outsidePress, setOutsidePress] = createSignal(false);

        function PersistentRootApp() {
          const [open, setOpen] = createSignal(true);
          const { context, refs } = useFloating({
            get open() {
              return open();
            },
            onOpenChange: setOpen,
          });

          return (
            <Show when={open()}>
              <div role="tooltip" ref={refs.setFloating}>
                <Show when={interactionMounted()}>
                  <DismissInteraction context={context} outsidePress={outsidePress()} />
                </Show>
              </div>
            </Show>
          );
        }

        render(() => <PersistentRootApp />);

        fireEvent.click(screen.getByRole('button'));
        act(() => {
          setInteractionMounted(false);
          setOutsidePress(true);
        });
        act(() => setInteractionMounted(true));
        fireEvent.pointerDown(document.body, { pointerType: 'mouse' });

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      },
    );

    test('dismisses with reference press', async () => {
      render(() => <App referencePress={true} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dismisses with native click', async () => {
      render(() => <App referencePress={true} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    // Solid-only: `ancestorScroll` is kept from the pre-1.8 API.
    test('dismisses with ancestor scroll', async () => {
      render(() => <App ancestorScroll={true} />);
      fireEvent.scroll(window);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      await flushMicrotasks();
    });

    test('outsidePress function guard', async () => {
      render(() => <App outsidePress={false} />);
      await userEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('outsidePress ignored for third party elements', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(true);

        const { context, refs } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const dismiss = useDismiss({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

        return (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context}>
                <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <App />);

      const thirdParty = document.createElement('div');
      thirdParty.setAttribute('data-testid', 'third-party');
      document.body.append(thirdParty);
      await userEvent.click(thirdParty);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      thirdParty.remove();
    });

    test('dismisses when clicking outside a shared shadow root', async () => {
      function App(props: { shadowRoot: ShadowRoot }) {
        const [isOpen, setIsOpen] = createSignal(true);

        const { context, refs } = useFloating({
          get open() {
            return isOpen();
          },
          onOpenChange: setIsOpen,
        });

        const dismiss = useDismiss({ context });
        const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

        return (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            <Show when={isOpen()}>
              <FloatingPortal container={props.shadowRoot}>
                <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
              </FloatingPortal>
            </Show>
          </>
        );
      }

      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        render(() => <App shadowRoot={shadowRoot} />, { container });

        await userEvent.click(document.body);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    test('dismisses when clicking outside a shared shadow root while focus is managed', async () => {
      function App(props: { shadowRoot: ShadowRoot }) {
        const [isOpen, setIsOpen] = createSignal(true);

        const { context, refs } = useFloating({
          get open() {
            return isOpen();
          },
          onOpenChange: setIsOpen,
        });

        const dismiss = useDismiss({ context });
        const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

        return (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            <Show when={isOpen()}>
              <FloatingPortal container={props.shadowRoot}>
                <FloatingFocusManager context={context}>
                  <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
                </FloatingFocusManager>
              </FloatingPortal>
            </Show>
          </>
        );
      }

      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        render(() => <App shadowRoot={shadowRoot} />, { container });
        await flushMicrotasks();

        await userEvent.click(document.body);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    test('outsidePress not ignored for nested floating elements', async () => {
      function Popover(props: { children?: JSX.Element; id: string; modal?: boolean | null }) {
        const [isOpen, setIsOpen] = createSignal(true);

        const { context, refs } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const dismiss = useDismiss({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

        const dialogJsx = () => (
          <div
            role="dialog"
            data-testid={props.id}
            {...getFloatingProps({ ref: refs.setFloating })}
          >
            {props.children}
          </div>
        );

        return (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            <Show when={isOpen()}>
              <Show when={props.modal} fallback={dialogJsx()}>
                {(modal) => (
                  <FloatingFocusManager context={context} modal={modal()}>
                    {dialogJsx()}
                  </FloatingFocusManager>
                )}
              </Show>
            </Show>
          </>
        );
      }

      function App(props: { modal: [boolean, boolean] | null }) {
        return (
          <Popover id="popover-1" modal={props.modal ? props.modal[0] : true}>
            <Popover id="popover-2" modal={props.modal ? props.modal[1] : null} />
          </Popover>
        );
      }

      const { unmount } = render(() => <App modal={[true, true]} />);

      let popover1 = screen.getByTestId('popover-1');
      let popover2 = screen.getByTestId('popover-2');
      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();

      unmount();

      const { unmount: unmount2 } = render(() => <App modal={[true, false]} />);

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();

      unmount2();

      const { unmount: unmount3 } = render(() => <App modal={[false, true]} />);

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();

      unmount3();

      render(() => <App modal={null} />);

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();
    });
  });

  describe('options set to false', () => {
    test('does not dismiss with escape key', async () => {
      render(() => <App escapeKey={false} />);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('does not dismiss with outside press', async () => {
      render(() => <App outsidePress={false} />);
      await userEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss with reference pointer down', async () => {
      render(() => <App referencePress={false} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    // Solid-only: `ancestorScroll` is kept from the pre-1.8 API.
    test('does not dismiss with ancestor scroll', async () => {
      render(() => <App ancestorScroll={false} />);
      fireEvent.scroll(window);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('does not dismiss when clicking portaled children', async () => {
      function App() {
        const [open, setOpen] = createSignal(true);
        const { context, refs } = useFloating({
          onOpenChange: setOpen,
          get open() {
            return open();
          },
        });

        const dismiss = useDismiss({ context });
        const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

        return (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            <Show when={open()}>
              <div {...getFloatingProps({ ref: refs.setFloating })}>
                <FloatingPortal>
                  <button data-testid="portaled-button" />
                </FloatingPortal>
              </div>
            </Show>
          </>
        );
      }

      render(() => <App />);

      fireEvent.pointerDown(screen.getByTestId('portaled-button'), {
        bubbles: true,
      });
      await flushMicrotasks();

      expect(screen.getByTestId('portaled-button')).toBeInTheDocument();
    });

    test('outsidePress function guard', async () => {
      render(() => <App outsidePress={true} />);
      await userEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('prop: bubbles', () => {
    function Dialog(props: UseDismissProps & { testId: string; children: JSX.Element }) {
      const [local, others] = splitProps(props, ['testId', 'children']);
      const [open, setOpen] = createSignal(true);
      const nodeId = useFloatingNodeId();

      const { context, refs } = useFloating({
        get nodeId() {
          return nodeId();
        },
        onOpenChange: setOpen,
        get open() {
          return open();
        },
      });

      const dismiss = useDismiss({ context, props: others });
      const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

      return (
        <FloatingNode id={nodeId()}>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          <Show when={open()}>
            <FloatingFocusManager context={context}>
              <div {...getFloatingProps({ ref: refs.setFloating })} data-testid={local.testId}>
                {local.children}
              </div>
            </FloatingFocusManager>
          </Show>
        </FloatingNode>
      );
    }

    function NestedDialog(props: UseDismissProps & { testId: string; children: JSX.Element }) {
      const parentId = useFloatingParentNodeId();

      return (
        <Show when={parentId == null} fallback={<Dialog {...props} />}>
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        </Show>
      );
    }

    describe('normalizeProp', () => {
      test('undefined', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp();

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('when false', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } =
          normalizeProp(false);

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });

      test('{}', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(
          {},
        );

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('{ escapeKey: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          escapeKey: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });
    });

    describe('prop: bubbles.outsidePress', () => {
      test('when true', async () => {
        render(() => (
          <NestedDialog testId="outer">
            <NestedDialog testId="inner">
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ outsidePress: false }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ outsidePress: true }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: bubbles.escapeKey', () => {
      test('without FloatingTree', async () => {
        function App() {
          const [popoverOpen, setPopoverOpen] = createSignal(true);
          const [tooltipOpen, setTooltipOpen] = createSignal(false);

          const popover = useFloating({
            onOpenChange: setPopoverOpen,
            get open() {
              return popoverOpen();
            },
          });
          const tooltip = useFloating({
            onOpenChange: setTooltipOpen,
            get open() {
              return tooltipOpen();
            },
          });

          const popoverInteractions = useInteractions([useDismiss({ context: popover.context })]);
          const tooltipInteractions = useInteractions([
            useFocus({ context: tooltip.context }),
            useDismiss({ context: tooltip.context }),
          ]);

          return (
            <>
              <button
                ref={popover.refs.setReference}
                {...popoverInteractions.getReferenceProps()}
              />
              <Show when={popoverOpen()}>
                <div
                  role="dialog"
                  ref={popover.refs.setFloating}
                  {...popoverInteractions.getFloatingProps()}
                >
                  <button
                    data-testid="focus-button"
                    ref={tooltip.refs.setReference}
                    {...tooltipInteractions.getReferenceProps()}
                  />
                </div>
              </Show>
              <Show when={tooltipOpen()}>
                <div
                  role="tooltip"
                  ref={tooltip.refs.setFloating}
                  {...tooltipInteractions.getFloatingProps()}
                />
              </Show>
            </>
          );
        }

        render(() => <App />);

        screen.getByTestId('focus-button').focus();

        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        await userEvent.keyboard('{Escape}');

        await waitFor(() => {
          expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      test('when true', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={true}>
            <NestedDialog testId="inner" bubbles={true}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ escapeKey: false }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ escapeKey: true }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('prop: capture', () => {
    describe('normalizeProp', () => {
      test('undefined', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp();

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      test('{}', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp(
          {},
        );

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      test('when true', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(true);

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      test('when false', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(false);

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });

      test('{ escapeKey: true }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          escapeKey: true,
        });

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      test('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });
    });

    function Overlay(props: { children: JSX.Element }) {
      return (
        <div
          style={{ height: '100vh', width: '100vw' }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
            }
          }}
        >
          <span>outside</span>
          {props.children}
        </div>
      );
    }

    function Dialog(props: UseDismissProps & { id: string; children: JSX.Element }) {
      const [local, others] = splitProps(props, ['id', 'children']);
      const [open, setOpen] = createSignal(true);
      const nodeId = useFloatingNodeId();

      const { context, refs } = useFloating({
        get nodeId() {
          return nodeId();
        },
        onOpenChange: setOpen,
        get open() {
          return open();
        },
      });

      const dismiss = useDismiss({ context, props: others });
      const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

      return (
        <FloatingNode id={nodeId()}>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          <Show when={open()}>
            <FloatingPortal>
              <FloatingFocusManager context={context}>
                <div {...getFloatingProps({ ref: refs.setFloating })}>
                  <span>{local.id}</span>
                  {local.children}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          </Show>
        </FloatingNode>
      );
    }

    function NestedDialog(props: UseDismissProps & { id: string; children: JSX.Element }) {
      const parentId = useFloatingParentNodeId();

      return (
        <Show when={parentId == null} fallback={<Dialog {...props} />}>
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        </Show>
      );
    }

    describe('prop: capture.outsidePress', () => {
      test('when true', async () => {
        const user = userEvent.setup();

        render(() => (
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>
        ));

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.click(screen.getByText('outer'));

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.click(screen.getByText('outside'));

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: capture.escapeKey', () => {
      test('when false', async () => {
        const user = userEvent.setup();

        render(() => (
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>
        ));

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('outsidePressEvent: intentional', () => {
    test('dragging outside the floating element does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('dragging inside the floating element does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(floatingEl);
      // The browser fires the gesture's click on the common ancestor of the
      // mousedown and mouseup targets; the mouseup inside the floating element
      // marks the tree so this click must not dismiss.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('dragging outside the floating element then clicking outside closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      // A click event will have fired before the proper outside click.
      fireEvent.click(document.body);
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dragging outside the floating element then clicking outside closes with mouse clicks', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.pointerDown(floatingEl, { pointerType: 'mouse' });
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);

      // Real mouse clicks carry `detail: 1`. This one passes the press-observed guard
      // and is consumed by the one-shot drag suppression.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next press-backed mouse click closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('mouse click whose press started before open does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // The trailing click of a press that began before open, e.g. a menu item activated
      // by drag-release opening a dialog.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed while open still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('compatibility events whose pointerdown opened the floating element do not count as a new press', async () => {
      function OpenOnPointerDownApp() {
        const [open, setOpen] = createSignal(false);
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: setOpen,
        });
        const { getFloatingProps } = useInteractions([
          useDismiss({ context, props: { outsidePressEvent: 'intentional' } }),
        ]);

        return (
          <>
            <button onPointerDown={() => setOpen(true)}>Open</button>
            <Show when={open()}>
              <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
            </Show>
          </>
        );
      }

      render(() => <OpenOnPointerDownApp />);

      const openButton = screen.getByRole('button', { name: 'Open' });
      fireEvent.pointerDown(openButton, { pointerType: 'mouse' });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The pointerdown happened before the floating element opened. Its
      // compatibility events arrive after opening but belong to the same press.
      fireEvent.mouseDown(openButton);
      fireEvent.mouseUp(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A new pointer press that begins while open still dismisses.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('keyboard-generated outside click without a prior press closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // Keyboard activations produce `detail: 0` clicks with no press.
      fireEvent.click(document.body, { detail: 0 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press-less outside click reporting a pointer type closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // Android assistive technology reports `pointerType: 'mouse'` with no press behind
      // it, so the click count is what separates the two.
      const click = new MouseEvent('click', { bubbles: true, detail: 0 });
      Object.defineProperty(click, 'pointerType', { value: 'mouse' });
      fireEvent(document.body, click);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press seen in a previous open session does not leak into a reopen', async () => {
      function ReopenApp() {
        const [open, setOpen] = createSignal(true);
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: setOpen,
        });
        const { getReferenceProps, getFloatingProps } = useInteractions([
          useDismiss({ context, props: { outsidePressEvent: 'intentional' } }),
        ]);

        return (
          <>
            <button
              {...getReferenceProps({ ref: refs.setReference, onClick: () => setOpen(true) })}
            />
            <Show when={open()}>
              <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
            </Show>
          </>
        );
      }

      render(() => <ReopenApp />);

      // A genuine outside press closes and leaves a press on record.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The reopened session must not inherit the previous session's press:
      // a press-less trailing click still must not count as an outside press.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press seen before a same-batch close and reopen does not leak into the new session', async () => {
      let context!: ReturnType<typeof useFloating>['context'];

      function BatchReopenApp() {
        const [open, setOpen] = createSignal(true);
        const floating = useFloating({
          get open() {
            return open();
          },
          onOpenChange: setOpen,
        });
        context = floating.context;
        const { getReferenceProps, getFloatingProps } = useInteractions([
          useDismiss({ context: floating.context, props: { outsidePressEvent: 'intentional' } }),
        ]);

        return (
          <>
            <button {...getReferenceProps({ ref: floating.refs.setReference })} />
            <Show when={open()}>
              <div role="tooltip" {...getFloatingProps({ ref: floating.refs.setFloating })} />
            </Show>
          </>
        );
      }

      render(() => <BatchReopenApp />);

      // A press lands while the first session is open.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // The batch never renders `open === false` here, so only `openchange` can observe the
      // session boundary.
      act(() => {
        context.rootStore.setOpen(false, createChangeEventDetails(REASONS.none));
        context.rootStore.setOpen(true, createChangeEventDetails(REASONS.none));
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The gesture's trailing click belongs to the previous session and must
      // not dismiss the reopened floating element.
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press survives a redundant open dispatch while already open', async () => {
      let context!: ReturnType<typeof useFloating>['context'];

      function RedundantOpenApp() {
        const [open, setOpen] = createSignal(true);
        const floating = useFloating({
          get open() {
            return open();
          },
          onOpenChange: setOpen,
        });
        context = floating.context;
        const { getReferenceProps, getFloatingProps } = useInteractions([
          useDismiss({ context: floating.context, props: { outsidePressEvent: 'intentional' } }),
        ]);

        return (
          <>
            <button {...getReferenceProps({ ref: floating.refs.setReference })} />
            <Show when={open()}>
              <div role="tooltip" {...getFloatingProps({ ref: floating.refs.setFloating })} />
            </Show>
          </>
        );
      }

      render(() => <RedundantOpenApp />);

      // A genuine outside press lands while open.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // A redundant open dispatch mid-gesture (hovering an inactive trigger does this)
      // does not end the session, so the press stays on record.
      act(() => {
        context.rootStore.setOpen(true, createChangeEventDetails(REASONS.none));
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press survives listener re-attachment while open', async () => {
      // Solid: props change through a signal instead of `rerender`.
      const [escapeKey, setEscapeKey] = createSignal<boolean | undefined>(undefined);
      render(() => <App outsidePressEvent="intentional" escapeKey={escapeKey()} />);

      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // Changing an effect dependency mid-gesture re-attaches the document listeners;
      // the observed press must survive that.
      act(() => setEscapeKey(false));

      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('pointerdown-only press while open allows the outside click to close', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // Pointer-event browsers may deliver `pointerdown` without a compat
      // `mousedown`; it must count as an observed press on its own.
      fireEvent.pointerDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('non-primary-button press does not count as an outside press', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // A right-button press produces `contextmenu`, not `click`, so it must
      // not vouch for a later press-less click.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 2 });
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A primary-button press still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('cancelled press does not count as an outside press', async () => {
      render(() => <App outsidePressEvent="intentional" />);

      // A press whose gesture is cancelled produces no click, so it must not
      // vouch for a later press-less click.
      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      fireEvent.pointerCancel(document.body);
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A completed press still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click then programmatic outside click closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(insideInput);
      fireEvent.mouseUp(insideInput);
      fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click after drag does not cause immediate close on first outside click', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);

      // Inside clicks should never dismiss, and they should not consume the
      // one-shot outside click suppression from the drag that started inside.
      fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // First true outside click after that drag is still ignored once.
      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next outside click is a deliberate outside press and dismisses.
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('drag ending on outsidePress-ignored target does not consume next outside click', async () => {
      render(() => (
        <App
          outsidePressEvent="intentional"
          outsidePress={(event) => !(event.target as Element)?.closest('[data-testid="ignore"]')}
        />
      ));
      const floatingEl = screen.getByRole('tooltip');
      const ignored = document.createElement('div');
      ignored.setAttribute('data-testid', 'ignore');
      document.body.append(ignored);

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(ignored);

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      ignored.remove();
    });

    function AppWithPreventedPressStart() {
      const [open, setOpen] = createSignal(true);
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: setOpen,
      });
      const { getReferenceProps, getFloatingProps } = useInteractions([
        useDismiss({ context, props: { outsidePressEvent: 'intentional' } }),
      ]);

      return (
        <>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          <Show when={open()}>
            <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
              <div data-testid="scrubber" onPointerDown={(event) => event.preventDefault()} />
            </div>
          </Show>
        </>
      );
    }

    test('press start prevented inside does not require double outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      // Wait a tick: if no immediate synthetic click occurred after pointerup,
      // the next user click should still dismiss.
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(document.body, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press start prevented inside suppresses only immediate outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('pointercancel after prevented press start suppresses immediate outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerCancel(document.body, { pointerType: 'mouse' });

      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('nested floating elements with different portal containers', async () => {
    function ButtonWithFloating(props: {
      children?: JSX.Element;
      portalContainer?: Accessor<HTMLElement | null>;
      triggerText: string;
    }) {
      const [open, setOpen] = createSignal(false);
      const { context, refs, floatingStyles } = useFloating({
        onOpenChange: setOpen,
        get open() {
          return open();
        },
      });

      const click = useClick({ context });
      const dismiss = useDismiss({ context });

      const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

      return (
        <>
          <button {...getReferenceProps({ ref: refs.setReference })}>{props.triggerText}</button>
          <Show when={open()}>
            <FloatingPortal container={props.portalContainer?.()}>
              <FloatingFocusManager context={context} modal={false}>
                <div {...getFloatingProps({ ref: refs.setFloating })} style={floatingStyles()}>
                  {props.children}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          </Show>
        </>
      );
    }

    function App() {
      const [otherContainer, setOtherContainer] = createSignal<HTMLDivElement | null>(null);

      const portal1 = undefined;
      const portal2 = otherContainer;

      return (
        <>
          <ButtonWithFloating portalContainer={portal1} triggerText="open 1">
            <ButtonWithFloating portalContainer={portal2} triggerText="open 2">
              <button>nested</button>
            </ButtonWithFloating>
          </ButtonWithFloating>
          <div ref={setOtherContainer} />
        </>
      );
    }

    render(() => <App />);

    await userEvent.click(screen.getByText('open 1'));
    expect(screen.getByText('open 2')).toBeInTheDocument();

    await userEvent.click(screen.getByText('open 2'));
    await flushMicrotasks();

    expect(screen.getByText('open 1')).toBeInTheDocument();
    expect(screen.getByText('open 2')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
  });
});
