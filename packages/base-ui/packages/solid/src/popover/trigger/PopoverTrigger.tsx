import { createMemo, createSignal, untrack } from 'solid-js';
import { safePolygon, useClick, useHoverReferenceInteraction } from '../../floating-ui-solid';
import { live, splitComponentProps, type ReactLikeRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import { CLICK_TRIGGER_IDENTIFIER } from '../../utils/constants';
import { TriggerFocusGuards } from '../../utils/popups/TriggerFocusGuards';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { usePopupHandleStore, useTriggerDataForwarding } from '../../utils/popups';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import {
  pressableTriggerOpenStateMapping,
  triggerOpenStateMapping,
} from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, NativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useOpenMethodTriggerProps } from '../../utils/useOpenInteractionType';
import { useRenderElement } from '../../utils/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { PopoverHandle } from '../store/PopoverHandle';
import type { PopoverHandleStore } from '../store/PopoverStore';
import { OPEN_DELAY } from '../utils/constants';

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverTrigger<Payload>(componentProps: PopoverTrigger.Props<Payload>) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'nativeButton',
    'handle',
    'payload',
    'openOnHover',
    'delay',
    'closeDelay',
    'id',
  ]);

  const disabled = () => Boolean(local.disabled ?? false);
  const nativeButton = () => local.nativeButton ?? true;
  const openOnHover = () => local.openOnHover ?? false;
  const delay = () => local.delay ?? OPEN_DELAY;
  const closeDelay = () => local.closeDelay ?? 0;
  const idProp = () => local.id;

  const rootStore = usePopoverRootContext(true)?.store;
  const handleStore = usePopupHandleStore(() => local.handle);
  const store = createMemo(
    () => (handleStore() ?? rootStore) as PopoverHandleStore<unknown> | undefined,
  );
  if (!untrack(store)) {
    throw new Error(
      'Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.',
    );
  }
  // Live: handlers, refs and effect callbacks read the latest store imperatively.
  const currentStore = live(() => store()!);

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = () => currentStore().select('isTriggerActive', thisTriggerId);
  const floatingContext = () => currentStore().context.floatingRootContext;
  const isOpenedByThisTrigger = () => currentStore().select('isOpenedByTrigger', thisTriggerId);
  const popupId = () => currentStore().select('triggerPopupId', thisTriggerId);

  const triggerElementRef: ReactLikeRef<HTMLElement | null> = { current: null };
  // Solid: a signal as well, so the hover hook re-attaches its listeners once the element exists.
  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    currentStore,
    {
      get payload() {
        return local.payload;
      },
      get disabled() {
        return disabled();
      },
      get openOnHover() {
        return openOnHover();
      },
      get closeDelay() {
        return closeDelay();
      },
    },
  );

  const openReason = () => currentStore().select('openChangeReason');
  const stickIfOpen = () => currentStore().select('stickIfOpen');
  const openMethod = () => currentStore().select('openMethod');
  const focusManagerModal = () => currentStore().select('focusManagerModal');

  const hoverProps = useHoverReferenceInteraction({
    get context() {
      return floatingContext();
    },
    props: {
      get enabled() {
        return (
          !disabled() &&
          openOnHover() &&
          (openMethod() !== 'touch' || openReason() !== REASONS.triggerPress)
        );
      },
      mouseOnly: true,
      move: false,
      handleClose: safePolygon(),
      get restMs() {
        return delay();
      },
      delay: () => ({
        close: closeDelay(),
      }),
      get triggerElementRef() {
        return triggerElement();
      },
      get isActiveTrigger() {
        return isTriggerActive();
      },
      isClosing: () => currentStore().select('transitionStatus') === 'ending',
    },
  });

  const click = useClick({
    get context() {
      return floatingContext();
    },
    props: {
      get stickIfOpen() {
        return stickIfOpen();
      },
    },
  });
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => currentStore().select('open'),
    (interactionType) => {
      currentStore().set('openMethod', interactionType);
    },
  );

  const rootTriggerProps = () => currentStore().select('triggerProps', isMountedByThisTrigger);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const stateAttributesMapping: StateAttributesMapping<{ open: boolean }> = {
    open(value) {
      if (value && openReason() === REASONS.triggerPress) {
        return pressableTriggerOpenStateMapping.open(value);
      }

      return triggerOpenStateMapping.open(value);
    },
  };

  const { preFocusGuardRef, handlePreFocusGuardFocus, handleFocusTargetFocus } =
    useTriggerFocusGuards(currentStore, triggerElementRef);

  const state: PopoverTrigger.State = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const element = useRenderElement('button', componentProps, {
    state,
    ref: (el: HTMLElement | null) => {
      buttonRef(el);
      triggerElementRef.current = el;
      registerTrigger(el);
      setTriggerElement(el);
    },
    get props() {
      return [
        click.reference,
        hoverProps,
        rootTriggerProps(),
        interactionTypeProps,
        {
          [CLICK_TRIGGER_IDENTIFIER as string]: '',
          get id() {
            return thisTriggerId();
          },
          'aria-haspopup': 'dialog' as const,
          get 'aria-expanded'() {
            return isOpenedByThisTrigger() ? 'true' : 'false';
          },
          get 'aria-controls'() {
            return popupId();
          },
        },
        elementProps,
        getButtonProps,
      ];
    },
    stateAttributesMapping,
  });

  const guardsActive = () => isMountedByThisTrigger() && !focusManagerModal();

  return (
    <TriggerFocusGuards
      active={guardsActive()}
      leadingGuardRef={preFocusGuardRef}
      onLeadingFocus={handlePreFocusGuardFocus}
      trailingGuardRef={currentStore().context.triggerFocusTargetRef}
      onTrailingFocus={handleFocusTargetFocus}
    >
      {element()}
    </TriggerFocusGuards>
  );
}

export interface PopoverTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the popover is currently open and was opened by this trigger.
   */
  open: boolean;
}

export type PopoverTriggerProps<Payload = unknown> = NativeButtonProps &
  BaseUIComponentProps<'button', PopoverTriggerState> & {
    /**
     * Whether the component renders a native `<button>` element when replacing it
     * via the `render` prop.
     * Set to `false` if the rendered element is not a button (e.g. `<div>`).
     * @default true
     */
    nativeButton?: boolean | undefined;
    /**
     * A handle to associate the trigger with a popover.
     */
    handle?: PopoverHandle<Payload> | undefined;
    /**
     * A payload to pass to the popover when it is opened.
     */
    // Inferred from `handle` (React gets this from method bivariance), so the payload must match it.
    payload?: NoInfer<Payload> | undefined;
    /**
     * ID of the trigger. In addition to being forwarded to the rendered element,
     * it is also used to specify the active trigger for the popover in controlled mode (with the PopoverRoot `triggerId` prop).
     */
    id?: string | undefined;
    /**
     * Whether the popover should also open when the trigger is hovered.
     * @default false
     */
    openOnHover?: boolean | undefined;
    /**
     * How long to wait before the popover may be opened on hover. Specified in milliseconds.
     *
     * Requires the `openOnHover` prop.
     * @default 300
     */
    delay?: number | undefined;
    /**
     * How long to wait before closing the popover that was opened on hover.
     * Specified in milliseconds.
     *
     * Requires the `openOnHover` prop.
     * @default 0
     */
    closeDelay?: number | undefined;
  };

export namespace PopoverTrigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}
