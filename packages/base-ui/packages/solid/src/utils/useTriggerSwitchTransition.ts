import { access, createDepsRenderEffect, createLayoutEffect } from '../solid-helpers';
import type { MaybeAccessor } from '../solid-helpers';
import { useAnimationsFinished } from './useAnimationsFinished';

/**
 * Popover and Menu declare different `instantType` unions, so only the members
 * this hook touches are typed.
 */
export interface TriggerSwitchStore {
  /**
   * Read raw, because the `instantType` selector deliberately hides
   * `trigger-change` while closed — which is exactly when it has to be cleared.
   */
  readonly state: { readonly instantType: string | undefined };
  set(key: 'instantType', value: 'trigger-change' | undefined): void;
  select(key: 'open'): boolean;
}

export interface UseTriggerSwitchTransitionParameters {
  store: TriggerSwitchStore;
  /**
   * The trigger element that currently owns the popup.
   */
  domReference: MaybeAccessor<Element | null | undefined>;
  positionerElement: MaybeAccessor<HTMLElement | null | undefined>;
  open: MaybeAccessor<boolean>;
}

/**
 * Lets the positioner animate while a popup moves between detached triggers.
 *
 * The positioner is normally marked instant, so a hand-off from one trigger to
 * another would teleport. Clearing `instantType` for the duration of the move
 * lets it transition, and `trigger-change` is restored once the move finishes.
 *
 * The restoration is deferred until the move's animations finish, so it can
 * outlive the move that scheduled it. The trigger element is retained through
 * the exit transition, so a close alone does not change `domReference` and
 * nothing would otherwise re-run this effect to abort it — a popup that closes
 * and reopens on the same trigger mid-exit would inherit the stale callback and
 * lose its own transition. Closing therefore cancels the pending restoration
 * explicitly.
 */
export function useTriggerSwitchTransition(parameters: UseTriggerSwitchTransitionParameters): void {
  let previousTrigger: Element | null = null;
  let pendingSwitch: AbortController | null = null;
  const runOnceAnimationsFinish = useAnimationsFinished(parameters.positionerElement);

  createDepsRenderEffect(
    () => access(parameters.open),
    (open) => {
      if (open) {
        return;
      }

      pendingSwitch?.abort();
      pendingSwitch = null;

      // `trigger-change` belongs to the open cycle that scheduled it. The selector
      // stops a closed popup from rendering it, but the value has to be dropped
      // too: a controlled reopen changes only `open`, so neither this effect
      // nor `setOpen` would run again to replace it.
      if (parameters.store.state.instantType === 'trigger-change') {
        parameters.store.set('instantType', undefined);
      }
    },
  );

  // Compare the element with `Object.is`. A shallow compare treats distinct elements with no
  // enumerable keys as equal, so a move between triggers would never run.
  createLayoutEffect(
    () => access(parameters.domReference) ?? null,
    (currentTrigger) => {
      const previous = previousTrigger;

      if (currentTrigger) {
        previousTrigger = currentTrigger;
      }

      if (!previous || !currentTrigger || currentTrigger === previous) {
        return;
      }

      // The trigger element can also change while the popup is closing, when a
      // trigger is replaced by a new element. There is no move to animate, and
      // the cancellation effect above has already run for this commit, so a
      // restoration scheduled here would survive into whatever opens next.
      if (!parameters.store.select('open')) {
        return;
      }

      parameters.store.set('instantType', undefined);

      const abortController = new AbortController();
      pendingSwitch = abortController;

      runOnceAnimationsFinish(() => {
        // The abort above covers a committed close, but the animations can finish
        // in the same frame the close commits. Writing `trigger-change` then would
        // leave stale state behind for the next open to inherit.
        if (parameters.store.select('open')) {
          parameters.store.set('instantType', 'trigger-change');
        }
      }, abortController.signal);

      return () => {
        abortController.abort();
      };
    },
  );
}
