import { createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitProps } from '../../solid-1-compat';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { Popover } from '@solidports/base-ui/popover';
import { createRenderer, isJSDOM } from '#test-utils';

type PopupState = Pick<Popover.Popup.State, 'open' | 'transitionStatus'>;

// Solid: an effect over the state records each committed value, as React's layout effect.
function TrackedPopup(
  props: JSX.HTMLAttributes<HTMLDivElement> & {
    state: PopupState;
    onState: (state: PopupState) => void;
  },
) {
  const [local, divProps] = splitProps(props, ['state', 'onState']);
  // This is the input used by transition components such as Material UI Grow.
  const enter = () => local.state.open && local.state.transitionStatus !== 'starting';
  createEffect(
    () => ({ open: local.state.open, transitionStatus: local.state.transitionStatus }),
    (state) => {
      local.onState(state);
    },
  );
  return <div {...divProps} data-enter={enter() || undefined} />;
}

describe.skipIf(isJSDOM)('Popover popup transition state', () => {
  const { render } = createRenderer();

  it('starts each opening once when the popup is kept mounted', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
    const states: PopupState[] = [];
    function onState(state: PopupState) {
      const previous = states[states.length - 1];
      if (previous?.open !== state.open || previous?.transitionStatus !== state.transitionStatus) {
        states.push(state);
      }
    }
    const completed = vi.fn();

    function TestPopover() {
      return (
        <>
          <style>{`
            .transition-state-popup { opacity: 0; transition: opacity 10s linear; }
            .transition-state-popup[data-enter] { opacity: 1; }
          `}</style>
          <Popover.Root onOpenChangeComplete={completed}>
            <Popover.Trigger>Toggle</Popover.Trigger>
            <Popover.Portal keepMounted>
              <Popover.Positioner>
                <Popover.Popup
                  class="transition-state-popup"
                  render={(props: Record<string, unknown>, state: PopupState) => (
                    <TrackedPopup {...props} state={state} onState={onState} />
                  )}
                >
                  Content
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>
      );
    }

    const { user } = await render(() => <TestPopover />);
    const trigger = screen.getByRole('button', { name: 'Toggle' });

    // The transition lasts longer than any phase of the test, so it cannot end before it is
    // observed on a busy runner. Each phase is finished explicitly instead of waited out.
    async function finishPhase(element: HTMLElement) {
      await waitFor(() => expect(element.getAnimations().length).toBeGreaterThan(0));
      expect(completed).not.toHaveBeenCalled();
      element.getAnimations().forEach((animation) => animation.finish());
    }

    async function openPopover() {
      states.length = 0;
      completed.mockClear();
      await user.click(trigger);
      const popup = await screen.findByRole('dialog');
      await finishPhase(popup);
      await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(true));
      expect(states.filter((state) => state.open)).toEqual([
        { open: true, transitionStatus: 'starting' },
        { open: true, transitionStatus: undefined },
      ]);
      return popup;
    }

    async function closePopover(popup: HTMLElement) {
      completed.mockClear();
      await user.keyboard('{Escape}');
      await finishPhase(popup);
      await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(false));
      // `keepMounted` retains the element, so the next opening reuses it.
      expect(popup.isConnected).toBe(true);
    }

    const popup = await openPopover();
    await closePopover(popup);
    expect(await openPopover()).toBe(popup);
  });
});
