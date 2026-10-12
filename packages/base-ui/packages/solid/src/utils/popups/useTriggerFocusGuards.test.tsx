import { createMemo, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { Dialog } from '@solidports/base-ui/dialog';
import { Menu } from '@solidports/base-ui/menu';
import { Popover } from '@solidports/base-ui/popover';
import { act, createRenderer, isJSDOM } from '#test-utils';

describe.skipIf(isJSDOM)('useTriggerFocusGuards', () => {
  const { render } = createRenderer();

  // Native Tab runs a microtask checkpoint between the trigger's blur and the guard's focus,
  // which `@testing-library`'s synthetic events skip.
  let user: Awaited<typeof import('vitest/browser')>['userEvent'];
  beforeAll(async () => {
    ({ userEvent: user } = await import('vitest/browser'));
  });

  beforeEach(() => {
    // The guards outlive `open` by a microtask only while exit animations run.
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
  });

  describe.each([
    { name: 'Popover', Component: Popover },
    { name: 'Menu', Component: Menu },
  ])('$name', ({ name, Component }) => {
    function TestPopup(props: {
      tabIndex?: number;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      class?: string;
      finalFocus?: Popover.Popup.Props['finalFocus'];
    }) {
      return (
        <Component.Root modal={false} open={props.open} onOpenChange={props.onOpenChange}>
          <Component.Trigger tabIndex={props.tabIndex}>Toggle</Component.Trigger>
          <Component.Portal>
            <Component.Positioner>
              <Component.Popup
                class={props.class}
                data-testid="popup"
                finalFocus={props.finalFocus}
              >
                {name === 'Menu' ? (
                  <Menu.Item data-testid="inside">Inside</Menu.Item>
                ) : (
                  <button data-testid="inside">Inside</button>
                )}
              </Component.Popup>
            </Component.Positioner>
          </Component.Portal>
        </Component.Root>
      );
    }

    async function openPopup() {
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);
      // Menu moves focus to the popup itself; Popover moves it to the first tabbable inside.
      await waitFor(() => {
        expect(screen.getByTestId(name === 'Popover' ? 'inside' : 'popup')).toHaveFocus();
      });
      return trigger;
    }

    describe.each(['forward', 'backward'] as const)('tabbing %s', (direction) => {
      /** Puts focus on the element the upcoming Tab should leave from. */
      async function focusTabOrigin(trigger: HTMLElement) {
        await act(async () =>
          (direction === 'backward' ? trigger : screen.getByTestId('inside')).focus(),
        );
      }

      it.each([
        ['ref', 0],
        ['function', 0],
        ['ref', -1],
        ['function', -1],
      ] as const)(
        'preserves the tab destination after the exit transition with finalFocus as a %s and trigger tabIndex=%s',
        async (finalFocusType, tabIndex) => {
          // Solid: `finalFocus` takes the element itself, so the "ref" case reads it from a signal.
          const [finalFocusElement, setFinalFocusElement] = createSignal<HTMLButtonElement | null>(
            null,
          );

          await render(() => (
            <div>
              <style>{`
                .popup { transition: opacity 200ms; }
                .popup[data-ending-style] { opacity: 0; }
              `}</style>
              <button data-testid="before">Before</button>
              <TestPopup
                tabIndex={tabIndex}
                class="popup"
                finalFocus={finalFocusType === 'ref' ? finalFocusElement() : () => true}
              />
              <button data-testid="after">After</button>
              <button ref={setFinalFocusElement}>Final focus</button>
            </div>
          ));

          const trigger = await openPopup();

          if (direction === 'backward' && name === 'Popover') {
            await user.tab({ shift: true });
          } else {
            // Menu closes on Shift+Tab from its content, so focus the trigger directly instead.
            await focusTabOrigin(trigger);
          }

          expect(direction === 'backward' ? trigger : screen.getByTestId('inside')).toHaveFocus();
          expect(trigger).toHaveAttribute('aria-expanded', 'true');

          await user.tab({ shift: direction === 'backward' });

          const destination = screen.getByTestId(direction === 'backward' ? 'before' : 'after');
          expect(destination).toHaveFocus();
          await waitFor(() => {
            expect(screen.queryByTestId('popup')).toBe(null);
          });
          expect(destination).toHaveFocus();
          expect(trigger).toHaveAttribute('tabindex', String(tabIndex));
        },
      );

      it.each(['disabled', 'tabIndex', 'hidden', 'removed', 'inserted', 'reordered'] as const)(
        'uses the current tab order when an adjacent control is %s during close',
        async (change) => {
          function Fixture() {
            const [open, setOpen] = createSignal(false);
            // Solid: the controls are created once, so reordering moves the same nodes as React's
            // keyed children do.
            const target = (<button data-testid="target">Target</button>) as HTMLButtonElement;
            const candidate = (
              <button
                disabled={change === 'disabled' && !open()}
                tabIndex={change === 'tabIndex' && !open() ? -1 : 0}
                hidden={change === 'hidden' && !open()}
              >
                Candidate
              </button>
            ) as HTMLButtonElement;
            const controls = createMemo(() => {
              let list: JSX.Element[];
              if (change === 'inserted') {
                list = [!open() && target, candidate];
              } else if (change === 'reordered') {
                list = open() ? [candidate, target] : [target, candidate];
              } else {
                list = [change === 'removed' && !open() ? null : candidate, target];
              }
              return direction === 'backward' ? list.reverse() : list;
            });

            return (
              <div>
                {direction === 'backward' && controls()}
                <TestPopup tabIndex={-1} open={open()} onOpenChange={setOpen} />
                {direction === 'forward' && controls()}
              </div>
            );
          }

          await render(() => <Fixture />);
          await focusTabOrigin(await openPopup());
          await user.tab({ shift: direction === 'backward' });

          expect(screen.getByTestId('target')).toHaveFocus();
          await waitFor(() => {
            expect(screen.queryByTestId('popup')).toBe(null);
          });
          expect(screen.getByTestId('target')).toHaveFocus();
        },
      );

      it('preserves the surrounding modal dialog focus trap', async () => {
        await render(() => (
          <div>
            <button>Outside dialog</button>
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup style={{ position: 'relative' }}>
                  {direction === 'forward' && <button>Inside dialog</button>}
                  <TestPopup tabIndex={-1} />
                  {direction === 'backward' && <button>Inside dialog</button>}
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        ));

        const destination = screen.getByRole('button', { name: 'Inside dialog' });
        await waitFor(() => {
          expect(destination).toHaveFocus();
        });

        await focusTabOrigin(await openPopup());
        await user.tab({ shift: direction === 'backward' });

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });
        await waitFor(() => {
          expect(destination).toHaveFocus();
        });
      });

      it.each([0, -1])(
        'returns focus to the trigger when no outside element is tabbable and trigger tabIndex=%s',
        async (tabIndex) => {
          await render(() => <TestPopup tabIndex={tabIndex} />);

          const trigger = await openPopup();
          await focusTabOrigin(trigger);

          await user.tab({ shift: direction === 'backward' });

          expect(trigger).toHaveFocus();
          await waitFor(() => {
            expect(screen.queryByTestId('popup')).toBe(null);
          });
          expect(trigger).toHaveFocus();
          expect(trigger).toHaveAttribute('tabindex', String(tabIndex));
        },
      );
    });
  });
});
