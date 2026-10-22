import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { safePolygon, useClick, useHoverReferenceInteraction } from '../../floating-ui-solid';
import { live, omitComponentProps } from '../../solid-helpers';
import type { ReactLikeRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import { CLICK_TRIGGER_IDENTIFIER } from '../../utils/constants';
import { TriggerFocusGuards } from '../../utils/popups/TriggerFocusGuards';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import {
  usePopupHandleStore,
  useTriggerDataForwarding,
  useTriggerInteractions,
} from '../../utils/popups';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import {
  CommonTriggerDataAttributes,
  pressableTriggerOpenStateMapping,
  triggerOpenStateMapping,
} from '../../utils/popupStateMapping';
import type { BaseUIComponentProps, BaseUIEvent, NativeButtonProps } from '../../utils/types';
import { canRenderNative, partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useOpenMethodTriggerProps } from '../../utils/useOpenInteractionType';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import type { PopoverHandle } from '../store/PopoverHandle';
import type { PopoverHandleStore } from '../store/PopoverStore';
import { OPEN_DELAY } from '../utils/constants';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton', 'handle'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'disabled',
  'nativeButton',
  'handle',
  'payload',
  'openOnHover',
  'delay',
  'closeDelay',
  'id',
]);
const TRIGGER_LITERALS: Record<string, unknown> = {
  [CLICK_TRIGGER_IDENTIFIER as string]: '',
  'aria-haspopup': 'dialog',
  // `useFocusableWhenDisabled` for a native button outside a composite.
  tabindex: 0,
};

/**
 * A native trigger's model: the target of its module-level handlers and attribute write. The
 * trigger's own handler sources, in the slow path's `mergeProps` order below the consumer's: the
 * open-method props, the root's trigger props (dismissal), then hover and click once the
 * interactions exist. One object per trigger.
 */
class NativePopoverTriggerModel implements PopoverTrigger.State {
  declare private readonly disabledAccessor: () => boolean;
  declare readonly isOpen: () => boolean;
  declare readonly isPressOpen: () => boolean;
  declare readonly id: () => string | undefined;
  declare readonly popupId: () => string | undefined;
  declare private readonly sources: ReadonlyArray<() => object | undefined>;

  constructor(
    disabled: () => boolean,
    isOpen: () => boolean,
    isPressOpen: () => boolean,
    id: () => string | undefined,
    popupId: () => string | undefined,
    sources: ReadonlyArray<() => object | undefined>,
  ) {
    this.disabledAccessor = disabled;
    this.isOpen = isOpen;
    this.isPressOpen = isPressOpen;
    this.id = id;
    this.popupId = popupId;
    this.sources = sources;
  }

  get disabled() {
    return this.disabledAccessor();
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

/** A disabled trigger cancels the event and runs no handler (`useButton`'s click and pointerdown). */
function preventWhileDisabled(trigger: NativePopoverTriggerModel, event: Event) {
  if (trigger.disabled) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (trigger: NativePopoverTriggerModel) => !trigger.disabled;

const dispatchSources = (key: string) => (trigger: NativePopoverTriggerModel, event: Event) =>
  trigger.dispatch(key, event as BaseUIEvent<Event>);

/**
 * A native trigger's handlers, created once: `useButton`'s gates for a native button, then the
 * consumer's handler, then the trigger's sources (`dispatch`).
 */
const TRIGGER_HANDLERS: Readonly<Record<string, Dispatch<NativePopoverTriggerModel>>> = {
  onClick: partHandler('onClick', dispatchSources('onClick'), preventWhileDisabled),
  onPointerDown: partHandler(
    'onPointerDown',
    dispatchSources('onPointerDown'),
    preventWhileDisabled,
  ),
  onMouseDown: partHandler('onMouseDown', dispatchSources('onMouseDown'), runWhileEnabled),
  onKeyDown: partHandler('onKeyDown', dispatchSources('onKeyDown'), runWhileEnabled),
  onMouseMove: partHandler('onMouseMove', dispatchSources('onMouseMove')),
  onPointerEnter: partHandler('onPointerEnter', dispatchSources('onPointerEnter')),
};

/** Bound only when the consumer passes it: `useButton`'s gate around the consumer's keyup. */
const TRIGGER_HANDLERS_IF_PASSED: Readonly<Record<string, Dispatch<NativePopoverTriggerModel>>> = {
  onKeyUp: partHandler('onKeyUp', undefined, runWhileEnabled),
};

const writeTriggerState = compileStateWriter(['disabled'], undefined);

/** The trigger's own attributes below the consumer's: one write per pass. */
function writeTriggerAttributes(w: SetAttribute, trigger: NativePopoverTriggerModel) {
  const open = trigger.isOpen();
  w.set('id', trigger.id());
  w.set('aria-expanded', open ? 'true' : 'false');
  w.set('aria-controls', trigger.popupId());
  // `useFocusableWhenDisabled` for a native button that is not focusable when disabled.
  w.set('disabled', trigger.disabled ? true : undefined);
  // `triggerOpenStateMapping`, or `pressableTriggerOpenStateMapping` for a press-opened popup.
  w.set(CommonTriggerDataAttributes.popupOpen, open ? '' : undefined);
  w.set(CommonTriggerDataAttributes.pressed, open && trigger.isPressOpen() ? '' : undefined);
}

const triggerState = (trigger: NativePopoverTriggerModel) => trigger;
const constant =
  <T,>(value: T) =>
  () =>
    value;

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverTrigger<Payload>(componentProps: PopoverTrigger.Props<Payload>) {
  // Native fast path (`context/architecture/render-pipeline.md`): a root's own `<button>` trigger
  // (no detached handle) renders with direct JSX; `useButton` and the props chain inlined (D32).
  const native =
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.handle == null && (componentProps.nativeButton ?? true));

  const disabled = () => Boolean(componentProps.disabled ?? false);
  const nativeButton = () => componentProps.nativeButton ?? true;
  const openOnHover = () => componentProps.openOnHover ?? false;
  const delay = () => componentProps.delay ?? OPEN_DELAY;
  const closeDelay = () => componentProps.closeDelay ?? 0;
  const idProp = () => componentProps.id;

  const rootStore = usePopoverRootContext(true)?.store;
  const handleStore = usePopupHandleStore(() => componentProps.handle);
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
        return componentProps.payload;
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

  const isPressOpenedByThisTrigger = () =>
    currentStore().select('isPressOpenedByTrigger', thisTriggerId);
  const isTouchPressOpen = () => currentStore().select('isTouchPressOpen', openOnHover());
  const hasFocusGuards = () => currentStore().select('hasTriggerFocusGuards', thisTriggerId);

  // A closed trigger renders handlers only: hover and click are created on the trigger's first
  // intent (pointerenter, focus, pointerdown and the rest, in the capture phase before its own
  // listeners, so a click finds them ready), or once this trigger opens or mounts the popup, and
  // are kept afterwards (D32, as Tooltip, Select and Combobox do). React mounts them up front.
  const interactions = useTriggerInteractions(
    () => {
      const hover = useHoverReferenceInteraction({
        get context() {
          return floatingContext();
        },
        props: {
          get enabled() {
            return !disabled() && openOnHover() && !isTouchPressOpen();
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
          stickIfOpen: () => currentStore().context.stickIfOpen,
        },
      });
      return { hover, click };
    },
    triggerElement,
    () => isOpenedByThisTrigger() || isMountedByThisTrigger(),
  );
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => currentStore().select('open'),
    (interactionType) => {
      currentStore().set('openMethod', interactionType);
    },
  );

  // Read per key by the element props, so a change does not rebuild the props chain.
  const rootTriggerProps = propsSourceAccessor(() =>
    currentStore().select('triggerProps', isMountedByThisTrigger),
  );

  const { handlePreFocusGuardFocus, handleFocusTargetFocus } = useTriggerFocusGuards(
    currentStore,
    triggerElementRef,
  );

  let model: NativePopoverTriggerModel | undefined;
  const setRefs = (el: HTMLElement | null) => {
    triggerElementRef.current = el;
    registerTrigger(el);
    setTriggerElement(el);
  };

  // The native element is created once, here, under the trigger's owner.
  const element: () => JSX.Element = native ? constant(nativeElement()) : slowElement();

  function nativeElement() {
    // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
    const el = (<button type="button" />) as unknown as HTMLButtonElement;
    return renderNativeElement(el, componentProps, {
      own: OWN_KEYS,
      state: triggerState,
      stateWriter: writeTriggerState,
      stateView: nativeModel(),
      reactive: true,
      literal: TRIGGER_LITERALS,
      attributes: writeTriggerAttributes,
      handlers: TRIGGER_HANDLERS,
      handlersIfPassed: TRIGGER_HANDLERS_IF_PASSED,
      handlerTarget: nativeModel(),
      refs: [setRefs],
    }) as unknown as JSX.Element;
  }

  function nativeModel() {
    model ??= new NativePopoverTriggerModel(
      disabled,
      isOpenedByThisTrigger,
      isPressOpenedByThisTrigger,
      thisTriggerId,
      popupId,
      [
        () => interactionTypeProps,
        () => currentStore().select('triggerProps', isMountedByThisTrigger),
        () => interactions()?.hover,
        () => interactions()?.click.reference,
      ],
    );
    return model;
  }

  function slowElement() {
    const elementProps = omitComponentProps(componentProps, [
      'disabled',
      'nativeButton',
      'handle',
      'payload',
      'openOnHover',
      'delay',
      'closeDelay',
      'id',
    ] as const);
    const { buttonSources, buttonRef } = useButton({
      disabled,
      native: nativeButton,
    });

    const stateAttributesMapping: StateAttributesMapping<{ open: boolean }> = {
      open(value) {
        if (isPressOpenedByThisTrigger()) {
          return pressableTriggerOpenStateMapping.open(value);
        }

        return triggerOpenStateMapping.open(value);
      },
    };

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
        setRefs(el);
      },
      props: [
        ...buttonSources.attributes,
        propsSourceAccessor(() => interactions()?.click.reference),
        propsSourceAccessor(() => interactions()?.hover),
        rootTriggerProps,
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
        buttonSources.handlers,
      ],
      stateAttributesMapping,
    });
    return element;
  }

  return (
    <TriggerFocusGuards
      active={hasFocusGuards()}
      leadingGuardRef={currentStore().context.beforeTriggerFocusGuardRef}
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
