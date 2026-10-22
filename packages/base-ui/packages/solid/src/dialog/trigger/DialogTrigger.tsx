import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useClick } from '../../floating-ui-solid';
import { omitComponentProps } from '../../solid-helpers';
import type { ReactLikeRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import { CLICK_TRIGGER_IDENTIFIER } from '../../utils/constants';
import {
  usePopupHandleStore,
  useTriggerDataForwarding,
  useTriggerInteractions,
} from '../../utils/popups';
import {
  CommonTriggerDataAttributes,
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
import { useDialogRootContext } from '../root/DialogRootContext';
import type { DialogHandle } from '../store/DialogHandle';
import type { DialogHandleStore } from '../store/DialogStore';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton', 'handle'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'disabled',
  'nativeButton',
  'id',
  'payload',
  'handle',
]);
const TRIGGER_LITERALS: Record<string, unknown> = {
  [CLICK_TRIGGER_IDENTIFIER as string]: '',
  'aria-haspopup': 'dialog',
  // `useFocusableWhenDisabled` for a native button outside a composite.
  tabindex: 0,
};

/**
 * A native trigger's model: the target of its module-level handlers and attribute write. Its
 * handler sources in the slow path's `mergeProps` order below the consumer's: the open-method
 * props, the root's trigger props (dismissal), then click once the interactions exist. One object
 * per trigger.
 */
class NativeDialogTriggerModel implements DialogTrigger.State {
  declare private readonly disabledAccessor: () => boolean;
  declare readonly isOpen: () => boolean;
  declare readonly id: () => string | undefined;
  declare readonly popupId: () => string | undefined;
  declare private readonly sources: ReadonlyArray<() => object | undefined>;

  constructor(
    disabled: () => boolean,
    isOpen: () => boolean,
    id: () => string | undefined,
    popupId: () => string | undefined,
    sources: ReadonlyArray<() => object | undefined>,
  ) {
    this.disabledAccessor = disabled;
    this.isOpen = isOpen;
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
function preventWhileDisabled(trigger: NativeDialogTriggerModel, event: Event) {
  if (trigger.disabled) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (trigger: NativeDialogTriggerModel) => !trigger.disabled;

const dispatchSources = (key: string) => (trigger: NativeDialogTriggerModel, event: Event) =>
  trigger.dispatch(key, event as BaseUIEvent<Event>);

/**
 * A native trigger's handlers, created once: `useButton`'s gates for a native button, then the
 * consumer's handler, then the trigger's sources (`dispatch`). The keys are every handler the
 * sources carry: open method (`onClick`, `onPointerDown`), dismissal (`onKeyDown`, `onClick`) and
 * click (`onPointerDown`, `onMouseDown`, `onClick`, `onKeyDown`).
 */
const TRIGGER_HANDLERS: Readonly<Record<string, Dispatch<NativeDialogTriggerModel>>> = {
  onClick: partHandler('onClick', dispatchSources('onClick'), preventWhileDisabled),
  onPointerDown: partHandler(
    'onPointerDown',
    dispatchSources('onPointerDown'),
    preventWhileDisabled,
  ),
  onMouseDown: partHandler('onMouseDown', dispatchSources('onMouseDown'), runWhileEnabled),
  onKeyDown: partHandler('onKeyDown', dispatchSources('onKeyDown'), runWhileEnabled),
};

/** Bound only when the consumer passes it: `useButton`'s gate around the consumer's keyup. */
const TRIGGER_HANDLERS_IF_PASSED: Readonly<Record<string, Dispatch<NativeDialogTriggerModel>>> = {
  onKeyUp: partHandler('onKeyUp', undefined, runWhileEnabled),
};

const writeTriggerState = compileStateWriter(['disabled'], undefined);

/** The trigger's own attributes below the consumer's: one write per pass. */
function writeTriggerAttributes(w: SetAttribute, trigger: NativeDialogTriggerModel) {
  const open = trigger.isOpen();
  w.set('id', trigger.id());
  w.set('aria-expanded', open ? 'true' : 'false');
  w.set('aria-controls', trigger.popupId());
  // `useFocusableWhenDisabled` for a native button that is not focusable when disabled.
  w.set('disabled', trigger.disabled ? true : undefined);
  // `triggerOpenStateMapping`.
  w.set(CommonTriggerDataAttributes.popupOpen, open ? '' : undefined);
}

const triggerState = (trigger: NativeDialogTriggerModel) => trigger;
const constant =
  <T,>(value: T) =>
  () =>
    value;

/**
 * A button that opens the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogTrigger<Payload>(componentProps: DialogTrigger.Props<Payload>) {
  // Native fast path (`context/architecture/render-pipeline.md`): a root's own `<button>` trigger
  // (no detached handle) renders with direct JSX; `useButton` and the props chain inlined (D32).
  const native =
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.handle == null && (componentProps.nativeButton ?? true));

  const disabled = () => Boolean(componentProps.disabled);
  const nativeButton = () => componentProps.nativeButton ?? true;

  const dialogRootStore = useDialogRootContext(true);
  // The handle is read once: a trigger keeps the handle it mounted with.
  const handleStore = usePopupHandleStore(() => componentProps.handle);
  const store = (): DialogHandleStore<unknown> =>
    (handleStore() ?? dialogRootStore) as DialogHandleStore<unknown>;
  if (!untrack(() => handleStore() ?? dialogRootStore)) {
    throw new Error(
      'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(() => componentProps.id);
  const isOpenedByThisTrigger = createMemo(() =>
    store().select('isOpenedByTrigger', thisTriggerId),
  );
  const popupId = createMemo(() => store().select('triggerPopupId', thisTriggerId));

  const triggerElementRef: ReactLikeRef<HTMLElement | null> = { current: null };
  // Solid: a signal as well, so the deferred click's intent listener attaches once it exists.
  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null);

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      get payload() {
        return componentProps.payload;
      },
    },
  );

  // A closed trigger renders handlers only: click is created on the trigger's first intent (in the
  // capture phase before its own listeners, so the press finds it ready), or once this trigger
  // opens or mounts the dialog, and is kept afterwards (D32, as Popover does). React mounts it up
  // front.
  const interactions = useTriggerInteractions(
    () =>
      useClick({
        get context() {
          return store().context.floatingRootContext;
        },
      }),
    triggerElement,
    () => isOpenedByThisTrigger() || isMountedByThisTrigger(),
  );
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => store().select('open'),
    (interactionType) => {
      untrack(store).set('openMethod', interactionType);
    },
  );
  const interactionProps = {
    onClick: interactionTypeProps.onClick,
    onPointerDown: interactionTypeProps.onPointerDown,
  };
  const rootTriggerProps = () => store().select('triggerProps', isMountedByThisTrigger);

  const setRefs = (el: HTMLElement | null) => {
    triggerElementRef.current = el;
    registerTrigger(el);
    setTriggerElement(el);
  };

  // The native element is created once, here, under the trigger's owner.
  const element: () => JSX.Element = native ? constant(nativeElement()) : slowElement();

  function nativeElement() {
    const model = new NativeDialogTriggerModel(
      disabled,
      isOpenedByThisTrigger,
      thisTriggerId,
      popupId,
      [() => interactionProps, rootTriggerProps, () => interactions()?.reference],
    );
    // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
    const el = (<button type="button" />) as unknown as HTMLButtonElement;
    return renderNativeElement(el, componentProps, {
      own: OWN_KEYS,
      state: triggerState,
      stateWriter: writeTriggerState,
      stateView: model,
      reactive: true,
      literal: TRIGGER_LITERALS,
      attributes: writeTriggerAttributes,
      handlers: TRIGGER_HANDLERS,
      handlersIfPassed: TRIGGER_HANDLERS_IF_PASSED,
      handlerTarget: model,
      refs: [setRefs],
    }) as unknown as JSX.Element;
  }

  function slowElement() {
    const elementProps = omitComponentProps(componentProps, [
      'disabled',
      'nativeButton',
      'id',
      'payload',
      'handle',
    ] as const);
    const { buttonSources, buttonRef } = useButton({
      disabled,
      native: nativeButton,
    });

    const state: DialogTriggerState = {
      get disabled() {
        return disabled();
      },
      get open() {
        return isOpenedByThisTrigger();
      },
    };

    // Sources the element props read per key: a state change updates its attribute without
    // rebuilding the element's props chain.
    const rootTriggerSource = propsSourceAccessor(createMemo(rootTriggerProps));
    const triggerProps = {
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
    };

    return useRenderElement('button', componentProps, {
      state,
      ref: [buttonRef, setRefs],
      props: [
        ...buttonSources.attributes,
        propsSourceAccessor(() => interactions()?.reference),
        rootTriggerSource,
        interactionProps,
        triggerProps,
        elementProps,
        buttonSources.handlers,
      ],
      stateAttributesMapping: triggerOpenStateMapping,
    });
  }

  return element();
}

export interface DialogTriggerProps<Payload = unknown>
  extends NativeButtonProps, BaseUIComponentProps<'button', DialogTriggerState> {
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  // Inferred from `handle` (React gets this from method bivariance), so the payload must match it.
  payload?: NoInfer<Payload> | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the dialog in controlled mode (with the DialogRoot `triggerId` prop).
   */
  id?: string | undefined;
}

export interface DialogTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the dialog is currently open and was opened by this trigger.
   */
  open: boolean;
}

export namespace DialogTrigger {
  export type Props<Payload = unknown> = DialogTriggerProps<Payload>;
  export type State = DialogTriggerState;
}
