import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import {
  safePolygon,
  useDelayGroup,
  useFloatingDelayGroupContext,
  useFocus,
  useHoverReferenceInteraction,
} from '../../floating-ui-solid';
import { contains } from '../../floating-ui-solid/utils/element';
import { closest, getTarget } from '../../utils/shadowDom';
import { isMouseLikePointerType } from '../../floating-ui-solid/utils/event';
import { useHoverInteractionSharedState } from '../../floating-ui-solid/hooks/useHoverInteractionSharedState';
import { getDelay } from '../../floating-ui-solid/hooks/useHoverShared';
import { live, splitComponentProps, createLayoutEffect } from '../../solid-helpers';
import type { ReactLikeRef } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import {
  usePopupHandleStore,
  useTriggerDataForwarding,
  useTriggerInteractions,
} from '../../utils/popups';
import {
  CommonTriggerDataAttributes,
  triggerOpenStateMapping,
} from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, BaseUIEvent } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { canRenderNative, partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { useTimeout } from '../../utils/useTimeout';
import { useTooltipProviderContext } from '../provider/TooltipProviderContext';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { TooltipHandle } from '../store/TooltipHandle';
import type { TooltipHandleStore } from '../store/TooltipStore';
import { OPEN_DELAY } from '../utils/constants';
import * as TooltipTriggerDataAttributes from './TooltipTriggerDataAttributes';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-base-ui-tooltip-trigger';

function eventTargetElement(event: Event): Element | null {
  const target = getTarget(event);
  return isElement(target) ? target : null;
}

/** Props the native path reads once, as the slow path does. */
const NATIVE_STATIC_KEYS = ['handle'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'handle',
  'payload',
  'disabled',
  'delay',
  'closeOnClick',
  'closeDelay',
  'id',
]);

/**
 * A native trigger's model: the target of its module-level handlers and attribute write. Its
 * handler sources in the slow path's `mergeProps` order below the consumer's: the trigger's own
 * handlers, the root's applied trigger props (client point, dismissal), then focus and hover once
 * the interactions exist. One object per trigger.
 */
class NativeTooltipTriggerModel implements TooltipTrigger.State {
  declare readonly isOpen: () => boolean;
  declare readonly isDisabled: () => boolean;
  declare readonly id: () => string | undefined;
  declare private readonly sources: ReadonlyArray<() => object | undefined>;

  constructor(
    isOpen: () => boolean,
    isDisabled: () => boolean,
    id: () => string | undefined,
    sources: ReadonlyArray<() => object | undefined>,
  ) {
    this.isOpen = isOpen;
    this.isDisabled = isDisabled;
    this.id = id;
    this.sources = sources;
  }

  get open() {
    return this.isOpen();
  }

  /** Calls each source's handler for `key` until one prevents the rest (`mergeProps` order). */
  dispatch(key: string, event: BaseUIEvent<Event>) {
    for (const source of this.sources) {
      if (event.baseUIHandlerPrevented) {
        return;
      }
      const props = source();
      const handler = props ? readHandler(props, key) : undefined;
      if (handler) {
        handler(event);
      }
    }
  }
}

const dispatchSources = (key: string) => (trigger: NativeTooltipTriggerModel, event: Event) =>
  trigger.dispatch(key, event as BaseUIEvent<Event>);

/**
 * A native trigger's handlers, created once: the consumer's handler, then the trigger's sources.
 * The keys are every handler the sources can carry: the trigger's own (`onMouseOver`, `onFocus`,
 * `onMouseLeave`, `onPointerEnter`, `onPointerDown`, `onClick`), hover (`onMouseMove`,
 * `onPointerDown`, `onPointerEnter`), focus (`onFocus`, `onBlur`, `onMouseLeave`), client point
 * (`onMouseEnter`, `onMouseMove`, `onPointerDown`, `onPointerEnter`) and dismissal (`onKeyDown`,
 * `onPointerDown`, `onClick`).
 */
const TRIGGER_HANDLERS: Readonly<Record<string, Dispatch<NativeTooltipTriggerModel>>> =
  Object.fromEntries(
    [
      'onClick',
      'onPointerDown',
      'onPointerEnter',
      'onKeyDown',
      'onMouseEnter',
      'onMouseMove',
      'onMouseOver',
      'onMouseLeave',
      'onFocus',
      'onBlur',
    ].map((key) => [key, partHandler(key, dispatchSources(key))]),
  );

/** The trigger's own attributes below the consumer's: one write per pass. */
function writeTriggerAttributes(w: SetAttribute, trigger: NativeTooltipTriggerModel) {
  const disabled = trigger.isDisabled();
  w.set('id', trigger.id());
  w.set(TooltipTriggerDataAttributes.triggerDisabled, disabled ? '' : undefined);
  w.set(TOOLTIP_TRIGGER_IDENTIFIER, disabled ? undefined : '');
  // `triggerOpenStateMapping`.
  w.set(CommonTriggerDataAttributes.popupOpen, trigger.isOpen() ? '' : undefined);
}

/** No state attribute of its own: `data-popup-open` is written with the attributes. */
const writeTriggerState = compileStateWriter([], undefined);

const triggerState = (trigger: NativeTooltipTriggerModel) => trigger;
const constant =
  <T,>(value: T) =>
  () =>
    value;

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipTrigger<Payload>(componentProps: TooltipTrigger.Props<Payload>) {
  // Native fast path (`context/architecture/render-pipeline.md`): a root's own trigger (no detached
  // handle) renders with direct JSX; the props chain is inlined (D32).
  const native =
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.handle == null);
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

    const nearestTrigger = closest(target, `[${TOOLTIP_TRIGGER_IDENTIFIER}]`);
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
    const target = eventTargetElement(event);
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

  // Own handlers, in the slow path's props order below the consumer's.
  const ownHandlers = {
    onMouseOver(event: MouseEvent) {
      handleNestedTriggerHover(event);
    },
    onFocus(event: BaseUIEvent<FocusEvent>) {
      if (isEnabledNestedTriggerTarget(eventTargetElement(event))) {
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
  };
  const appliedTriggerProps = () =>
    currentStore().select(
      'appliedTriggerProps',
      () => isMountedByThisTrigger() || trackCursorAxis() !== 'none',
    );
  const setRefs = (el: Element | null) => {
    triggerElementRef.current = el;
    registerTrigger(el);
    setTriggerElement(el);
  };

  // The native element is created once, here, under the trigger's owner.
  const element: () => JSX.Element = native ? constant(nativeElement()) : slowElement();

  function nativeElement() {
    const model = new NativeTooltipTriggerModel(isOpenedByThisTrigger, disabled, thisTriggerId, [
      () => ownHandlers,
      appliedTriggerProps,
      () => interactions()?.focus.reference,
      () => interactions()?.hover,
    ]);
    // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
    const el = (<button type="button" />) as unknown as HTMLButtonElement;
    return renderNativeElement(el, componentProps, {
      own: OWN_KEYS,
      state: triggerState,
      stateWriter: writeTriggerState,
      stateView: model,
      reactive: true,
      attributes: writeTriggerAttributes,
      handlers: TRIGGER_HANDLERS,
      handlerTarget: model,
      refs: [setRefs],
    }) as unknown as JSX.Element;
  }

  function slowElement() {
    const state: TooltipTrigger.State = {
      get open() {
        return isOpenedByThisTrigger();
      },
    };

    // Read per key by the element props: a change does not rebuild the props chain.
    const rootTriggerSource = propsSourceAccessor(appliedTriggerProps);
    return useRenderElement('button', componentProps, {
      state,
      ref: setRefs,
      props: [
        propsSourceAccessor(() => interactions()?.hover),
        propsSourceAccessor(() => interactions()?.focus.reference),
        rootTriggerSource,
        {
          ...ownHandlers,
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
  }

  return element();
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
