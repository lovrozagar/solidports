import { createSignal, getOwner, runWithOwner, untrack } from 'solid-js';
import type { Accessor, Owner, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { access, type MaybeAccessor } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useControlled } from '../../utils/useControlled';
import { TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import type { CollapsibleRoot } from './CollapsibleRoot';

export function useCollapsibleRoot(
  parameters: UseCollapsibleRootParameters,
): UseCollapsibleRootReturnValue {
  const disabled = () => Boolean(access(parameters.disabled));

  // A root whose `open` is always supplied (an Accordion item) reads it directly: `useControlled`
  // would add a memo per item and its uncontrolled branch could never run.
  const [open, setOpen] = parameters.alwaysControlled
    ? [() => Boolean(access(parameters.open)), noop]
    : useControlled({
        controlled: () => access(parameters.open),
        default: () => access(parameters.defaultOpen) ?? false,
        name: 'Collapsible',
        state: 'open',
      });

  // A root that starts closed has no transition until it first opens: its status machinery (two
  // computed signals) is created then, owned by the root, and reads before that return the closed
  // values (`mounted` false, status `undefined`). Every reader also reads `open`, so it re-runs on
  // the first open and creates the machinery; `animateInitialOpen` makes that open enter
  // `'starting'`, as an eagerly created instance does when it goes from closed to open.
  const owner = getOwner();
  let transition: ReturnType<typeof useTransitionStatus> | undefined;
  const createTransition = () =>
    (transition ??= runWithOwner(owner, () =>
      untrack(() => useTransitionStatus(open, true, true, true)),
    )!);
  if (untrack(open)) {
    transition = useTransitionStatus(open, true, true);
  }
  const ensureTransition = () => {
    if (transition === undefined && open()) {
      createTransition();
    }
    return transition;
  };
  const mounted = () => ensureTransition()?.mounted() ?? false;
  const transitionStatus = () => ensureTransition()?.transitionStatus();
  const setMounted = (nextMounted: boolean) => {
    if (transition === undefined) {
      if (!nextMounted) {
        return;
      }
      createTransition();
    }
    transition!.setMounted(nextMounted);
  };

  const defaultPanelId = useBaseUiId();
  // `undefined` uses the initial generated fallback; `null` means the panel unmounted.
  // Solid: the panel clears its registration from an unmount cleanup, so the signal allows owned writes.
  const [registeredPanelId, setPanelIdState] = createSignal<string | null | undefined>(undefined, {
    ownedWrite: true,
  });
  const panelId = () => {
    const registered = registeredPanelId();
    return registered === null ? undefined : (registered ?? defaultPanelId());
  };

  function handleTrigger(event: MouseEvent | KeyboardEvent) {
    const nextOpen = !open();
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    parameters.onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpen(nextOpen);
  }

  return {
    defaultPanelId,
    disabled,
    handleTrigger,
    mounted,
    open,
    owner,
    panelId,
    setMounted,
    setOpen,
    setPanelIdState,
    transitionStatus,
  };
}

function noop() {}

export interface UseCollapsibleRootParameters {
  /**
   * Solid: `open` is always a defined accessor (the root never switches mode), so the value is
   * read directly and `setOpen` is a no-op, as `useControlled`'s controlled mode behaves.
   */
  alwaysControlled?: boolean | undefined;
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: MaybeAccessor<boolean | undefined>;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: MaybeAccessor<boolean | undefined>;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled: MaybeAccessor<boolean>;
}

export interface UseCollapsibleRootReturnValue {
  defaultPanelId: Accessor<JSX.HTMLAttributes<Element>['id']>;
  /** Solid: the root's owner (a part skips its unmount registration write while the root is disposed). */
  owner: Owner | null;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Accessor<boolean>;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  panelId: Accessor<JSX.HTMLAttributes<Element>['id']>;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (open: boolean) => void;
  setPanelIdState: Setter<string | null | undefined>;
  transitionStatus: Accessor<TransitionStatus>;
}

export interface UseCollapsibleRootState {}

export namespace useCollapsibleRoot {
  export type Parameters = UseCollapsibleRootParameters;
  export type ReturnValue = UseCollapsibleRootReturnValue;
}
