import { createMemo, createSignal, untrack } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import {
  safePolygon,
  useDelayGroup,
  useFloatingDelayGroupContext,
  useFocus,
  useHoverReferenceInteraction,
} from '../../floating-ui-solid';
import { contains } from '../../floating-ui-solid/utils/element';
import { isMouseLikePointerType } from '../../floating-ui-solid/utils/event';
import { useHoverInteractionSharedState } from '../../floating-ui-solid/hooks/useHoverInteractionSharedState';
import { getDelay } from '../../floating-ui-solid/hooks/useHoverShared';
import {
  live,
  splitComponentProps,
  type ReactLikeRef,
  createLayoutEffect,
} from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import {
  usePopupHandleStore,
  useTriggerDataForwarding,
  useTriggerInteractions,
} from '../../utils/popups';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, BaseUIEvent } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { useTooltipProviderContext } from '../provider/TooltipProviderContext';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipHandle } from '../store/TooltipHandle';
import type { TooltipHandleStore } from '../store/TooltipStore';
import { OPEN_DELAY } from '../utils/constants';
import { TooltipTriggerDataAttributes } from './TooltipTriggerDataAttributes';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-base-ui-tooltip-trigger';

function getTargetElement(event: Event): Element | null {
  if ('composedPath' in event) {
    const path = event.composedPath();
    for (let i = 0; i < path.length; i += 1) {
      const element = path[i];
      if (isElement(element)) {
        return element;
      }
    }
  }

  const target = event.target;
  if (isElement(target)) {
    return target;
  }

  return null;
}

function closestEnabledTooltipTrigger(element: Element | null): Element | null {
  let current = element;
  while (current) {
    const trigger = current.closest(`[${TOOLTIP_TRIGGER_IDENTIFIER}]`);
    if (trigger) {
      return trigger;
    }

    const root = current.getRootNode();
    current = 'host' in root && isElement(root.host) ? root.host : null;
  }

  return null;
}

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipTrigger<Payload>(componentProps: TooltipTrigger.Props<Payload>) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'handle',
    'payload',
    'disabled',
    'delay',
    'closeOnClick',
    'closeDelay',
    'id',
  ]);
  const idProp = () => local.id;
  const closeOnClick = () => local.closeOnClick ?? true;

  const rootContext = useTooltipRootContext(true);
  const handleStore = usePopupHandleStore(() => local.handle);
  const store = createMemo(
    () => (handleStore() ?? rootContext?.store) as TooltipHandleStore<unknown> | undefined,
  );
  if (!untrack(store)) {
    throw new Error(
      'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
    );
  }
  // Live: handlers, refs and effect callbacks read the latest store imperatively.
  const currentStore = live(() => store()!);

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = () => currentStore().select('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = () => currentStore().select('isOpenedByTrigger', thisTriggerId);
  const floatingRootContext = () => currentStore().context.floatingRootContext;

  const triggerElementRef: ReactLikeRef<Element | null> = { current: null };
  // Solid: a signal as well, so the hover hook re-attaches its listeners once the element exists.
  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);

  const closeDelayWithDefault = () => local.closeDelay ?? 0;

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    currentStore,
    {
      get payload() {
        return local.payload;
      },
      get closeOnClick() {
        return closeOnClick();
      },
      get closeDelay() {
        return closeDelayWithDefault();
      },
    },
  );

  const providerDelay = useTooltipProviderContext();
  // The group's shared refs are read from context at setup; the group's open/close effects are
  // created with the other interactions on first intent (see `createInteractions`).
  const { currentIdRef: activeIdRef, delayRef, hasProvider } = useFloatingDelayGroupContext();
  const [hoverInteraction, setHoverInteraction] = useHoverInteractionSharedState({
    get store() {
      return floatingRootContext();
    },
  });

  const rootDisabled = () => currentStore().select('disabled');
  const disabled = () => local.disabled ?? rootDisabled();
  const trackCursorAxis = () => currentStore().select('trackCursorAxis');
  const disableHoverablePopup = () => currentStore().select('disableHoverablePopup');

  let isNestedTriggerHoveredRef = false;
  const nestedTriggerOpenTimeout = useTimeout();
  // Local copy so it can be cleared on mouseLeave without resetting the hover hook's own pointerType.
  let pointerTypeRef: string | undefined;

  // Called by the hover hook and handlers: reads the latest props.
  function getOpenDelay() {
    // Adjacent tooltips open instantly while the group is active.
    if (hasProvider && activeIdRef.current != null) {
      return 0;
    }
    return untrack(() => local.delay ?? providerDelay?.() ?? OPEN_DELAY);
  }

  function isEnabledNestedTriggerTarget(target: Element | null) {
    const triggerEl = triggerElementRef.current;
    if (!triggerEl || !target) {
      return false;
    }

    const nearestTrigger = closestEnabledTooltipTrigger(target);
    return (
      nearestTrigger !== null && nearestTrigger !== triggerEl && contains(triggerEl, nearestTrigger)
    );
  }

  function detectNestedTriggerHover(target: Element | null) {
    const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);

    isNestedTriggerHoveredRef = nestedTriggerHovered;
    if (nestedTriggerHovered) {
      hoverInteraction.openChangeTimeout.clear();
      hoverInteraction.restTimeout.clear();
      setHoverInteraction('restTimeoutPending', false);
      nestedTriggerOpenTimeout.clear();
    }
    return nestedTriggerHovered;
  }

  // A closed trigger renders only its element: the hover, focus and delay-group interactions are
  // created on the first intent, or when this trigger's tooltip opens or mounts by other means, and
  // are kept afterwards. React mounts these hooks up front; their closed-state output is handlers only.
  function createInteractions() {
    const { isInstantPhase } = useDelayGroup({
      get context() {
        return floatingRootContext();
      },
      options: {
        get open() {
          return isOpenedByThisTrigger();
        },
      },
    });
    // React's `store.useSyncedValue`; also re-syncs when the handle exposes another store.
    createLayoutEffect(
      () => [currentStore(), isInstantPhase()] as const,
      ([targetStore, value]) => {
        targetStore.set('isInstantPhase', value);
      },
    );

    const hover = useHoverReferenceInteraction({
      get context() {
        return floatingRootContext();
      },
      props: {
        get enabled() {
          return !disabled();
        },
        mouseOnly: true,
        move: false,
        get handleClose() {
          return !disableHoverablePopup() && trackCursorAxis() !== 'both' ? safePolygon() : null;
        },
        restMs: getOpenDelay,
        delay() {
          if (untrack(() => local.closeDelay) == null && hasProvider) {
            return { close: getDelay(delayRef.current, 'close') };
          }
          return { close: untrack(closeDelayWithDefault) };
        },
        get triggerElementRef() {
          return triggerElement();
        },
        get isActiveTrigger() {
          return isTriggerActive();
        },
        isClosing: () => currentStore().select('transitionStatus') === 'ending',
        shouldOpen() {
          return !isNestedTriggerHoveredRef;
        },
      },
    });

    const focus = useFocus({
      get context() {
        return floatingRootContext();
      },
      props: {
        get enabled() {
          return !disabled();
        },
      },
    });

    return { hover, focus };
  }
  const interactions = useTriggerInteractions(
    createInteractions,
    triggerElement,
    () => isOpenedByThisTrigger() || isMountedByThisTrigger() || trackCursorAxis() !== 'none',
  );

  const handleNestedTriggerHover = (event: MouseEvent) => {
    const targetStore = currentStore();
    const wasNestedTriggerHovered = isNestedTriggerHoveredRef;
    const target = getTargetElement(event);
    const nestedTriggerHovered = detectNestedTriggerHover(target);
    const triggerEl = triggerElementRef.current as HTMLElement | null;
    const targetInsideTrigger = triggerEl && target && contains(triggerEl, target);

    // Only close hover-opened parents. Focus/click-like opens remain owned by
    // their original interaction and should not be clobbered by nested hover.
    if (
      nestedTriggerHovered &&
      targetStore.select('open') &&
      targetStore.select('lastOpenChangeReason') === REASONS.triggerHover
    ) {
      targetStore.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      return;
    }

    if (
      wasNestedTriggerHovered &&
      !nestedTriggerHovered &&
      targetInsideTrigger &&
      !untrack(disabled) &&
      !targetStore.select('open') &&
      triggerEl &&
      // Match the hover hook's non-strict mouse fallback for mouse-only event sequences.
      isMouseLikePointerType(pointerTypeRef)
    ) {
      const open = () => {
        const latestStore = currentStore();
        if (!isNestedTriggerHoveredRef && !untrack(disabled) && !latestStore.select('open')) {
          latestStore.setOpen(
            true,
            createChangeEventDetails(REASONS.triggerHover, event, triggerEl),
          );
        }
      };

      const openDelay = getOpenDelay();

      // With `move: false`, the hover hook only listens to mouseenter/mouseleave
      // on the parent trigger. Leaving a nested child for the parent area fires
      // no event the hook can react to, so reopen locally.
      if (openDelay === 0) {
        nestedTriggerOpenTimeout.clear();
        open();
      } else {
        nestedTriggerOpenTimeout.start(openDelay, open);
      }
    }
  };

  const rootTriggerProps = () => currentStore().select('triggerProps', isMountedByThisTrigger);
  const shouldApplyRootTriggerProps = () =>
    isMountedByThisTrigger() || trackCursorAxis() !== 'none';

  const state: TooltipTrigger.State = {
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  // Read per key by the element props: a change does not rebuild the props chain.
  const rootTriggerSource = propsSourceAccessor(() =>
    shouldApplyRootTriggerProps() ? rootTriggerProps() : undefined,
  );
  const element = useRenderElement('button', componentProps, {
    state,
    ref: (el: Element | null) => {
      triggerElementRef.current = el;
      registerTrigger(el);
      setTriggerElement(el);
    },
    props: [
      propsSourceAccessor(() => interactions()?.hover),
      propsSourceAccessor(() => interactions()?.focus.reference),
      rootTriggerSource,
      {
        onMouseOver(event: MouseEvent) {
          handleNestedTriggerHover(event);
        },
        onFocus(event: BaseUIEvent<FocusEvent>) {
          if (isEnabledNestedTriggerTarget(getTargetElement(event))) {
            event.preventBaseUIHandler();
          }
        },
        onMouseLeave() {
          isNestedTriggerHoveredRef = false;
          nestedTriggerOpenTimeout.clear();
          pointerTypeRef = undefined;
        },
        onPointerEnter(event: PointerEvent) {
          pointerTypeRef = event.pointerType;
        },
        onPointerDown(event: PointerEvent) {
          pointerTypeRef = event.pointerType;
          const targetStore = currentStore();
          const shouldCloseOnClick = untrack(closeOnClick);
          targetStore.set('closeOnClick', shouldCloseOnClick);
          if (shouldCloseOnClick && !targetStore.select('open')) {
            targetStore.cancelPendingOpen(event);
          }
        },
        onClick(event: MouseEvent) {
          const targetStore = currentStore();
          if (untrack(closeOnClick) && !targetStore.select('open')) {
            targetStore.cancelPendingOpen(event);
          }
        },
        get id() {
          return thisTriggerId();
        },
        get [TooltipTriggerDataAttributes.triggerDisabled]() {
          return disabled() ? '' : undefined;
        },
        get [TOOLTIP_TRIGGER_IDENTIFIER]() {
          return disabled() ? undefined : '';
        },
      },
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });

  return <>{element()}</>;
}

export interface TooltipTriggerState {
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerProps<Payload = unknown> extends BaseUIComponentProps<
  'button',
  TooltipTriggerState
> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  // Inferred from `handle` (React gets this from method bivariance), so the payload must match it.
  payload?: NoInfer<Payload> | undefined;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you want to disable the trigger element itself, you can pass the `disabled` prop to the trigger element via the `render` prop.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
}
