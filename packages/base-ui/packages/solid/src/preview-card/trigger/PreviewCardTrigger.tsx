import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { safePolygon, useFocus, useHoverReferenceInteraction } from '../../floating-ui-solid';
import { live, splitComponentProps } from '../../solid-helpers';
import type { ReactLikeRef } from '../../solid-helpers';
import {
  getInlineRectTriggerProps,
  usePopupHandleStore,
  useTriggerDataForwarding,
  useTriggerInteractions,
} from '../../utils/popups';
import {
  CommonTriggerDataAttributes,
  triggerOpenStateMapping,
} from '../../utils/popupStateMapping';
import type { BaseUIComponentProps, BaseUIEvent, HTMLProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { canRenderNative, partHandler, readHandler } from '../../utils/native';
import type { Dispatch } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { PreviewCardHandle } from '../store/PreviewCardHandle';
import type { PreviewCardHandleStore } from '../store/PreviewCardStore';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';

/** Props the native path reads once, as the slow path does. */
const NATIVE_STATIC_KEYS = ['handle'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['delay', 'closeDelay', 'id', 'payload', 'handle']);

/**
 * A native trigger's model: the target of its module-level handlers and attribute write. Its
 * handler sources in the slow path's `mergeProps` order below the consumer's: the inline-rect
 * handlers, the root's trigger props (dismissal), then focus and hover once the interactions exist.
 * One object per trigger.
 */
class NativePreviewCardTriggerModel implements PreviewCardTrigger.State {
  declare readonly isOpen: () => boolean;
  declare readonly id: () => string | undefined;
  declare private readonly sources: ReadonlyArray<() => object | undefined>;

  constructor(
    isOpen: () => boolean,
    id: () => string | undefined,
    sources: ReadonlyArray<() => object | undefined>,
  ) {
    this.isOpen = isOpen;
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

const dispatchSources = (key: string) => (trigger: NativePreviewCardTriggerModel, event: Event) =>
  trigger.dispatch(key, event as BaseUIEvent<Event>);

/**
 * A native trigger's handlers, created once: the consumer's handler, then the trigger's sources.
 * The keys are every handler the sources can carry: inline rect (`onFocus`, `onMouseEnter`,
 * `onMouseMove`), dismissal (`onKeyDown`, `onPointerDown`, `onClick`), focus (`onFocus`, `onBlur`,
 * `onMouseLeave`) and hover (`onMouseMove`, `onPointerDown`, `onPointerEnter`).
 */
const TRIGGER_HANDLERS: Readonly<Record<string, Dispatch<NativePreviewCardTriggerModel>>> =
  Object.fromEntries(
    [
      'onClick',
      'onPointerDown',
      'onPointerEnter',
      'onKeyDown',
      'onMouseEnter',
      'onMouseMove',
      'onMouseLeave',
      'onFocus',
      'onBlur',
    ].map((key) => [key, partHandler(key, dispatchSources(key))]),
  );

/** The trigger's own attributes below the consumer's: one write per pass. */
function writeTriggerAttributes(w: SetAttribute, trigger: NativePreviewCardTriggerModel) {
  w.set('id', trigger.id());
  // `triggerOpenStateMapping`.
  w.set(CommonTriggerDataAttributes.popupOpen, trigger.isOpen() ? '' : undefined);
}

/** No state attribute of its own: `data-popup-open` is written with the attributes. */
const writeTriggerState = compileStateWriter([], undefined);

const triggerState = (trigger: NativePreviewCardTriggerModel) => trigger;
const constant =
  <T,>(value: T) =>
  () =>
    value;

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardTrigger<Payload>(componentProps: PreviewCardTrigger.Props<Payload>) {
  // Native fast path (`context/architecture/render-pipeline.md`): a root's own trigger (no detached
  // handle) renders with direct JSX; the props chain is inlined (D32).
  const native =
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    untrack(() => componentProps.handle == null);
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'delay',
    'closeDelay',
    'id',
    'payload',
    'handle',
  ]);
  const idProp = () => local.id;

  const rootContext = usePreviewCardRootContext(true);
  const handleStore = usePopupHandleStore(() => local.handle);
  const store = createMemo(
    () => (handleStore() ?? rootContext?.store) as PreviewCardHandleStore<unknown> | undefined,
  );
  if (!untrack(store)) {
    throw new Error(
      'Base UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.',
    );
  }
  // Live: handlers, refs and effect callbacks read the latest store imperatively.
  const currentStore = live(() => store()!);

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = () => currentStore().select('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = () => currentStore().select('isOpenedByTrigger', thisTriggerId);
  const floatingRootContext = () => currentStore().context.floatingRootContext;
  const inlineRectCoordsRef = () => currentStore().context.inlineRectCoordsRef;

  const triggerElementRef: ReactLikeRef<Element | null> = { current: null };
  // Solid: a signal as well, so the hover hook re-attaches its listeners once the element exists.
  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);

  const delayWithDefault = () => local.delay ?? OPEN_DELAY;
  const closeDelayWithDefault = () => local.closeDelay ?? CLOSE_DELAY;

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    currentStore,
    {
      get payload() {
        return local.payload;
      },
      get closeDelay() {
        return closeDelayWithDefault();
      },
    },
  );

  // A closed trigger renders only its element: the hover and focus interactions are created on the
  // first intent, or when this trigger's card opens or mounts by other means, and are kept
  // afterwards. React mounts these hooks up front; their closed-state output is handlers only.
  const interactions = useTriggerInteractions(
    () => {
      const hoverProps = useHoverReferenceInteraction({
        get context() {
          return floatingRootContext();
        },
        props: {
          mouseOnly: true,
          move: false,
          handleClose: safePolygon(),
          delay: () => ({ open: untrack(delayWithDefault), close: untrack(closeDelayWithDefault) }),
          get triggerElementRef() {
            return triggerElement();
          },
          get isActiveTrigger() {
            return isTriggerActive();
          },
          isClosing: () => currentStore().select('transitionStatus') === 'ending',
        },
      });

      const focusProps = useFocus({
        get context() {
          return floatingRootContext();
        },
        props: {
          get delay() {
            return delayWithDefault();
          },
        },
      });
      return { hoverProps, focusProps };
    },
    triggerElement,
    () => isOpenedByThisTrigger() || isMountedByThisTrigger(),
  );

  const rootTriggerProps = () => currentStore().select('triggerProps', isMountedByThisTrigger);
  // Built once: the handlers read the open state when they fire (`getInlineRectTriggerProps`).
  const inlineRectTriggerProps = getInlineRectTriggerProps(
    inlineRectCoordsRef,
    isOpenedByThisTrigger,
  ) as HTMLProps;
  const setRefs = (el: Element | null) => {
    triggerElementRef.current = el;
    registerTrigger(el);
    setTriggerElement(el);
  };

  // The native element is created once, here, under the trigger's owner.
  const element: () => JSX.Element = native ? constant(nativeElement()) : slowElement();

  function nativeElement() {
    const model = new NativePreviewCardTriggerModel(isOpenedByThisTrigger, thisTriggerId, [
      () => inlineRectTriggerProps,
      rootTriggerProps,
      () => interactions()?.focusProps.reference,
      () => interactions()?.hoverProps,
    ]);
    // eslint-disable-next-line jsx-a11y/anchor-is-valid -- the template link gets the consumer's `href` and children
    const el = (<a />) as unknown as HTMLAnchorElement;
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
    const state: PreviewCardTrigger.State = {
      get open() {
        return isOpenedByThisTrigger();
      },
    };

    // Read per key by the element props: a change does not rebuild the props chain.
    const rootTriggerSource = propsSourceAccessor(() => rootTriggerProps());
    return useRenderElement('a', componentProps, {
      state,
      ref: setRefs,
      props: [
        propsSourceAccessor(() => interactions()?.hoverProps),
        propsSourceAccessor(() => interactions()?.focusProps.reference as HTMLProps | undefined),
        rootTriggerSource,
        inlineRectTriggerProps,
        {
          get id() {
            return thisTriggerId();
          },
        },
        elementProps,
      ],
      stateAttributesMapping: triggerOpenStateMapping,
    });
  }

  return element();
}

export interface PreviewCardTriggerState {
  /**
   * Whether the preview card is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PreviewCardTriggerProps<Payload = unknown> extends BaseUIComponentProps<
  'a',
  PreviewCardTrigger.State,
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>
> {
  /**
   * A handle to associate the trigger with a preview card.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * A payload to pass to the preview card when it is opened.
   */
  // Inferred from `handle` (React gets this from method bivariance), so the payload must match it.
  payload?: NoInfer<Payload> | undefined;
  /**
   * How long to wait before the preview card opens. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the preview card. Specified in milliseconds.
   * @default 300
   */
  closeDelay?: number | undefined;
}

export namespace PreviewCardTrigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown> = PreviewCardTriggerProps<Payload>;
}
