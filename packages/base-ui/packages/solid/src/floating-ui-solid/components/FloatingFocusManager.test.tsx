/* eslint-disable jsx-a11y/role-has-required-aria-props */
/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-shadow */
import { act, flushMicrotasks } from '#test-utils';
import { isJSDOM } from '#utils/detectBrowser';
import { fireEvent, render, screen, waitFor, within } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createMemo, createRenderEffect, createSignal, onSettled, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { delegateEvents, Dynamic, render as solidRender } from '@solidjs/web';
import { test } from 'vitest';
import { Main as Navigation } from '../../../test/floating-ui-tests/Navigation';
import { autofocus, defaultProps } from '../../solid-helpers';
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
  useHover,
  useInteractions,
  useRole,
} from '../index';
import type { FloatingFocusManagerProps } from './FloatingFocusManager';
import type { InteractionType } from '../../utils/useEnhancedClickHandler';

// do not treeshake autofocus
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
autofocus;

// TODO (@Janpot) It looks like the toHaveFocus assertion from @mui/internal-test-utils
// is not working correctly with iframes and nested documents. Helper as a workaround
// until fixed.
function isFocused(element: Element): boolean {
  let doc = element.ownerDocument;
  let current: Element = element;

  while (doc) {
    if (doc.activeElement !== current) {
      return false;
    }

    // Move up to the parent document
    const frame = doc.defaultView?.frameElement; // the <iframe> hosting this doc
    if (!frame) {
      return true;
    }

    current = frame;
    doc = frame.ownerDocument;
  }

  return true;
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );

  Object.defineProperty(HTMLElement.prototype, 'inert', {
    configurable: true,
    enumerable: false,
    value: true,
    writable: true,
  });
});

function App(
  props: Partial<
    Omit<FloatingFocusManagerProps, 'initialFocus'> & {
      initialFocus?: 'two' | boolean;
    }
  >,
) {
  let ref: HTMLButtonElement | undefined;
  const [open, setOpen] = createSignal(false);
  const { refs, context } = useFloating({
    onOpenChange: setOpen,
    get open() {
      return open();
    },
  });

  const resolvedInitialFocus = createMemo(() => {
    return props.initialFocus === 'two' ? () => ref : props.initialFocus;
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen((v) => !v)} />
      <Show when={open()}>
        <FloatingFocusManager {...props} initialFocus={resolvedInitialFocus()} context={context}>
          <div role="dialog" ref={refs.setFloating} data-testid="floating">
            <button data-testid="one">close</button>
            <button data-testid="two" ref={ref}>
              confirm
            </button>
            <button data-testid="three" onClick={() => setOpen(false)}>
              x
            </button>
            {props.children}
          </div>
        </FloatingFocusManager>
      </Show>
      <div tabindex={0} data-testid="last">
        outside
      </div>
    </>
  );
}

function RadioApp() {
  const [open, setOpen] = createSignal(false);
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen((v) => !v)} />
      <Show when={open()}>
        <FloatingFocusManager context={context}>
          <div role="dialog" ref={refs.setFloating}>
            <input type="radio" name="group" data-testid="radio-one" />
            <input type="radio" name="group" checked data-testid="radio-two" />
            <button data-testid="after-radio">after</button>
          </div>
        </FloatingFocusManager>
      </Show>
    </>
  );
}

interface DialogProps {
  open?: boolean;
  render: Component<{ close: () => void }>;
  children: Component<any>;
}

function Dialog(props: DialogProps) {
  // eslint-disable-next-line solid/reactivity
  const [open, setOpen] = createSignal(props.open ?? false);
  const nodeId = useFloatingNodeId();

  const { refs, context } = useFloating({
    get nodeId() {
      return nodeId();
    },
    onOpenChange: setOpen,
    get open() {
      return open();
    },
  });

  const click = useClick({ context });
  const dismiss = useDismiss({ context, props: { bubbles: false } });

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  return (
    <FloatingNode id={nodeId()}>
      <Dynamic component={props.children} {...getReferenceProps({ ref: refs.setReference })} />

      <FloatingPortal>
        <Show when={open()}>
          <FloatingFocusManager context={context}>
            <div {...getFloatingProps({ ref: refs.setFloating })}>
              <Dynamic component={props.render} close={() => setOpen(false)} />
            </div>
          </FloatingFocusManager>
        </Show>
      </FloatingPortal>
    </FloatingNode>
  );
}

describe('FloatingFocusManager', () => {
  describe.skipIf(!isJSDOM)('JSDOM-only coverage', () => {
    describe('prop: initialFocus', () => {
      test('default behavior focuses first tabbable element', async () => {
        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('one')).toHaveFocus();
        });
      });

      test('default behavior focuses the checked radio in a named group', async () => {
        render(() => <RadioApp />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('radio-two')).toHaveFocus();
      });

      test('ref', async () => {
        render(() => <App initialFocus="two" />);
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('two')).toHaveFocus();
        });
      });

      // Solid: the renderer does not focus `autofocus` elements on mount as React DOM does, so the
      // `autofocus` directive provides that behavior.
      test('respects autoFocus', async () => {
        render(() => (
          <App>
            <input autofocus ref={autofocus} data-testid="input" />
          </App>
        ));
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('input')).toHaveFocus();
      });
    });

    describe('prop: returnFocus', () => {
      test('when true', async () => {
        const [returnFocus, setReturnFocus] = createSignal<boolean>();
        render(() => <App returnFocus={returnFocus()} />);

        screen.getByTestId('reference').focus();
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('one')).toHaveFocus();
        });

        screen.getByTestId('two').focus();

        act(() => setReturnFocus(false));

        expect(screen.getByTestId('two')).toHaveFocus();

        fireEvent.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('when false', async () => {
        render(() => <App returnFocus={false} />);

        screen.getByTestId('reference').focus();
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('one')).toHaveFocus();
        });

        fireEvent.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('ref', async () => {
        function Test() {
          let ref: HTMLInputElement | undefined;
          return (
            <div>
              <input />
              <input data-testid="focus-target" ref={ref} />
              <input />
              <App returnFocus={ref} />
            </div>
          );
        }

        render(() => <Test />);

        screen.getByTestId('reference').focus();
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('three'));
        await flushMicrotasks();
        expect(screen.getByTestId('focus-target')).toHaveFocus();
      });

      test('always returns to the reference for nested elements', async () => {
        const NestedDialog = (props: DialogProps) => {
          const parentId = useFloatingParentNodeId();
          return (
            <Show when={parentId == null} fallback={<Dialog {...props} />}>
              <FloatingTree>
                <Dialog {...props} />
              </FloatingTree>
            </Show>
          );
        };

        render(() => (
          <NestedDialog
            render={(props) => (
              <>
                <NestedDialog
                  render={(p) => <button onClick={p.close} data-testid="close-nested-dialog" />}
                >
                  {(p) => <button data-testid="open-nested-dialog" {...p} />}
                </NestedDialog>
                <button onClick={props.close} data-testid="close-dialog" />
              </>
            )}
          >
            {(props) => <button data-testid="open-dialog" {...props} />}
          </NestedDialog>
        ));

        await userEvent.click(screen.getByTestId('open-dialog'));
        await userEvent.click(screen.getByTestId('open-nested-dialog'));

        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('close-nested-dialog')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();
      });

      test('return to the first focusable descendent of the reference, if the reference is not focusable', async () => {
        render(() => (
          <Dialog render={(p) => <button onClick={p.close} data-testid="close-dialog" />}>
            {(p) => (
              <div data-testid="non-focusable-reference" {...p}>
                <button data-testid="open-dialog" />
              </div>
            )}
          </Dialog>
        ));
        screen.getByTestId('open-dialog').focus();
        await userEvent.keyboard('{Enter}');

        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();

        // TODO (explanatory): test was failing with {Esc}
        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('open-dialog')).toHaveFocus();
      });

      test('preserves tabbable context next to reference element if removed (modal)', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [removed, setRemoved] = createSignal(false);

          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          const click = useClick({ context });

          const { getReferenceProps, getFloatingProps } = useInteractions([click]);

          return (
            <>
              <Show when={!removed()}>
                <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
              </Show>
              <Show when={isOpen()}>
                <FloatingPortal>
                  <FloatingFocusManager context={context}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button
                        data-testid="remove"
                        onClick={() => {
                          setRemoved(true);
                          setIsOpen(false);
                        }}
                      >
                        remove
                      </button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              </Show>
              <button data-testid="fallback" />
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('remove'));
        await flushMicrotasks();

        await userEvent.tab();

        expect(screen.getByTestId('fallback')).toHaveFocus();
      });

      test('preserves tabbable context next to reference element if removed (non-modal)', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [removed, setRemoved] = createSignal(false);

          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          const click = useClick({ context });

          const { getReferenceProps, getFloatingProps } = useInteractions([click]);

          return (
            <>
              <Show when={!removed()}>
                <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
              </Show>
              <Show when={isOpen()}>
                <FloatingPortal>
                  <FloatingFocusManager context={context} modal={false}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button
                        data-testid="remove"
                        onClick={() => {
                          setRemoved(true);
                          setIsOpen(false);
                        }}
                      >
                        remove
                      </button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              </Show>
              <button data-testid="fallback" />
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('remove'));
        await flushMicrotasks();

        await userEvent.tab();
        expect(screen.getByTestId('fallback')).toHaveFocus();
      });

      test.skipIf(!isJSDOM)(
        'does not return focus to reference on outside press when preventScroll is not supported',
        async () => {
          function App() {
            const [isOpen, setIsOpen] = createSignal(false);

            const { refs, context } = useFloating({
              onOpenChange: setIsOpen,
              get open() {
                return isOpen();
              },
            });

            const click = useClick({ context });
            const dismiss = useDismiss({ context });

            const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

            return (
              <>
                <button ref={refs.setReference} {...getReferenceProps()}>
                  reference
                </button>
                <Show when={isOpen()}>
                  <FloatingFocusManager context={context}>
                    <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
                  </FloatingFocusManager>
                </Show>
              </>
            );
          }

          render(() => <App />);

          await userEvent.click(screen.getByText('reference'));
          await flushMicrotasks();

          expect(screen.getByTestId('floating')).toHaveFocus();

          await userEvent.click(document.body);
          await flushMicrotasks();

          expect(screen.getByText('reference')).not.toHaveFocus();
        },
      );

      test('returns focus to reference on outside press when preventScroll is supported', async () => {
        const originalFocus = HTMLElement.prototype.focus;
        Object.defineProperty(HTMLElement.prototype, 'focus', {
          configurable: true,
          value(options: any) {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            options && options.preventScroll;
            return originalFocus.call(this, options);
          },
          writable: true,
        });

        function App() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          const click = useClick({ context });
          const dismiss = useDismiss({ context });

          const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

          return (
            <>
              <button ref={refs.setReference} {...getReferenceProps()}>
                reference
              </button>
              <Show when={isOpen()}>
                <FloatingFocusManager context={context}>
                  <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        await userEvent.click(screen.getByText('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        await userEvent.click(document.body);
        await flushMicrotasks();

        expect(screen.getByText('reference')).toHaveFocus();

        HTMLElement.prototype.focus = originalFocus;
      });

      function ClickDismissApp() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          get open() {
            return isOpen();
          },
          onOpenChange: setIsOpen,
        });

        const click = useClick({ context });
        const dismiss = useDismiss({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

        return (
          <>
            <button ref={refs.setReference} {...getReferenceProps()}>
              reference
            </button>
            <Show when={isOpen()}>
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      test('passes focusVisible when returning focus after keyboard close', async () => {
        render(() => <ClickDismissApp />);

        const reference = screen.getByText('reference');
        await userEvent.click(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await userEvent.keyboard('{Escape}');

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('omits focusVisible when returning focus after pointer close', async () => {
        render(() => <ClickDismissApp />);

        const reference = screen.getByText('reference');
        await userEvent.click(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          // Closing with a pointer must not force `:focus-visible`; `focusVisible`
          // is omitted entirely so the browser's own heuristics decide.
          await userEvent.click(reference);

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('does not insert fallback element when return element is falsy', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          const click = useClick({ context });
          const { getReferenceProps, getFloatingProps } = useInteractions([click]);

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <FloatingPortal>
                <Show when={isOpen()}>
                  <FloatingFocusManager context={context} returnFocus={() => undefined}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button data-testid="close" onClick={() => setIsOpen(false)} />
                    </div>
                  </FloatingFocusManager>
                </Show>
              </FloatingPortal>
            </>
          );
        }

        render(() => <App />);

        const reference = screen.getByTestId('reference');
        await userEvent.click(reference);
        await flushMicrotasks();

        expect(reference.nextElementSibling).toBeNull();

        await userEvent.click(screen.getByTestId('close'));

        await waitFor(() => {
          expect(screen.queryByTestId('close')).toBeNull();
        });

        expect(reference.nextElementSibling).toBeNull();
      });
    });

    describe('iframe focus navigation', () => {
      function App(props: { iframe: HTMLElement }) {
        return (
          <div>
            <a href="#">prev iframe link</a>
            <Popover
              portalRef={props.iframe}
              render={() => (
                <div data-testid="popover">
                  <a href="#">popover link 1</a>
                  <a href="#">popover link 2</a>
                </div>
              )}
            >
              {(p) => <button {...p}>Open</button>}
            </Popover>
            <a href="#">next iframe link</a>
          </div>
        );
      }

      function Popover(props: {
        children: Component;
        render: () => JSX.Element;
        portalRef?: HTMLElement;
      }) {
        const [open, setOpen] = createSignal(false);

        const { floatingStyles, refs, context } = useFloating({
          onOpenChange: setOpen,
          get open() {
            return open();
          },
        });

        const { getReferenceProps, getFloatingProps } = useInteractions([
          useClick({ context }),
          useDismiss({ context }),
        ]);

        return (
          <>
            <Dynamic
              component={props.children}
              {...getReferenceProps({ ref: refs.setReference })}
            />
            <Show when={open()}>
              <FloatingPortal container={props.portalRef}>
                <FloatingFocusManager context={context} modal={false}>
                  <div ref={refs.setFloating} style={floatingStyles()} {...getFloatingProps()}>
                    <Dynamic component={props.render} />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </Show>
          </>
        );
      }

      function IframeApp() {
        onSettled(() => {
          let dispose: (() => void) | undefined;
          // `render` flushes, which a settle callback may not do: mount the iframe app right after.
          queueMicrotask(() => {
            const container = document.querySelector('#innerRoot');
            const iframe = document.createElement('iframe');
            iframe.setAttribute('data-testid', 'iframe');
            iframe.src = 'about:blank';
            iframe.style.height = '300px';

            container?.appendChild(iframe);

            // Properly open, write, and close the iframe document.
            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
              iframeDoc.open();
              iframeDoc.write(`<div id="rootIframe"></div>`);
              iframeDoc.close();
            }

            const root = iframe.contentWindow?.document.getElementById('rootIframe');

            if (root) {
              // Solid: `render` registers the iframe root as a delegated root; make sure these
              // events are delegated so they reach the app's handlers inside the iframe.
              delegateEvents([
                'click',
                'mousedown',
                'pointerdown',
                'keydown',
                'focusin',
                'focusout',
              ]);
              dispose = solidRender(() => <App iframe={root} />, root);
            }
          });
          return () => dispose?.();
        });

        return (
          <>
            <a href="#">Outside link 1</a>
            <div id="innerRoot" />
            <a href="#">Outside link 2</a>
          </>
        );
      }

      /* eslint-disable testing-library/prefer-screen-queries */
      // "Should not already be working"(?) when trying to click within the iframe
      // https://github.com/facebook/react/pull/32441
      test.skipIf(!isJSDOM)('tabs from the popover to the next element in the iframe', async () => {
        render(() => <IframeApp />);

        const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

        const user = userEvent.setup({ document: iframeDoc });

        await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

        const popover = iframeWithin.getByTestId('popover');
        expect(iframeDoc!.body.contains(popover)).toBe(true);

        await user.tab();
        await user.tab();

        expect(isFocused(iframeWithin.getByText('next iframe link'))).toBe(true);
      });

      // "Should not already be working"(?) when trying to click within the iframe
      // https://github.com/facebook/react/pull/32441
      test.skipIf(!isJSDOM)(
        'shift+tab from the popover to the previous element in the iframe',
        async () => {
          render(() => <IframeApp />);

          const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

          const user = userEvent.setup({ document: iframeDoc });

          await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

          const popover = iframeWithin.getByTestId('popover');
          expect(iframeDoc!.body.contains(popover)).toBe(true);

          await user.tab({ shift: true });

          expect(isFocused(iframeWithin.getByRole('button', { name: 'Open' }))).toBe(true);
        },
      );
    });
    /* eslint-enable testing-library/prefer-screen-queries */

    describe('prop: modal', () => {
      test('when true', async () => {
        render(() => <App modal />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('one')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('when false', async () => {
        render(() => <App modal={false} />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();

        // Wait for the setTimeout that wraps onOpenChange(false).
        await new Promise((resolve) => setTimeout(resolve));

        // Focus leaving the floating element closes it.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('closeOnFocusOut: false keeps a non-modal element open when focus leaves', async () => {
        render(() => <App modal={false} closeOnFocusOut={false} />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        // Move focus out of the floating element entirely.
        await userEvent.tab();

        // Wait for the (potential) setTimeout that wraps onOpenChange(false).
        await act(() => new Promise((resolve) => setTimeout(resolve)));

        // With `closeOnFocusOut={false}`, focus leaving the floating element does not close it.
        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('clicking a nested click trigger does not suppress the next focus-out close', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);
          const { refs, context } = useFloating({
            get open() {
              return open();
            },
            onOpenChange: setOpen,
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              <Show when={open()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div role="dialog" ref={refs.setFloating} data-testid="floating">
                    <button data-base-ui-click-trigger="" data-testid="nested-trigger" />
                  </div>
                </FloatingFocusManager>
              </Show>
              <button data-testid="last" />
            </>
          );
        }

        render(() => <App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.click(screen.getByTestId('nested-trigger'));
        await act(() => new Promise((resolve) => setTimeout(resolve)));

        await userEvent.tab();
        await act(() => new Promise((resolve) => setTimeout(resolve)));

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('false - comboboxes do not hide all other nodes', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);
          const { refs, context } = useFloating({
            onOpenChange: setOpen,
            get open() {
              return open();
            },
          });

          return (
            <>
              <input
                role="combobox"
                data-testid="reference"
                ref={refs.setReference}
                onFocus={() => setOpen(true)}
              />
              <button data-testid="btn-1" />
              <button data-testid="btn-2" />
              <Show when={open()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        fireEvent.focus(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
      });

      test('fallback to floating element when it has no tabbable content', async () => {
        function App() {
          const { refs, context } = useFloating({ open: true });
          return (
            <>
              <button data-testid="reference" ref={refs.setReference} />
              <FloatingFocusManager context={context} modal>
                <div ref={refs.setFloating} data-testid="floating" tabindex={-1} />
              </FloatingFocusManager>
            </>
          );
        }

        render(() => <App />);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
        await userEvent.tab();
        expect(screen.getByTestId('floating')).toHaveFocus();
        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('mixed modality and nesting', async () => {
        interface Props {
          open?: boolean;
          modal?: boolean;
          render: (props: { close: () => void }) => JSX.Element;
          children?: Component;
          sideChildren?: JSX.Element;
        }

        const Dialog = (componentProps: Props) => {
          const props = defaultProps(componentProps, { modal: true });
          const [internalOpen, setOpen] = createSignal(false);
          const nodeId = useFloatingNodeId();
          const open = () => (props.open !== undefined ? props.open : internalOpen());

          const { refs, context } = useFloating({
            get nodeId() {
              return nodeId();
            },
            onOpenChange: setOpen,
            get open() {
              return open();
            },
          });

          const { getReferenceProps, getFloatingProps } = useInteractions([
            useClick({ context }),
            useDismiss({ context, props: { bubbles: false } }),
          ]);

          return (
            <FloatingNode id={nodeId()}>
              <Dynamic
                component={props.children}
                {...getReferenceProps({ ref: refs.setReference })}
              />
              <FloatingPortal>
                <Show when={open()}>
                  <FloatingFocusManager context={context} modal={props.modal}>
                    <div {...getFloatingProps({ ref: refs.setFloating })}>
                      <Dynamic component={props.render} close={() => setOpen(false)} />
                    </div>
                  </FloatingFocusManager>
                </Show>
              </FloatingPortal>
              {props.sideChildren}
            </FloatingNode>
          );
        };

        const NestedDialog = (props: Props) => {
          const parentId = useFloatingParentNodeId();

          return (
            <Show when={parentId == null} fallback={<Dialog {...props} />}>
              <FloatingTree>
                <Dialog {...props} />
              </FloatingTree>
            </Show>
          );
        };

        const App = () => {
          const [sideDialogOpen, setSideDialogOpen] = createSignal(false);

          return (
            <NestedDialog
              modal={false}
              render={(props) => {
                return (
                  <>
                    <button
                      onClick={() => {
                        props.close();
                      }}
                      data-testid="close-dialog"
                    />
                    <button
                      onClick={() => {
                        setSideDialogOpen(true);
                      }}
                      data-testid="open-nested-dialog"
                    />
                  </>
                );
              }}
              sideChildren={
                <NestedDialog
                  modal
                  open={sideDialogOpen()}
                  render={(props) => {
                    return (
                      <button
                        onClick={() => {
                          props.close();
                        }}
                        data-testid="close-nested-dialog"
                      />
                    );
                  }}
                />
              }
            >
              {(props) => <button data-testid="open-dialog" {...props} />}
            </NestedDialog>
          );
        };

        render(() => <App />);

        await userEvent.click(screen.getByTestId('open-dialog'));
        await userEvent.click(screen.getByTestId('open-nested-dialog'));
        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();
      });

      test('true - applies aria-hidden to outside nodes', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div>
                <div data-testid="aria-live" aria-live="polite" />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
              </div>
              <Show when={isOpen()}>
                <FloatingFocusManager context={context}>
                  <div ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('btn-2')).toHaveAttribute('aria-hidden', 'true');

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden');
      });

      test('true - keeps supplied inside elements outside the floating node exposed to assistive tech', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          let dismissRef: HTMLButtonElement | null = null;
          const { refs, context } = useFloating({
            get open() {
              return isOpen();
            },
            onOpenChange: setIsOpen,
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <button data-testid="outside-button" />
              </div>
              <Show when={isOpen()}>
                <FloatingFocusManager context={context} getInsideElements={() => [dismissRef]}>
                  <>
                    <div ref={refs.setFloating} data-testid="floating" />
                    <button
                      ref={(node) => {
                        dismissRef = node;
                      }}
                      data-testid="dismiss"
                    />
                  </>
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('dismiss')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('aria-hidden', 'true');
      });

      test('false - does not apply inert to outside nodes', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <div data-testid="aria-live" aria-live="polite" />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
              </div>
              <Show when={isOpen()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('reference')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
      });

      test('false - keeps marker on top-level outside ancestor when reference has siblings', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const { refs, context } = useFloating({
            get open() {
              return isOpen();
            },
            onOpenChange: setIsOpen,
          });

          return (
            <>
              <div data-testid="outside-wrapper">
                <input
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => setIsOpen((v) => !v)}
                />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
                <div data-testid="nested-wrapper">
                  <button data-testid="nested-btn" />
                </div>
              </div>
              <div data-testid="outside-sibling" />
              <Show when={isOpen()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-sibling')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-base-ui-inert');

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-sibling')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-base-ui-inert');
      });
    });

    describe('prop: disabled', () => {
      test('true -> false', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [disabled, setDisabled] = createSignal(true);

          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <button data-testid="toggle" onClick={() => setDisabled((v) => !v)} />
              <Show when={isOpen()}>
                <FloatingFocusManager context={context} disabled={disabled()}>
                  <div ref={refs.setFloating} data-testid="floating" role="dialog" />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveFocus();
        fireEvent.click(screen.getByTestId('toggle'));
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
      });

      test('when false', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [disabled, setDisabled] = createSignal(false);

          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          const click = useClick({ context });

          const { getReferenceProps, getFloatingProps } = useInteractions([click]);

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <button data-testid="toggle" onClick={() => setDisabled((v) => !v)} />
              <Show when={isOpen()}>
                <FloatingFocusManager context={context} disabled={disabled()}>
                  <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()} />
                </FloatingFocusManager>
              </Show>
            </>
          );
        }

        render(() => <App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('supports keepMounted behavior', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, context } = useFloating({
            onOpenChange: setIsOpen,
            get open() {
              return isOpen();
            },
          });

          const click = useClick({ context });
          const dismiss = useDismiss({ context });

          const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <FloatingFocusManager context={context} disabled={!isOpen()} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()}>
                  <button data-testid="child" />
                </div>
              </FloatingFocusManager>
              <button data-testid="after" />
            </>
          );
        }

        render(() => <App />);

        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveFocus();

        fireEvent.click(screen.getByTestId('reference'));

        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await userEvent.tab();

        expect(screen.getByTestId('after')).toHaveFocus();

        await userEvent.tab({ shift: true });

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('child')).toHaveFocus();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('reference')).toHaveFocus();
      });

      test('resets close modality between keep-mounted open sessions', async () => {
        const finalFocus = vi.fn((_closeType: InteractionType) => true);

        function App() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, context } = useFloating({
            get open() {
              return isOpen();
            },
            onOpenChange: setIsOpen,
          });

          const click = useClick({ context });
          const dismiss = useDismiss({ context });
          const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <button data-testid="controlled-open" onClick={() => setIsOpen(true)} />
              <button data-testid="controlled-close" onClick={() => setIsOpen(false)} />
              <FloatingPortal>
                <FloatingFocusManager
                  context={context}
                  disabled={!isOpen()}
                  returnFocus={finalFocus}
                >
                  <div ref={refs.setFloating} {...getFloatingProps()}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </>
          );
        }

        render(() => <App />);

        const reference = screen.getByTestId('reference');
        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await userEvent.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          await userEvent.keyboard('{Escape}');
          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(finalFocus).toHaveBeenLastCalledWith('keyboard');

          focusSpy.mockClear();

          await userEvent.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fireEvent.click(screen.getByTestId('controlled-close'));

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
          expect(finalFocus).toHaveBeenLastCalledWith('');

          focusSpy.mockClear();
          finalFocus.mockClear();

          fireEvent.click(screen.getByTestId('controlled-open'));
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fireEvent.pointerDown(reference, { pointerType: 'mouse' });
          fireEvent.click(screen.getByTestId('controlled-close'));

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
          expect(finalFocus).toHaveBeenCalledWith('');

          focusSpy.mockClear();
          finalFocus.mockClear();

          fireEvent.click(screen.getByTestId('controlled-open'));
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fireEvent.click(reference, { detail: 0 });

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(finalFocus).toHaveBeenCalledWith('keyboard');
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('preserves keyboard close modality when reopening before focus restoration', async () => {
        function App() {
          const [isOpen, setIsOpen] = createSignal(false);
          const [reopenOnClose, setReopenOnClose] = createSignal(false);

          const { refs, context } = useFloating({
            get open() {
              return isOpen();
            },
            onOpenChange: setIsOpen,
          });

          const click = useClick({ context });
          const dismiss = useDismiss({ context });
          const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

          // Layout-effect timing, as React's `useIsoLayoutEffect`.
          createRenderEffect(
            () => [isOpen(), reopenOnClose()] as const,
            ([open, reopen]) => {
              if (!open && reopen) {
                setReopenOnClose(false);
                setIsOpen(true);
              }
            },
          );

          return (
            <>
              <span data-testid="open-state">{String(isOpen())}</span>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <button data-testid="reopen-on-close" onClick={() => setReopenOnClose(true)} />
              <FloatingPortal>
                <FloatingFocusManager context={context} disabled={!isOpen()}>
                  <div ref={refs.setFloating} {...getFloatingProps()}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </>
          );
        }

        render(() => <App />);

        const reference = screen.getByTestId('reference');
        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await userEvent.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          fireEvent.click(screen.getByTestId('reopen-on-close'));
          await userEvent.keyboard('{Escape}');

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(screen.getByTestId('open-state')).toHaveTextContent('true');
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('clears outside pointer state between keep-mounted open sessions', async () => {
        // Solid: the flag React names `insideReactTree` is `insidePortal`.
        let readInsideTree = () => false;

        function App() {
          const [isOpen, setIsOpen] = createSignal(false);

          const { refs, context } = useFloating({
            get open() {
              return isOpen();
            },
            onOpenChange: setIsOpen,
          });

          readInsideTree = () => Boolean(context.dataRef.insidePortal);

          const click = useClick({ context });
          const dismiss = useDismiss({ context });

          const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

          return (
            <>
              <span data-testid="open-state">{String(isOpen())}</span>
              <button data-testid="before" />
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <FloatingPortal>
                <FloatingFocusManager context={context} disabled={!isOpen()} modal={false}>
                  <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
              <button data-testid="after" />
            </>
          );
        }

        render(() => <App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        fireEvent.pointerDown(screen.getByTestId('after'));
        await flushMicrotasks();

        expect(screen.getByTestId('open-state')).toHaveTextContent('false');

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        fireEvent.focusOut(screen.getByTestId('child'), {
          relatedTarget: screen.getByTestId('after'),
        });

        expect(readInsideTree()).toBe(true);
      });
    });

    describe('non-modal + FloatingPortal', () => {
      test('focuses inside element, tabbing out focuses last document element', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);
          const { refs, context } = useFloating({
            onOpenChange: setOpen,
            get open() {
              return open();
            },
          });

          return (
            <>
              <span tabindex={0} data-testid="first" />
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              <FloatingPortal>
                <Show when={open()}>
                  <FloatingFocusManager context={context} modal={false}>
                    <div data-testid="floating" ref={refs.setFloating}>
                      <span tabindex={0} data-testid="inside" />
                    </div>
                  </FloatingFocusManager>
                </Show>
              </FloatingPortal>
              <span tabindex={0} data-testid="last" />
            </>
          );
        }

        render(() => <App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('inside')).toHaveFocus();

        await userEvent.tab();

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      function PortalApp(props: { portalOwnerRole?: JSX.AriaAttributes['role'] }) {
        const [open, setOpen] = createSignal(false);
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: setOpen,
        });

        return (
          <>
            <div data-testid="reference-wrapper">
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              <span data-testid="reference-sibling-1" />
              <span data-testid="reference-sibling-2" />
            </div>
            <FloatingPortal portalOwnerRole={props.portalOwnerRole}>
              <Show when={open()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div data-testid="floating" ref={refs.setFloating}>
                    <span tabindex={0} data-testid="inside" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </FloatingPortal>
          </>
        );
      }

      test('does not mark reference siblings due to outside focus guards', async () => {
        render(() => <PortalApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference-sibling-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference-sibling-2')).not.toHaveAttribute('data-base-ui-inert');
      });

      test('renders the aria-owns owner without changing regular reference semantics', async () => {
        render(() => <PortalApp />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const reference = screen.getByTestId('reference');
        const portalNode = screen.getByTestId('floating').closest('[data-base-ui-portal]');
        const portalNodeId = portalNode?.id ?? '';
        const owner = portalNode?.ownerDocument.querySelector('span[aria-owns]');

        expect(portalNodeId).not.toBe('');
        expect(owner).not.toHaveAttribute('role');
        expect(owner).toHaveAttribute('aria-owns', portalNodeId);
        expect(reference).not.toHaveAttribute('aria-owns');
      });

      test('supports setting the aria-owns owner role explicitly', async () => {
        render(() => <PortalApp portalOwnerRole="group" />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const portalNode = screen.getByTestId('floating').closest('[data-base-ui-portal]');
        const owner = portalNode?.ownerDocument.querySelector('span[aria-owns]');

        expect(portalNode).not.toBe(null);
        expect(owner).toHaveAttribute('role', 'group');
      });

      test('shift+tab', async () => {
        function App() {
          const [open, setOpen] = createSignal(false);
          const { refs, context } = useFloating({
            onOpenChange: setOpen,
            get open() {
              return open();
            },
          });

          return (
            <>
              <span tabindex={0} data-testid="first" />
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              <FloatingPortal>
                <Show when={open()}>
                  <FloatingFocusManager context={context} modal={false}>
                    <div data-testid="floating" ref={refs.setFloating}>
                      <span tabindex={0} data-testid="inside" />
                    </div>
                  </FloatingFocusManager>
                </Show>
              </FloatingPortal>
              <span tabindex={0} data-testid="last" />
            </>
          );
        }

        render(() => <App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        await userEvent.tab({ shift: true });

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await userEvent.tab({ shift: true });

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
      });
    });

    describe('Navigation', () => {
      test('does not focus reference when hovering it', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.unhover(screen.getByText('Product'));
        expect(screen.getByText('Product')).not.toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by esc key', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await userEvent.keyboard('{Escape}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by an explicit close button', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await userEvent.click(screen.getByText('Close').parentElement!);
        await userEvent.keyboard('{Tab}');
        expect(screen.getByText('Close')).toHaveFocus();
        await userEvent.keyboard('{Enter}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('does not re-open after closing via escape key', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByText('Link 1')).not.toBeInTheDocument();
      });

      test('closes when unhovering floating element even when focus is inside it', async () => {
        render(() => <Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.click(screen.getByTestId('subnavigation'));
        await userEvent.unhover(screen.getByTestId('subnavigation'));
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.unhover(screen.getByText('Product'));
        expect(screen.queryByTestId('subnavigation')).not.toBeInTheDocument();
      });
    });
  });

  describe('prop: restoreFocus', () => {
    function App(componentProps: { restoreFocus?: boolean }) {
      const props = defaultProps(componentProps, { restoreFocus: true });
      const [isOpen, setIsOpen] = createSignal(false);
      const [removed, setRemoved] = createSignal(false);
      // Solid: a signal, so `initialFocus` resolves the button at focus time as React's ref does.
      const [twoRef, setTwoRef] = createSignal<HTMLButtonElement | null>(null);

      const { refs, context } = useFloating({
        onOpenChange: setIsOpen,
        get open() {
          return isOpen();
        },
      });

      const click = useClick({ context });
      const { getReferenceProps, getFloatingProps } = useInteractions([click]);

      return (
        <>
          <button onClick={() => setRemoved(true)}>remove</button>
          <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
          <Show when={isOpen()}>
            <FloatingFocusManager
              context={context}
              restoreFocus={props.restoreFocus}
              initialFocus={twoRef()}
            >
              <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                <button>one</button>
                <Show when={!removed()}>
                  <button ref={setTwoRef}>two</button>
                </Show>
                <button>three</button>
              </div>
            </FloatingFocusManager>
          </Show>
        </>
      );
    }

    test.skipIf(isJSDOM)(
      'true: restores focus to nearest tabbable element if currently focused element is removed',
      async () => {
        render(() => <App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const three = screen.getByRole('button', { name: 'three' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        fireEvent.click(remove);

        await waitFor(() => {
          expect(three).toHaveFocus();
        });
      },
    );

    test.skipIf(isJSDOM)(
      'false: does not restore focus to nearest tabbable element if currently focused element is removed',
      async () => {
        render(() => <App restoreFocus={false} />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        fireEvent.click(remove);
        await flushMicrotasks();

        await waitFor(() => {
          expect(document.body).toHaveFocus();
        });
      },
    );
    test('restores focus to the nearest tabbable element when the focused element becomes hidden', async () => {
      render(() => <App />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      const two = screen.getByRole('button', { name: 'two' });
      const three = screen.getByRole('button', { name: 'three' });

      expect(two).toHaveFocus();

      document.body.tabIndex = -1;
      two.style.visibility = 'hidden';
      act(() => document.body.focus());

      await waitFor(() => {
        expect(three).toHaveFocus();
      });
    });
  });

  describe.skipIf(!isJSDOM)('JSDOM-only combobox and focus return coverage', () => {
    test('trapped combobox prevents focus moving outside floating element', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, floatingStyles, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const role = useRole({ context });
        const dismiss = useDismiss({ context });
        const click = useClick({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([role, dismiss, click]);

        return (
          <div class="App">
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} style={floatingStyles()} {...getFloatingProps()}>
                  <button>one</button>
                  <button>two</button>
                </div>
              </FloatingFocusManager>
            </Show>
          </div>
        );
      }

      render(() => <App />);
      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).not.toHaveFocus();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await flushMicrotasks();
    });

    test('untrapped combobox creates non-modal focus management', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, floatingStyles, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const role = useRole({ context });
        const dismiss = useDismiss({ context });
        const click = useClick({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([role, dismiss, click]);

        return (
          <>
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            <Show when={isOpen()}>
              <FloatingPortal>
                <FloatingFocusManager context={context} initialFocus={false} modal={false}>
                  <div ref={refs.setFloating} style={floatingStyles()} {...getFloatingProps()}>
                    <button>one</button>
                    <button>two</button>
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </Show>
            <button>outside</button>
          </>
        );
      }

      render(() => <App />);
      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    test('returns focus to last connected element', async () => {
      function Drawer(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
        const { refs, context } = useFloating({
          get open() {
            return props.open;
          },
          // eslint-disable-next-line solid/reactivity
          onOpenChange: props.onOpenChange,
        });
        const dismiss = useDismiss({ context });
        const { getFloatingProps } = useInteractions([dismiss]);

        return (
          <FloatingFocusManager context={context}>
            <div ref={refs.setFloating} {...getFloatingProps()}>
              <button data-testid="child-reference" />
            </div>
          </FloatingFocusManager>
        );
      }

      function Parent() {
        const [isOpen, setIsOpen] = createSignal(false);
        const [isDrawerOpen, setIsDrawerOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const dismiss = useDismiss({ context });
        const click = useClick({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

        return (
          <>
            <button
              ref={refs.setReference}
              data-testid="parent-reference"
              {...getReferenceProps()}
            />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} {...getFloatingProps()}>
                  Parent Floating
                  <button
                    data-testid="parent-floating-reference"
                    onClick={() => {
                      {
                        setIsDrawerOpen(true);
                        setIsOpen(false);
                      }
                    }}
                  />
                </div>
              </FloatingFocusManager>
            </Show>
            <Show when={isDrawerOpen()}>
              <Drawer open={isDrawerOpen()} onOpenChange={setIsDrawerOpen} />
            </Show>
          </>
        );
      }

      render(() => <Parent />);
      await userEvent.click(screen.getByTestId('parent-reference'));
      await flushMicrotasks();
      expect(screen.getByTestId('parent-floating-reference')).toHaveFocus();
      await userEvent.click(screen.getByTestId('parent-floating-reference'));
      await flushMicrotasks();
      expect(screen.getByTestId('child-reference')).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(screen.getByTestId('parent-reference')).toHaveFocus();
    });

    test('focus is placed on element with floating props when floating element is a wrapper', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const role = useRole({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([role]);

        return (
          <>
            <button
              ref={refs.setReference}
              {...getReferenceProps({
                onClick: () => setIsOpen((v) => !v),
              })}
            />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} data-testid="outer">
                  <div {...getFloatingProps()} data-testid="inner" />
                </div>
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <App />);

      await userEvent.click(screen.getByRole('button'));
      await flushMicrotasks();

      expect(screen.getByTestId('inner')).toHaveFocus();
    });

    test('floating element closes upon tabbing out of modal combobox', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const click = useClick({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([click]);

        return (
          <>
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context} initialFocus={false}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                  <button tabindex={-1}>one</button>
                </div>
              </FloatingFocusManager>
            </Show>
            <button data-testid="after" />
          </>
        );
      }

      render(() => <App />);
      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveFocus();
      await userEvent.tab();
      await flushMicrotasks();
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    test('untrapped typeable combobox closes on second tab sequence (click -> tab -> click -> tab)', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const click = useClick({ context });
        const { getReferenceProps, getFloatingProps } = useInteractions([click]);

        return (
          <>
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context} initialFocus={false} modal>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                  <button tabindex={-1}>one</button>
                </div>
              </FloatingFocusManager>
            </Show>
            <button data-testid="after" />
          </>
        );
      }

      render(() => <App />);

      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveFocus();

      await userEvent.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveFocus();

      await userEvent.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
    });

    test('focus does not return to reference when floating element is triggered by hover', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const hover = useHover({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

        return (
          <>
            <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <App />);

      const reference = screen.getByTestId('reference');

      reference.focus();

      await userEvent.hover(reference);
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveFocus();

      await userEvent.unhover(screen.getByTestId('floating'));

      expect(screen.getByTestId('reference')).not.toHaveFocus();
    });

    test('uses aria-hidden instead of inert on outside nodes if opened with hover and modal=true', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const hover = useHover({ context });

        const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

        return (
          <>
            <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
              </FloatingFocusManager>
            </Show>
            <button>outside</button>
          </>
        );
      }

      render(() => <App />);

      await userEvent.hover(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByText('outside')).not.toHaveAttribute('inert');
      expect(screen.getByText('outside')).toHaveAttribute('aria-hidden', 'true');
    });

    test('floating element with no focusable elements and no listbox role gets tabIndex=0 when initialFocus is -1', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        return (
          <>
            <button
              data-testid="reference"
              ref={refs.setReference}
              onClick={() => setIsOpen(true)}
            />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context} initialFocus={false} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" role="dialog" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <App />);

      const reference = screen.getByTestId('reference');
      await userEvent.click(reference);
      await flushMicrotasks();
      fireEvent.focusOut(reference);
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
    });

    test('floating element with managed tabIndex is downgraded once content becomes tabbable', async () => {
      const [hasTabbableContent, setHasTabbableContent] = createSignal(false);

      function App() {
        const { refs, context } = useFloating({
          open: true,
          onOpenChange() {},
        });

        return (
          <>
            <button data-testid="reference" ref={refs.setReference} />
            <FloatingFocusManager context={context} initialFocus={false} modal={false}>
              <div ref={refs.setFloating} data-testid="floating" role="dialog">
                <Show when={hasTabbableContent()}>
                  <button data-testid="inside" />
                </Show>
              </div>
            </FloatingFocusManager>
          </>
        );
      }

      render(() => <App />);
      await flushMicrotasks();

      const reference = screen.getByTestId('reference');
      act(() => reference.focus());

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '0');

      // Solid: props change through a signal instead of `rerender`.
      act(() => setHasTabbableContent(true));
      await flushMicrotasks();

      fireEvent.focusOut(reference, { relatedTarget: screen.getByTestId('inside') });
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '-1');
    });

    test('floating element with listbox role ignores tabIndex setting', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const click = useClick({ context });
        const { getReferenceProps, getFloatingProps } = useInteractions([click]);

        return (
          <>
            <button
              data-testid="reference"
              ref={refs.setReference}
              onClick={() => setIsOpen(true)}
              {...getReferenceProps()}
            >
              ref
            </button>
            <Show when={isOpen()}>
              <FloatingFocusManager context={context} initialFocus={false} modal={false}>
                <div
                  ref={refs.setFloating}
                  role="listbox"
                  data-testid="floating"
                  {...getFloatingProps()}
                >
                  floating
                </div>
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <App />);
      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
    });

    test('handles manual tabindex on dialog floating element', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        return (
          <>
            <button
              data-testid="reference"
              ref={refs.setReference}
              onClick={() => setIsOpen(true)}
            />
            <Show when={isOpen()}>
              <FloatingFocusManager context={context} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" role="dialog" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <App />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('reference')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('floating')).toHaveFocus();
    });

    test('standard tabbing back and forth of a non-modal floating element', async () => {
      function App() {
        const [isOpen, setIsOpen] = createSignal(false);

        const { refs, context } = useFloating({
          onOpenChange: setIsOpen,
          get open() {
            return isOpen();
          },
        });

        const click = useClick({ context });
        const { getReferenceProps, getFloatingProps } = useInteractions([click]);

        return (
          <>
            <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
            <Show when={isOpen()}>
              <FloatingPortal>
                <FloatingFocusManager context={context} modal={false}>
                  <div
                    ref={refs.setFloating}
                    data-testid="floating"
                    role="dialog"
                    {...getFloatingProps()}
                  >
                    <button data-testid="inner">inner</button>
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            </Show>
          </>
        );
      }
      render(() => <App />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('inner')).toHaveFocus();
      await userEvent.tab({ shift: true });

      expect(screen.getByTestId('reference')).toHaveFocus();
      await userEvent.tab();

      expect(screen.getByTestId('inner')).toHaveFocus();
    });
  });
});
