import { untrack } from 'solid-js';
import { access, createLayoutEffect } from '../solid-helpers';
import type { MaybeAccessor } from '../solid-helpers';
import { useOpenChangeComplete } from './useOpenChangeComplete';
import { createLazyTransitionStatus } from './createLazyTransitionStatus';

export interface UseUnmountAfterCloseParameters {
  /**
   * Whether the popup is open.
   */
  open: MaybeAccessor<boolean>;
  /**
   * Element whose closing animations are awaited before unmounting.
   */
  ref: MaybeAccessor<HTMLElement | null | undefined>;
  /**
   * Whether the current close cycle asked to keep the popup mounted until `forceUnmount`.
   * Ignored while `open`.
   */
  preventUnmountOnClose: MaybeAccessor<boolean>;
  /**
   * Writes `preventUnmountOnClose`. Opening starts a new close cycle, so the hook clears it
   * whenever `open` becomes `true`.
   */
  setPreventUnmountOnClose: (preventUnmountOnClose: boolean) => void;
  /**
   * Runs once per unmount, whether it completed automatically or through `forceUnmount`.
   */
  onUnmount: () => void;
  /**
   * Whether a popup that mounts already open should still play its enter transition.
   */
  animateInitialOpen?: MaybeAccessor<boolean | undefined> | undefined;
}

/**
 * Keeps a popup mounted through its closing animation and unmounts it once the animation
 * finishes, unless the close cycle opted out through `preventUnmountOnClose`.
 *
 * `forceUnmount` is a no-op once the popup is already unmounted. A call while the popup is open
 * only takes effect if a close commits before the next microtask, so `close(); unmount()` in one
 * handler unmounts, and a stale exit callback after a reopen does not.
 */
export function useUnmountAfterClose(parameters: UseUnmountAfterCloseParameters) {
  const open = () => Boolean(access(parameters.open));

  // Opening starts a new close cycle. Derive it so the close-completion hook reads the value on
  // the same pass, and clear the stored value so it doesn't leak into the next close.
  const preventUnmountingOnClose = () =>
    open() ? false : Boolean(access(parameters.preventUnmountOnClose));

  let mountedNow = false;
  let pendingUnmount = false;
  let wasOpen: boolean | undefined;

  // A popup that never opens has nothing to animate or unmount: its status and the effects below
  // are created on the first open a reader of `mounted` or `transitionStatus` sees
  // (`createLazyTransitionStatus`, as indicators and collapsibles do), or at once when it mounts
  // open. Before that, `mounted` is false and `forceUnmount` does nothing.
  const status = createLazyTransitionStatus(open, {
    animateInitialOpen: () => Boolean(access(parameters.animateInitialOpen)),
    onCreate(created) {
      mountedNow = untrack(created.mounted);

      // Solid: one effect replaces React's `[open]` effect and its every-commit `mounted` mirror.
      createLayoutEffect(
        () => ({ mounted: created.mounted(), open: open() }),
        (state) => {
          // Only a change to `open` clears the opt-out, so one recorded while a controlled close is
          // still pending survives.
          if (state.open && wasOpen !== true) {
            parameters.setPreventUnmountOnClose(false);
          }
          wasOpen = state.open;
          mountedNow = state.mounted;
          if (pendingUnmount) {
            pendingUnmount = false;
            if (!state.open && state.mounted) {
              unmount();
            }
          }
        },
      );

      useOpenChangeComplete({
        enabled: () => created.mounted() && !open() && !preventUnmountingOnClose(),
        open,
        ref: () => access(parameters.ref) ?? null,
        onComplete() {
          if (!untrack(open)) {
            forceUnmount();
          }
        },
      });
    },
  });

  function unmount() {
    mountedNow = false;
    status.setMounted(false);
    // A callback: it may also run from the effect above, where its reads must not subscribe.
    untrack(parameters.onUnmount);
  }

  function forceUnmount() {
    if (!mountedNow) {
      return;
    }
    if (untrack(open)) {
      pendingUnmount = true;
      queueMicrotask(() => {
        if (!pendingUnmount) {
          return;
        }
        pendingUnmount = false;
        if (!untrack(open) && mountedNow) {
          unmount();
        }
      });
      return;
    }
    unmount();
  }

  // The handle's methods read `this`: its consumers call these unbound.
  return {
    mounted: () => status.mounted(),
    transitionStatus: () => status.transitionStatus(),
    preventUnmountingOnClose,
    forceUnmount,
  };
}
