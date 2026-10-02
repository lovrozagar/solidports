import { createSignal } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
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

  const [open, setOpen] = useControlled({
    controlled: () => access(parameters.open),
    default: () => access(parameters.defaultOpen) ?? false,
    name: 'Collapsible',
    state: 'open',
  });

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open, true, true);

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
    panelId,
    setMounted,
    setOpen,
    setPanelIdState,
    transitionStatus,
  };
}

export interface UseCollapsibleRootParameters {
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
