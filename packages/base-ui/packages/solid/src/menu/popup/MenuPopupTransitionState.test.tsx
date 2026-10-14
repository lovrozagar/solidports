import { createEffect, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer, isJSDOM } from '#test-utils';
import { splitProps } from '../../solid-1-compat';

type PopupState = Pick<Menu.Popup.State, 'open' | 'transitionStatus'>;

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

describe.skipIf(isJSDOM)('Menu popup transition state', () => {
  const { render } = createRenderer();

  it.each([
    { controlled: false, keepMounted: false, defaultOpen: false },
    { controlled: false, keepMounted: false, defaultOpen: true },
    { controlled: false, keepMounted: true, defaultOpen: false },
    { controlled: false, keepMounted: true, defaultOpen: true },
    { controlled: true, keepMounted: false, defaultOpen: false },
    { controlled: true, keepMounted: false, defaultOpen: true },
    { controlled: true, keepMounted: true, defaultOpen: false },
    { controlled: true, keepMounted: true, defaultOpen: true },
  ])(
    'starts each opening once (controlled=$controlled, keepMounted=$keepMounted, defaultOpen=$defaultOpen)',
    async ({ controlled, keepMounted, defaultOpen }) => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const states: PopupState[] = [];
      function onState(state: PopupState) {
        const previous = states[states.length - 1];
        if (
          previous?.open !== state.open ||
          previous?.transitionStatus !== state.transitionStatus
        ) {
          states.push(state);
        }
      }
      const completed = vi.fn();

      function TestMenu() {
        const [open, setOpen] = createSignal(defaultOpen);
        return (
          <>
            <style>{`
                  .transition-state-popup { opacity: 0; transition: opacity 10s linear; }
                  .transition-state-popup[data-enter] { opacity: 1; }
                `}</style>
            <Menu.Root
              open={controlled ? open() : undefined}
              defaultOpen={defaultOpen}
              onOpenChange={setOpen}
              onOpenChangeComplete={completed}
            >
              <Menu.Trigger>Toggle</Menu.Trigger>
              <Menu.Portal keepMounted={keepMounted}>
                <Menu.Positioner>
                  <Menu.Popup
                    class="transition-state-popup"
                    render={(props: Record<string, unknown>, state: PopupState) => (
                      <TrackedPopup {...props} state={state} onState={onState} />
                    )}
                  >
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </>
        );
      }

      const { user } = await render(() => <TestMenu />);

      // The transition outlasts every phase of this test, so a busy runner cannot miss the
      // window where it still runs. Finishing it then ends the phase instead of racing it.
      async function expectCompletedAfterAnimations(popup: HTMLElement, open: boolean) {
        await waitFor(() => {
          popup.getAnimations().forEach((animation) => animation.finish());
          expect(completed).toHaveBeenCalledExactlyOnceWith(open);
        });
      }

      async function openMenu() {
        states.length = 0;
        completed.mockClear();
        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        const popup = await screen.findByRole('menu');
        await waitFor(() => expect(popup.getAnimations().length).toBeGreaterThan(0));
        expect(completed).not.toHaveBeenCalled();
        await expectCompletedAfterAnimations(popup, true);
        expect(popup.getAnimations()).toHaveLength(0);
        expect(states.filter((state) => state.open)).toEqual([
          { open: true, transitionStatus: 'starting' },
          { open: true, transitionStatus: undefined },
        ]);
      }

      async function expectInitialOpen() {
        await waitFor(() => expect(completed).toHaveBeenCalledExactlyOnceWith(true));
        expect(states).toEqual([{ open: true, transitionStatus: undefined }]);
      }

      if (defaultOpen) {
        await expectInitialOpen();
      } else {
        await openMenu();
      }

      async function closeAndReopen() {
        completed.mockClear();
        const popup = screen.getByRole('menu');
        await user.keyboard('{Escape}');
        await waitFor(() => expect(popup.getAnimations().length).toBeGreaterThan(0));
        expect(completed).not.toHaveBeenCalled();
        await expectCompletedAfterAnimations(popup, false);
        expect(popup.isConnected).toBe(keepMounted);
        await openMenu();
      }
      await closeAndReopen();
      if (defaultOpen && keepMounted) {
        // Initial-open state must not affect later opening cycles.
        await closeAndReopen();
      }

      // A reversed exit keeps the lifecycle mounted. It must not start a new entry phase
      // or report completion for the canceled close.
      completed.mockClear();
      const popup = screen.getByRole('menu');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(popup.getAnimations().length).toBeGreaterThan(0));
      expect(completed).not.toHaveBeenCalled();
      states.length = 0;
      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      // The reopen handler can run after the click resolves. Do not finish the exit first.
      await waitFor(() => expect(popup).toHaveAttribute('data-open'));
      await expectCompletedAfterAnimations(popup, true);
      expect(screen.getByRole('menu')).toBe(popup);
      expect(states.some((state) => state.transitionStatus === 'starting')).toBe(false);
      expect(popup.getAnimations()).toHaveLength(0);
    },
  );
});
