import { getOwner, untrack } from 'solid-js';
import type { Owner } from 'solid-js';
import { isServer } from '@solidjs/web';
import { runInLazyScope } from './runInLazyScope';
import { useOpenChangeComplete } from './useOpenChangeComplete';
import { useTransitionStatus } from './useTransitionStatus';
import type { TransitionStatus } from './useTransitionStatus';

/** A part's transition status, read as `useTransitionStatus` returns it. */
export interface LazyTransitionStatus {
  mounted(): boolean;
  transitionStatus(): TransitionStatus;
  setMounted(mounted: boolean): void;
}

/** The lazy handle: the status, plus `mounted` for a reader that has already read `open`. */
export interface LazyTransitionHandle extends LazyTransitionStatus {
  /**
   * `mounted` for a reader that has read `open` and seen it closed: before the machinery exists
   * the element is unmounted, and the reader's own read of `open` re-runs it on the open that
   * creates it, so `open` is not read a second time.
   */
  mountedWhileClosed(): boolean;
}

export interface LazyTransitionStatusOptions {
  enableIdleState?: boolean | undefined;
  deferEndingState?: boolean | undefined;
  /**
   * Unmounts once the close animation on `ref` completes (`useOpenChangeComplete`), as an
   * indicator does when it is unchecked.
   */
  closeComplete?:
    { ref: () => HTMLElement | null | undefined; batch?: boolean | undefined } | undefined;
  /**
   * Whether a part that mounts already open still plays its enter transition
   * (`useTransitionStatus`'s `animateInitialOpen`). A part created on its first open always does.
   */
  animateInitialOpen?: (() => boolean) | undefined;
  /**
   * Creates the rest of a part's open-state machinery beside the status, in the same lazy scope,
   * once the status exists (client only): a popup's unmount-after-close effects.
   */
  onCreate?: ((status: LazyTransitionStatus) => void) | undefined;
}

const NO_OPTIONS: LazyTransitionStatusOptions = {};

/**
 * `createLazyTransitionStatus`'s handle. Solid: the methods are on the prototype and the inputs are
 * fields, so a part that never opens holds one object and no closure.
 */
class LazyTransition implements LazyTransitionHandle {
  declare private readonly open: () => boolean;
  declare private readonly options: LazyTransitionStatusOptions;
  declare private readonly owner: Owner | null;
  /** The status once created; reads go straight to it from then on. */
  declare private transition: LazyTransitionStatus | undefined;

  constructor(open: () => boolean, options: LazyTransitionStatusOptions) {
    this.open = open;
    this.options = options;
    this.owner = getOwner();
    this.transition = undefined;
    if (untrack(open)) {
      this.create(Boolean(options.animateInitialOpen && untrack(options.animateInitialOpen)));
    }
  }

  mounted(): boolean {
    return this.ensure()?.mounted() ?? false;
  }

  mountedWhileClosed(): boolean {
    return this.transition?.mounted() ?? false;
  }

  transitionStatus(): TransitionStatus {
    return this.ensure()?.transitionStatus();
  }

  setMounted(mounted: boolean) {
    let transition = this.transition;
    if (transition === undefined) {
      if (!mounted) {
        return;
      }
      transition = this.create(true);
    }
    transition.setMounted(mounted);
  }

  private ensure(): LazyTransitionStatus | undefined {
    const transition = this.transition;
    if (transition !== undefined) {
      return transition;
    }
    return this.open() ? this.create(true) : undefined;
  }

  private create(animateInitialOpen: boolean): LazyTransitionStatus {
    const open = this.open;
    const options = this.options;
    if (isServer) {
      // `useTransitionStatus`'s initial status: the server renders once, so it stays.
      let initial: TransitionStatus;
      if (untrack(open) && animateInitialOpen) {
        initial = 'starting';
      } else if (untrack(open) && options.enableIdleState) {
        initial = 'idle';
      }
      this.transition = {
        mounted: open,
        transitionStatus: () => initial,
        setMounted() {},
      };
      return this.transition;
    }
    this.transition = runInLazyScope(this.owner, () =>
      untrack(() => {
        const status = useTransitionStatus(
          open,
          options.enableIdleState ?? false,
          options.deferEndingState ?? false,
          animateInitialOpen,
        );
        const closeComplete = options.closeComplete;
        if (closeComplete) {
          useOpenChangeComplete({
            batch: closeComplete.batch ?? false,
            enabled: () => !open(),
            open,
            ref: closeComplete.ref,
            onComplete() {
              if (!open()) {
                status.setMounted(false);
              }
            },
          });
        }
        const created: LazyTransitionStatus = {
          mounted: status.mounted,
          transitionStatus: status.transitionStatus,
          setMounted: (mounted: boolean) => {
            status.setMounted(mounted);
          },
        };
        options.onCreate?.(created);
        return created;
      }),
    )!;
    return this.transition;
  }
}

/**
 * `useTransitionStatus` for a part that starts closed and may never open (a closed collapsible, an
 * unchecked indicator): its machinery (two writable memos, and the close-complete effect) is
 * created the first time `open` reads true, and reads before that return the closed values
 * (`mounted` false, status `undefined`). Every reader also reads `open`, so it re-runs on the first
 * open and creates the machinery; that open enters `'starting'`, as an instance created at mount
 * does when it goes from closed to open. A part that starts open creates it at once.
 *
 * The machinery lives in a lazy scope of the caller's owner (`runInLazyScope`): it takes no slot of
 * the owner, so hydration ids stay aligned, and no element is claimed inside it. On the server the
 * part renders once, so its status is the initial one, with nothing to schedule, and it creates no
 * reactive node there (D9).
 */
export function createLazyTransitionStatus(
  open: () => boolean,
  options: LazyTransitionStatusOptions = NO_OPTIONS,
): LazyTransitionHandle {
  return new LazyTransition(open, options);
}
