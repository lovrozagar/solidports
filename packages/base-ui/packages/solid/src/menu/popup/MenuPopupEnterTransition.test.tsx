import { act, createRenderer, isJSDOM } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, Show } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { AnimationFrame } from '../../utils/useAnimationFrame';

const activeTrackers: Array<{ stop(): void }> = [];
const activeTimeouts: Array<ReturnType<typeof setTimeout>> = [];

/**
 * Records whether `selector` ever matches an element. Polls per frame because the tracked
 * attributes may be present for only a single frame. Uses the managed `AnimationFrame` scheduler
 * so the loop cannot outlive its test: `stop()` cancels the pending frame, and every tracker is
 * also stopped in `afterEach` in case a test fails before reaching `stop()`.
 */
function trackSelector(selector: string) {
  let seen = false;
  let frame: ReturnType<typeof AnimationFrame.request>;

  function sample() {
    if (document.querySelector(selector)) {
      seen = true;
    }
    frame = AnimationFrame.request(sample);
  }
  frame = AnimationFrame.request(sample);

  const tracker = {
    seen: () => seen,
    stop() {
      AnimationFrame.cancel(frame);
    },
  };
  activeTrackers.push(tracker);
  return tracker;
}

/**
 * Records whether an element ever carries `[data-starting-style]`, which is what drives the enter
 * transition.
 */
function trackStartingStyle(testId: string) {
  return trackSelector(`[data-testid="${testId}"][data-starting-style]`);
}

/**
 * Waits on a tracked timeout, so an interrupted test cannot leak a pending callback into a later
 * one — every timeout is cleared in `afterEach`. Wrapped in `act` so pending transition-status
 * updates (e.g. the frame that clears `'starting'`) are applied.
 * Solid: a tracked `setTimeout` stands in for React's managed `Timeout` instance.
 */
async function waitMs(ms: number) {
  await act(async () => {
    await new Promise<void>((resolve) => {
      activeTimeouts.push(setTimeout(resolve, ms));
    });
  });
}

function SubmenuTree(props: {
  submenuOpen?: boolean;
  submenuDefaultOpen?: boolean;
  menuDefaultOpen?: boolean;
  keepMounted?: boolean;
  showSubmenuPopup?: boolean;
  withItem?: boolean;
}) {
  return (
    <Menu.Root defaultOpen={props.menuDefaultOpen}>
      <Menu.Trigger>Trigger</Menu.Trigger>
      <Menu.Portal keepMounted={props.keepMounted}>
        <Menu.Positioner>
          <Menu.Popup data-testid="menu-popup">
            <Show when={props.withItem ?? true}>
              <Menu.Item>Item</Menu.Item>
            </Show>
            <Menu.SubmenuRoot open={props.submenuOpen} defaultOpen={props.submenuDefaultOpen}>
              <Menu.SubmenuTrigger>Submenu</Menu.SubmenuTrigger>
              <Show when={props.showSubmenuPopup ?? true}>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu-popup">
                      <Menu.Item>Sub item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Show>
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

async function openWithKeyboard() {
  const trigger = screen.getByRole('button', { name: 'Trigger' });
  await act(async () => {
    trigger.focus();
  });
  await userEvent.keyboard('[Enter]');
}

describe.skipIf(isJSDOM)('Menu enter transition', () => {
  const { render } = createRenderer();

  afterEach(() => {
    activeTrackers.splice(0).forEach((tracker) => tracker.stop());
    activeTimeouts.splice(0).forEach((timeout) => clearTimeout(timeout));
  });

  it('plays the enter transition for a submenu that is open when its parent opens', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuTree submenuDefaultOpen />);

    await userEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('plays the enter transition for a controlled-open submenu when its parent opens', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuTree submenuOpen />);

    await userEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('does not play the enter transition for a menu that is open on the first render', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const menuTracker = trackStartingStyle('menu-popup');

    render(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Trigger</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="menu-popup">
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    await waitFor(() => {
      expect(screen.queryByTestId('menu-popup')).not.toBe(null);
    });

    await waitMs(100);

    expect(menuTracker.seen()).toBe(false);
  });

  it('does not play the enter transition for a submenu inside a menu that is open on the first render', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const menuTracker = trackStartingStyle('menu-popup');
    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuTree menuDefaultOpen submenuDefaultOpen />);

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });

    await waitMs(100);

    expect(menuTracker.seen()).toBe(false);
    expect(submenuTracker.seen()).toBe(false);
  });

  it('does not play the enter transition for a submenu when the parent popup is kept mounted', async () => {
    // Known limitation: with a `keepMounted` parent the submenu subtree exists from page load, so
    // its mount cannot be tied to the parent's reveal and the submenu appears without a
    // transition when the parent opens. This test pins the current behavior; a fix needs a
    // visibility-based signal in the shared transition machinery.
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuTree keepMounted submenuDefaultOpen />);

    await userEvent.click(screen.getByRole('button', { name: 'Trigger' }));

    await waitFor(() => {
      expect(screen.getByTestId('menu-popup')).toBeVisible();
    });

    await waitMs(100);

    expect(submenuTracker.seen()).toBe(false);
  });

  it('plays the enter transition for a submenu opened by the user', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuTree menuDefaultOpen withItem={false} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Submenu' }));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('plays the enter transition for a submenu whose parent opened instantly', async () => {
    // `data-instant` is a styling hint: suppressing the enter transition is the consumer's
    // choice, not the framework's. A consumer without `[data-instant]` CSS gets the parent's
    // enter transition on a keyboard open, so the submenu must go through `'starting'` alongside
    // it — skipping the phase would re-create the detached-panel artifact for keyboard users.
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const submenuTracker = trackStartingStyle('submenu-popup');

    render(() => <SubmenuTree submenuDefaultOpen />);

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(submenuTracker.seen()).toBe(true);
    });
  });

  it('marks an initially open submenu as instant when its parent opened instantly', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const submenuInstantTracker = trackSelector(
      '[data-testid="submenu-popup"][data-instant="click"]',
    );

    render(() => <SubmenuTree submenuDefaultOpen />);

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
    // The submenu carries the inherited value during its enter frames only: it is cleared once
    // the initial reveal settles, so it cannot suppress later transitions.
    await waitFor(() => {
      expect(submenuInstantTracker.seen()).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });
  });

  it('clears the inherited instant type after the initial open', async () => {
    // The inherited `instantType` must not outlive the initial reveal: controlled `open` flips
    // bypass `setOpen`, so a value that stuck around would render `[data-instant]` on every
    // subsequent open and suppress transitions that should play.
    const [submenuOpen, setSubmenuOpen] = createSignal(true);

    render(() => <SubmenuTree submenuOpen={submenuOpen()} />);

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    await waitFor(() => {
      expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
    });

    await act(() => setSubmenuOpen(false));
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    await act(() => setSubmenuOpen(true));
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('clears the inherited instant type when a controlled close interrupts the entry', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    // The transition keeps the animations-finished cleanup pending long enough for the controlled
    // close to interrupt it; there is no ending style, so closing unmounts without delay.
    const [submenuOpen, setSubmenuOpen] = createSignal(true);

    render(() => (
      <>
        <style>{`
          [data-testid='submenu-popup'] {
            opacity: 1;
            transition: opacity 300ms linear;
          }
          [data-testid='submenu-popup'][data-starting-style] {
            opacity: 0;
          }
        `}</style>
        <SubmenuTree submenuOpen={submenuOpen()} />
      </>
    ));

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });

    // Close before the 300ms enter transition finishes, then reopen.
    await act(() => setSubmenuOpen(false));
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    await act(() => setSubmenuOpen(true));
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('clears the inherited instant type when the popup is not initially rendered', async () => {
    // With the popup subtree omitted at mount (e.g. suspended or waiting on data), there is no
    // element for the animations-finished callback to watch, and a ref assignment alone never
    // reruns the clearing effect. The seed must still be cleared, so a popup rendered after the
    // reveal settles does not carry a stale `[data-instant]`.
    const [showPopup, setShowPopup] = createSignal(false);

    render(() => <SubmenuTree submenuDefaultOpen showSubmenuPopup={showPopup()} />);

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');
    });
    // Give the reveal time to settle while the submenu popup is absent.
    await waitMs(100);

    await act(() => setShowPopup(true));
    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });

  it('does not mark a closed submenu as instant when it is later opened programmatically', async () => {
    // A submenu that mounts closed during the parent's enter transition must not inherit the
    // parent's `instantType`: a later programmatic open (controlled `open` flip) does not go
    // through `setOpen`, so a seeded value would never be cleared. `defaultOpen` is set alongside
    // the controlled prop to pin that the gate resolves the effective open state — the controlled
    // `open={false}` must win over `defaultOpen`.
    const [submenuOpen, setSubmenuOpen] = createSignal(false);

    render(() => <SubmenuTree submenuOpen={submenuOpen()} submenuDefaultOpen />);

    await openWithKeyboard();

    await waitFor(() => {
      expect(screen.queryByTestId('menu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('menu-popup')).toHaveAttribute('data-instant', 'click');

    await act(() => setSubmenuOpen(true));

    await waitFor(() => {
      expect(screen.queryByTestId('submenu-popup')).not.toBe(null);
    });
    expect(screen.getByTestId('submenu-popup')).not.toHaveAttribute('data-instant');
  });
});
