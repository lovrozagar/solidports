import { createEffect, onSettled, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingTree, useDismiss } from '../../floating-ui-solid';
import {
  ComponentWithPayload,
  createDepsRenderEffect,
  type ReactLikeRef,
} from '../../solid-helpers';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import {
  useImplicitActiveTrigger,
  usePopupRootStore,
  useOpenStateTransitions,
  usePopupInteractionProps,
  usePopupRootSync,
  type PayloadChildRenderFunction,
} from '../../utils/popups';
import { PopoverHandle } from '../store/PopoverHandle';
import { PopoverStore, type State as PopoverStoreState } from '../store/PopoverStore';
import { PopoverRootContext, usePopoverRootContext } from './PopoverRootContext';

function PopoverRootComponent<Payload>(
  props: PopoverRoot.Props<Payload> & { nestedInPopoverRoot: boolean },
) {
  const openProp = () => props.open;
  const defaultOpen = () => props.defaultOpen ?? false;
  const modal = () => props.modal ?? false;
  const triggerIdProp = () => props.triggerId;
  const defaultTriggerIdProp = () => props.defaultTriggerId ?? null;

  const store = usePopoverRootStore<Payload>({
    get modal() {
      return modal();
    },
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
  });

  store.useControlledProp('openProp', openProp);
  store.useControlledProp('triggerIdProp', triggerIdProp);

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as Accessor<Payload | undefined>;

  // Solid: the callbacks read the latest props when invoked.
  store.useContextCallback(
    'onOpenChange',
    (nextOpen: boolean, eventDetails: PopoverRoot.ChangeEventDetails) =>
      untrack(() => props.onOpenChange)?.(nextOpen, eventDetails),
  );
  store.useContextCallback('onOpenChangeComplete', (nextOpen: boolean) =>
    untrack(() => props.onOpenChangeComplete)?.(nextOpen),
  );

  usePopupRootSync(store, open);
  useImplicitActiveTrigger(store);
  const { forceUnmount } = useOpenStateTransitions(open, store, () => {
    store.update({ stickIfOpen: true, openChangeReason: null });
  });

  store.useSyncedValues({
    modal,
  });

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      store.context.stickIfOpenTimeout.clear();
    }
  });

  // React's `useImperativeHandle`.
  onSettled(() => {
    if (props.actionsRef) {
      props.actionsRef.current = {
        unmount: forceUnmount,
        close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
      };
    }
  });

  const shouldRenderInteractions = () => open() || mounted();

  // Solid: React renders `<PopupHandleAttachment>` as the first child so its layout effect attaches
  // the store before later siblings' effects run. Solid inserts the root's children lazily, so a
  // sibling's render effect would run first; attaching from the root's own body keeps React's order.
  createDepsRenderEffect(
    () => props.handle,
    (handle) => handle?.attachStore(store),
  );

  const renderContent = () => (
    <PopoverRootContext value={{ store } as PopoverRootContext<unknown>}>
      <Show when={shouldRenderInteractions()}>
        <PopoverInteractions store={store} modal={modal()} />
      </Show>
      <ComponentWithPayload payload={payload} children={props.children} />
    </PopoverRootContext>
  );

  if (props.nestedInPopoverRoot) {
    return renderContent();
  }

  return <FloatingTree>{renderContent()}</FloatingTree>;
}

/**
 * Groups all parts of the popover.
 * Doesn’t render its own HTML element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverRoot<Payload = unknown>(props: PopoverRoot.Props<Payload>) {
  // Solid: `<FloatingTree>` wraps the component's output rather than the component, because a
  // provider resolves its children lazily: the root body (and its handle attachment) would run after
  // later siblings' bodies and render effects, unlike React, which renders the subtree in place.
  const nestedInPopoverRoot = usePopoverRootContext(true) != null;
  return <PopoverRootComponent {...props} nestedInPopoverRoot={nestedInPopoverRoot} />;
}

function usePopoverRootStore<Payload>(initialState: Partial<PopoverStoreState<Payload>>) {
  // The store is owned by this Root instance and created exactly once. It is not tied to the handle:
  // the handle attaches to it, so swapping the handle re-attaches rather than recreating state.
  // Default values are only initial values; controlled values and root state are synced after creation.
  // Solid: the patient-click timeout in the store's context is disposed with this owner (`useTimeout`).
  return usePopupRootStore((floatingId, nested) =>
    PopoverStore<Payload>(initialState, floatingId, nested),
  );
}

export interface PopoverRootState {}

export interface PopoverRootProps<Payload = unknown> {
  /**
   * Whether the popover is initially open.
   *
   * To render a controlled popover, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popover is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popover is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: PopoverRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the popover is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the popover.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the popover imperatively when called.
   */
  actionsRef?: ReactLikeRef<PopoverRoot.Actions | null> | undefined;
  /**
   * Determines if the popover enters a modal state when open.
   * - `true`: user interaction is limited to the popover: document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the popover, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * When `modal` is `true`, focus trapping is enabled only if `<Popover.Close>` is rendered
   * inside `<Popover.Popup>`. It can be visually hidden with your own CSS if needed, such as
   * Tailwind's `sr-only` utility.
   *
   * When `modal` is `'trap-focus'`, render `<Popover.Close>` inside `<Popover.Popup>` so touch
   * screen readers can escape the popup.
   * @default false
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled popover.
   * There's no need to specify this prop when the popover is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open popover.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the popover with a trigger.
   * If specified, allows external triggers to control the popover's open state.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * The content of the popover.
   * This can be a regular React node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
}

export interface PopoverRootActions {
  unmount: () => void;
  close: () => void;
}

export type PopoverRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;
export type PopoverRootChangeEventDetails =
  BaseUIChangeEventDetails<PopoverRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export namespace PopoverRoot {
  export type State = PopoverRootState;
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Actions = PopoverRootActions;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

function PopoverInteractions<Payload>(props: {
  store: PopoverStore<Payload>;
  modal: boolean | 'trap-focus';
}) {
  const dismiss = useDismiss({
    get context() {
      return props.store.context.floatingRootContext;
    },
    props: {
      outsidePressEvent: {
        // Ensure `aria-hidden` on outside elements is removed immediately
        // on outside press when trapping focus.
        get mouse() {
          return props.modal === 'trap-focus' ? 'sloppy' : 'intentional';
        },
        touch: 'sloppy',
      },
    },
  });

  // `useDismiss` is not given an `enabled` option, so it always returns both prop bags. Restore
  // the `EMPTY_OBJECT` fallbacks if that ever changes: the store fields are non-optional.
  // `dismiss.trigger` is always the same object as `dismiss.reference`.
  // PopoverPopup already spreads `FOCUSABLE_POPUP_PROPS` directly, so the popup
  // props only need to carry the dismiss handlers.
  usePopupInteractionProps(props.store, {
    get activeTriggerProps() {
      return dismiss.reference!;
    },
    get inactiveTriggerProps() {
      return dismiss.reference!;
    },
    get popupProps() {
      return dismiss.floating!;
    },
  });

  return null;
}
