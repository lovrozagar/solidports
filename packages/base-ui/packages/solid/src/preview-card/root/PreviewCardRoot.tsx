import { onSettled, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FloatingTree, useDismiss } from '../../floating-ui-solid';
import {
  ComponentWithPayload,
  createDepsRenderEffect,
  type ReactLikeRef,
  isAbsentProp,
} from '../../solid-helpers';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { PreviewCardStore } from '../store/PreviewCardStore';
import {
  PayloadChildRenderFunction,
  PopupHandleAttachment,
  useImplicitActiveTrigger,
  usePopupRootStore,
  useOpenStateTransitions,
  usePopupInteractionProps,
} from '../../utils/popups';
import { PreviewCardHandle } from '../store/PreviewCardHandle';
import { PreviewCardRootContext, usePreviewCardRootContext } from './PreviewCardContext';

function PreviewCardRootComponent<Payload>(props: PreviewCardRoot.Props<Payload>) {
  const openProp = () => props.open;
  const defaultOpen = () => props.defaultOpen ?? false;
  const triggerIdProp = () => props.triggerId;
  const defaultTriggerIdProp = () => props.defaultTriggerId ?? null;

  const store = usePopupRootStore((floatingId, nested) =>
    PreviewCardStore<Payload>(
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
    (nextOpen: boolean, eventDetails: PreviewCardRoot.ChangeEventDetails) =>
      untrack(() => props.onOpenChange)?.(nextOpen, eventDetails),
  );
  store.useContextCallback('onOpenChangeComplete', (nextOpen: boolean) =>
    untrack(() => props.onOpenChangeComplete)?.(nextOpen),
  );

  const open = store.useState('open');
  const activeTriggerId = store.useState('activeTriggerId');
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as Accessor<Payload | undefined>;

  useImplicitActiveTrigger(store, { closeOnActiveTriggerUnmount: true });
  const { forceUnmount } = useOpenStateTransitions(open, store, () => {
    store.context.inlineRectCoordsRef.current = undefined;
  });

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

  const shouldRenderInteractions = () => open() || mounted();

  // No `handle` prop: nothing to attach, so no `Show` for it.
  const handleAttachment = isAbsentProp(props, 'handle') ? null : (
    <Show when={props.handle}>
      {(handle) => <PopupHandleAttachment handle={handle()} store={store} />}
    </Show>
  );

  return (
    <PreviewCardRootContext value={{ store } as PreviewCardRootContext}>
      {handleAttachment}
      <Show when={shouldRenderInteractions()}>
        <PreviewCardInteractions store={store} />
      </Show>
      <ComponentWithPayload payload={payload} children={props.children} />
    </PreviewCardRootContext>
  );
}

function PreviewCardInteractions<Payload>(props: { store: PreviewCardStore<Payload> }) {
  const dismiss = useDismiss({
    get context() {
      return props.store.context.floatingRootContext;
    },
  });

  // `useDismiss` is not given an `enabled` option, so all three prop bags are always defined.
  // `dismiss.trigger` is the same object as `dismiss.reference`.
  usePopupInteractionProps(props.store, {
    get activeTriggerProps() {
      return dismiss.reference!;
    },
    get inactiveTriggerProps() {
      return dismiss.trigger!;
    },
    get popupProps() {
      return dismiss.floating!;
    },
  });

  return null;
}

/**
 * Groups all parts of the preview card.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardRoot<Payload>(props: PreviewCardRoot.Props<Payload>) {
  if (usePreviewCardRootContext(true)) {
    return <PreviewCardRootComponent {...props} />;
  }

  return (
    <FloatingTree>
      <PreviewCardRootComponent {...props} />
    </FloatingTree>
  );
}

export interface PreviewCardRootState {}

export interface PreviewCardRootProps<Payload = unknown> {
  /**
   * Whether the preview card is initially open.
   *
   * To render a controlled preview card, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the preview card is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the preview card is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: PreviewCardRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the preview card is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Unmounts the preview card popup.
   * - `close`: Closes the preview card imperatively when called.
   */
  actionsRef?: ReactLikeRef<PreviewCardRoot.Actions | null> | undefined;
  /**
   * A handle to associate the preview card with a trigger.
   * If specified, allows external triggers to control the card's open state.
   * Can be created with the PreviewCard.createHandle() method.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * The content of the preview card.
   * This can be a regular React node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * ID of the trigger that the preview card is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled preview card.
   * There's no need to specify this prop when the preview card is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the preview card is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open preview card.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface PreviewCardRootActions {
  unmount: () => void;
  close: () => void;
}

export type PreviewCardRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type PreviewCardRootChangeEventDetails =
  BaseUIChangeEventDetails<PreviewCardRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export namespace PreviewCardRoot {
  export type State = PreviewCardRootState;
  export type Props<Payload = unknown> = PreviewCardRootProps<Payload>;
  export type Actions = PreviewCardRootActions;
  export type ChangeEventReason = PreviewCardRootChangeEventReason;
  export type ChangeEventDetails = PreviewCardRootChangeEventDetails;
}
