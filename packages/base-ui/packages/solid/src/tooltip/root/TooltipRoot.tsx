import { onSettled, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '../../utils/empty';
import { useClientPoint, useDismiss } from '../../floating-ui-solid';
import {
  ComponentWithPayload,
  createDepsRenderEffect,
  type ReactLikeRef,
} from '../../solid-helpers';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import {
  PopupHandleAttachment,
  useImplicitActiveTrigger,
  usePopupRootStore,
  useOpenStateTransitions,
  usePopupInteractionProps,
  type PayloadChildRenderFunction,
} from '../../utils/popups';
import { mergeProps } from '../../merge-props';
import { TooltipStore, type State as TooltipStoreState } from '../store/TooltipStore';
import { type TooltipHandle } from '../store/TooltipHandle';
import { REASONS } from '../../utils/reasons';
import { TooltipRootContext } from './TooltipRootContext';

/**
 * Groups all parts of the tooltip.
 * Doesn’t render its own HTML element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipRoot<Payload>(props: TooltipRoot.Props<Payload>) {
  const disabled = () => props.disabled ?? false;
  const defaultOpen = () => props.defaultOpen ?? false;
  const openProp = () => props.open;
  const disableHoverablePopup = () => props.disableHoverablePopup ?? false;
  const trackCursorAxis = () => props.trackCursorAxis ?? 'none';
  const triggerIdProp = () => props.triggerId;
  const defaultTriggerIdProp = () => props.defaultTriggerId ?? null;

  const store = usePopupRootStore((floatingId, nested) =>
    TooltipStore<Payload>(
      {
        get open() {
          return defaultOpen();
        },
        get openProp() {
          return openProp();
        },
        get activeTriggerId() {
          return defaultTriggerIdProp();
        },
        get triggerIdProp() {
          return triggerIdProp();
        },
      },
      floatingId,
      nested,
    ),
  );

  store.useControlledProp('openProp', openProp);
  store.useControlledProp('triggerIdProp', triggerIdProp);

  // Solid: the callbacks read the latest props when invoked.
  store.useContextCallback(
    'onOpenChange',
    (nextOpen: boolean, eventDetails: TooltipRoot.ChangeEventDetails) =>
      untrack(() => props.onOpenChange)?.(nextOpen, eventDetails),
  );
  store.useContextCallback('onOpenChangeComplete', (nextOpen: boolean) =>
    untrack(() => props.onOpenChangeComplete)?.(nextOpen),
  );

  const openState = store.useState('open');
  const open = () => !disabled() && openState();

  const activeTriggerId = store.useState('activeTriggerId');
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as Accessor<Payload | undefined>;

  store.useSyncedValues({
    trackCursorAxis,
    disableHoverablePopup,
    disabled,
  });

  useImplicitActiveTrigger(store, { closeOnActiveTriggerUnmount: true });
  const { forceUnmount, transitionStatus } = useOpenStateTransitions(open, store);
  const isInstantPhase = store.useState('isInstantPhase');
  const instantType = store.useState('instantType');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');

  // Animations should be instant in two cases:
  // 1) Opening during the provider's instant phase (adjacent tooltip opens instantly)
  // 2) Closing because another tooltip opened (reason === 'none')
  // Otherwise, allow the animation to play. In particular, do not disable animations
  // during the 'ending' phase unless it's due to a sibling opening.
  let previousInstantTypeRef: TooltipStoreState<Payload>['instantType'] | null = null;

  createDepsRenderEffect(
    () => ({ openState: openState(), disabled: disabled() }),
    (deps) => {
      if (deps.openState && deps.disabled) {
        store.setOpen(false, createChangeEventDetails(REASONS.disabled));
      }
    },
  );

  createDepsRenderEffect(
    () => ({
      transitionStatus: transitionStatus(),
      isInstantPhase: isInstantPhase(),
      lastOpenChangeReason: lastOpenChangeReason(),
      instantType: instantType(),
    }),
    (deps) => {
      if (
        (deps.transitionStatus === 'ending' && deps.lastOpenChangeReason === REASONS.none) ||
        (deps.transitionStatus !== 'ending' && deps.isInstantPhase)
      ) {
        // Capture the current instant type so we can restore it later
        // and set to 'delay' to disable animations while moving from one trigger to another
        // within a delay group.
        if (deps.instantType !== 'delay') {
          previousInstantTypeRef = deps.instantType;
        }
        store.set('instantType', 'delay');
      } else if (previousInstantTypeRef !== null) {
        store.set('instantType', previousInstantTypeRef);
        previousInstantTypeRef = null;
      }
    },
  );

  createDepsRenderEffect(
    () => ({ activeTriggerId: activeTriggerId(), open: open() }),
    (deps) => {
      if (deps.open) {
        if (deps.activeTriggerId == null) {
          store.set('payload', undefined);
        }
      }
    },
  );

  // React's `useImperativeHandle`.
  onSettled(() => {
    if (props.actionsRef) {
      props.actionsRef.current = {
        unmount: forceUnmount,
        close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
      };
    }
  });

  const shouldRenderInteractions = () =>
    open() || mounted() || (!disabled() && trackCursorAxis() !== 'none');

  return (
    <TooltipRootContext value={{ store } as TooltipRootContext}>
      <Show when={props.handle}>
        {(handle) => <PopupHandleAttachment handle={handle()} store={store} />}
      </Show>
      <Show when={shouldRenderInteractions()}>
        <TooltipInteractions
          store={store}
          disabled={disabled()}
          trackCursorAxis={trackCursorAxis()}
        />
      </Show>
      <ComponentWithPayload payload={payload} children={props.children} />
    </TooltipRootContext>
  );
}

export interface TooltipRootState {}

export interface TooltipRootProps<Payload = unknown> {
  /**
   * Whether the tooltip is initially open.
   *
   * To render a controlled tooltip, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the tooltip is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the tooltip is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: TooltipRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the tooltip is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the tooltip contents can be hovered without closing the tooltip.
   * @default false
   */
  disableHoverablePopup?: boolean | undefined;
  /**
   * Determines which axis the tooltip should track the cursor on.
   * @default 'none'
   */
  trackCursorAxis?: 'none' | 'x' | 'y' | 'both' | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Unmounts the tooltip popup.
   * - `close`: Closes the tooltip imperatively when called.
   */
  actionsRef?: ReactLikeRef<TooltipRoot.Actions | null> | undefined;
  /**
   * Whether the tooltip is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the tooltip with a trigger.
   * If specified, allows external triggers to control the tooltip's open state.
   * Can be created with the Tooltip.createHandle() method.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * The content of the tooltip.
   * This can be a regular React node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled tooltip.
   * There's no need to specify this prop when the tooltip is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open tooltip.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface TooltipRootActions {
  unmount: () => void;
  close: () => void;
}

export type TooltipRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.disabled
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type TooltipRootChangeEventDetails =
  BaseUIChangeEventDetails<TooltipRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export namespace TooltipRoot {
  export type State = TooltipRootState;
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type Actions = TooltipRootActions;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}

function TooltipInteractions<Payload>(props: {
  store: TooltipStore<Payload>;
  disabled: boolean;
  trackCursorAxis: 'none' | 'x' | 'y' | 'both';
}) {
  const dismiss = useDismiss({
    get context() {
      return props.store.context.floatingRootContext;
    },
    props: {
      get enabled() {
        return !props.disabled;
      },
      referencePress: () => props.store.select('closeOnClick'),
    },
  });
  const clientPoint = useClientPoint({
    get context() {
      return props.store.context.floatingRootContext;
    },
    props: {
      get enabled() {
        return !props.disabled && props.trackCursorAxis !== 'none';
      },
      get axis() {
        return props.trackCursorAxis === 'none' ? undefined : props.trackCursorAxis;
      },
    },
  });

  // Both hooks return `trigger: reference` (same object identity), so the active and
  // inactive trigger props can never differ. `useClientPoint` has no floating-side props.
  const triggerProps = () => mergeProps(clientPoint.reference, dismiss.reference);
  usePopupInteractionProps(props.store, {
    get activeTriggerProps() {
      return triggerProps();
    },
    get inactiveTriggerProps() {
      return triggerProps();
    },
    get popupProps() {
      return dismiss.floating ?? EMPTY_OBJECT;
    },
  });

  return null;
}
