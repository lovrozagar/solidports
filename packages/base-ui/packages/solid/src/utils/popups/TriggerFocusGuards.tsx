import { Show, onCleanup } from 'solid-js';
import { createLayoutEffect } from '../../solid-helpers';
import type { JSX } from '@solidjs/web';
import type { ReactLikeRef } from '../../solid-helpers';
import { FocusGuard, useSafariGuardRole } from '../FocusGuard';
import { visuallyHidden } from '../visuallyHidden';

/**
 * The focus guards around a popup trigger, which React renders as keyed siblings of the trigger.
 *
 * Solid-only: when nodes are inserted before the trigger while the node after it also changes,
 * Solid's list diff replaces the trigger and re-inserts it, which blurs a focused trigger. Opening a
 * popup inserts its portal's inline guards (siblings before a detached trigger), so the trailing
 * guard keeps its place as an inert span while inactive: the trigger and its trailing slot then
 * always match as the list's unchanged end, and every other change is a plain insertion.
 */
export function TriggerFocusGuards(props: {
  active: boolean;
  leadingGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
  onLeadingFocus: (event: FocusEvent) => void;
  trailingGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
  onTrailingFocus: (event: FocusEvent) => void;
  children: JSX.Element;
}) {
  let trailingGuard: HTMLElement | null = null;
  const role = useSafariGuardRole();
  // The ref holds the guard only while it is active; handlers fall back to the trigger otherwise,
  // as when React unmounts the guard.
  const syncTrailingGuardRef = (active: boolean) => {
    if (active) {
      props.trailingGuardRef.current = trailingGuard;
    } else if (props.trailingGuardRef.current === trailingGuard) {
      props.trailingGuardRef.current = null;
    }
  };
  createLayoutEffect(() => props.active, syncTrailingGuardRef);
  onCleanup(() => syncTrailingGuardRef(false));

  return (
    <>
      <Show when={props.active}>
        <TriggerFocusGuard guardRef={props.leadingGuardRef} onFocus={props.onLeadingFocus} />
      </Show>
      {props.children}
      {/* A plain span (the `FocusGuard` markup) rather than the generic component: one sits after
          every closed trigger, so it carries no props spread. */}
      <span
        ref={(el) => {
          trailingGuard = el;
        }}
        role={props.active ? role() : undefined}
        aria-hidden={props.active && role() ? undefined : 'true'}
        style={visuallyHidden}
        tabindex={props.active ? 0 : undefined}
        data-base-ui-focus-guard={props.active ? '' : undefined}
        onFocus={(event) => {
          if (props.active) {
            props.onTrailingFocus(event);
          }
        }}
      />
    </>
  );
}

/**
 * A focus guard that clears its ref on unmount, as React does: Solid never calls refs with `null`,
 * and the focus guard handlers fall back to the trigger once the guard is gone.
 */
function TriggerFocusGuard(props: {
  guardRef: ReactLikeRef<HTMLElement | null | undefined>;
  onFocus: (event: FocusEvent) => void;
}) {
  let guard: HTMLElement | null = null;
  onCleanup(() => {
    if (props.guardRef.current === guard) {
      props.guardRef.current = null;
    }
  });

  return (
    <FocusGuard
      ref={(el) => {
        guard = el;
        props.guardRef.current = el;
      }}
      onFocus={props.onFocus}
    />
  );
}
