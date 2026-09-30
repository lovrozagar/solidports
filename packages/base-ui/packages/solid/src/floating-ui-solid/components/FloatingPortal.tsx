/* eslint-disable typescript/no-explicit-any -- generic render-element bridge, mirrors useRenderElement plumbing */
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
  splitProps,
  useContext,
  type Accessor,
  type JSX,
  type Ref,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { defaultProps } from '../../solid-helpers';
import { ownerVisuallyHidden } from '../../utils/constants';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { EMPTY_OBJECT } from '../../utils/empty';
import { FocusGuard } from '../../utils/FocusGuard';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useId } from '../../utils/useId';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  disableFocusInside,
  enableFocusInside,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../utils';
import { createAttribute } from '../utils/createAttribute';

type FocusManagerState = null | {
  modal: boolean;
  open: boolean;
  onOpenChange(
    open: boolean,
    data?: { reason?: string | undefined; event?: Event | undefined },
  ): void;
  domReference: Element | null | undefined;
  closeOnFocusOut: boolean;
};

const PortalContext = createContext<{
  portalNode: Accessor<HTMLElement | null | undefined>;
  setFocusManagerState: (state: FocusManagerState | null | undefined) => void;
  beforeInsideRef: Accessor<HTMLSpanElement | null | undefined>;
  setBeforeInsideRef: (el: HTMLSpanElement | null | undefined) => void;
  afterInsideRef: Accessor<HTMLSpanElement | null | undefined>;
  setAfterInsideRef: (el: HTMLSpanElement | null | undefined) => void;
  beforeOutsideRef: Accessor<HTMLSpanElement | null | undefined>;
  setBeforeOutsideRef: (el: HTMLSpanElement | null | undefined) => void;
  afterOutsideRef: Accessor<HTMLSpanElement | null | undefined>;
  setAfterOutsideRef: (el: HTMLSpanElement | null | undefined) => void;
}>();

export const usePortalContext = () => useContext(PortalContext);

const attr = createAttribute('portal');

export interface UseFloatingPortalNodeProps {
  ref?: Ref<HTMLDivElement> | undefined;
  container?: (HTMLElement | ShadowRoot | null) | undefined;
  componentProps?: useRenderElement.ComponentProps<any, any> | undefined;
  elementProps?: useRenderElement.ComponentProps<any, HTMLDivElement> | undefined;
}

export interface UseFloatingPortalNodeResult {
  portalNode: Accessor<HTMLElement | null>;
  portalSubtree: Accessor<JSX.Element | null>;
}

/**
 * @see https://floating-ui.com/docs/FloatingPortal#usefloatingportalnode
 */
export function useFloatingPortalNode(
  componentProps: UseFloatingPortalNodeProps = {},
): UseFloatingPortalNodeResult {
  const props = defaultProps(componentProps, { componentProps: EMPTY_OBJECT });
  const uniqueId = useId();
  const portalContext = usePortalContext();

  const [portalNode, setPortalNode] = createSignal<HTMLElement | null>(null);

  const containerElement = createMemo(
    () => props.container ?? portalContext?.portalNode() ?? document.body,
  );

  const portalElement = useRenderElement('div', props.componentProps, {
    get props() {
      return [
        {
          id: uniqueId(),
          [attr]: '',
        },
        props.elementProps as any,
      ];
    },
    ref: (el: HTMLDivElement | null | undefined) => {
      setPortalNode(el ?? null);
      if (typeof props.ref === 'function') {
        (props.ref as (el: HTMLDivElement | null | undefined) => void)(el);
      } else if (
        props.ref !== null &&
        props.ref !== undefined &&
        typeof props.ref === 'object' &&
        'current' in props.ref
      ) {
        (props.ref as { current: unknown }).current = el;
      }
    },
  });

  const portalSubtree = createMemo(() => {
    const container = containerElement();
    if (!container) {
      return null;
    }
    return <Portal mount={container}>{portalElement()}</Portal>;
  });

  return { portalNode, portalSubtree };
}

/**
 * Portals the floating element into a given container element — by default,
 * outside of the app root and into the body.
 * This is necessary to ensure the floating element can appear outside any
 * potential parent containers that cause clipping (such as `overflow: hidden`),
 * while retaining its location in the React tree.
 * @see https://floating-ui.com/docs/FloatingPortal
 * @internal
 */
export function FloatingPortal(
  componentProps: FloatingPortal.Props<any> & { renderGuards?: boolean | undefined },
): JSX.Element {
  const [local, , elementProps] = splitProps(
    componentProps,
    ['container', 'class', 'render', 'renderGuards'],
    ['children'],
  );

  const { portalNode, portalSubtree } = useFloatingPortalNode({
    componentProps: local,
    get container() {
      return local.container;
    },
    elementProps: elementProps as any,
    ref: (el) => {
      if (typeof componentProps.ref === 'function') {
        componentProps.ref(el);
      } else if (
        componentProps.ref !== null &&
        componentProps.ref !== undefined &&
        typeof componentProps.ref === 'object' &&
        'current' in componentProps.ref
      ) {
        (componentProps.ref as { current: unknown }).current = el;
      }
    },
  });
  const [beforeOutsideRef, setBeforeOutsideRef] = createSignal<HTMLSpanElement | null>(null);
  const [afterOutsideRef, setAfterOutsideRef] = createSignal<HTMLSpanElement | null>(null);
  const [beforeInsideRef, setBeforeInsideRef] = createSignal<HTMLSpanElement | null>(null);
  const [afterInsideRef, setAfterInsideRef] = createSignal<HTMLSpanElement | null>(null);

  const [focusManagerState, setFocusManagerState] = createSignal<FocusManagerState>(null);

  let focusInsideDisabledRef = false;

  // Make sure elements inside the portal element are tabbable only when the
  // portal has already been focused, either by tabbing into a focus trap
  // element outside or using the mouse.
  function onFocus(event: FocusEvent) {
    const node = portalNode();
    if (node && event.relatedTarget && isOutsideEvent(event, node)) {
      if (event.type === 'focusin') {
        if (focusInsideDisabledRef) {
          enableFocusInside(node);
          focusInsideDisabledRef = false;
        }
      } else {
        disableFocusInside(node);
        focusInsideDisabledRef = true;
      }
    }
  }

  const shouldRenderGuards = createMemo(() => {
    if (typeof local.renderGuards === 'boolean') {
      return local.renderGuards;
    }
    const fms = focusManagerState();
    return !!fms && !fms.modal && fms.open && !!portalNode();
  });

  createEffect(() => {
    const node = portalNode();
    if (!node || focusManagerState()?.modal) {
      return;
    }

    // Listen to the event on the capture phase so they run before the focus
    // trap elements onFocus prop is called.
    node.addEventListener('focusin', onFocus, true);
    node.addEventListener('focusout', onFocus, true);
    onCleanup(() => {
      node.removeEventListener('focusin', onFocus, true);
      node.removeEventListener('focusout', onFocus, true);
    });
  });

  createEffect(() => {
    const node = portalNode();
    if (!node) {
      return;
    }

    if (focusManagerState()?.open !== false) {
      return;
    }

    enableFocusInside(node);
    focusInsideDisabledRef = false;
  });

  const portalContextValue = {
    afterInsideRef,
    afterOutsideRef,
    beforeInsideRef,
    beforeOutsideRef,
    portalNode,
    setAfterInsideRef,
    setAfterOutsideRef,
    setBeforeInsideRef,
    setBeforeOutsideRef,
    setFocusManagerState,
  };

  return (
    <>
      {portalSubtree()}
      <PortalContext.Provider value={portalContextValue}>
        <Show when={shouldRenderGuards() && portalNode()}>
          <FocusGuard
            data-type="outside"
            ref={setBeforeOutsideRef}
            onFocus={(event) => {
              const node = portalNode();
              if (!node) return;
              if (isOutsideEvent(event, node)) {
                /* In Solid, `onFocus` maps to the non-bubbling native `focus` event, which fires
                   before `focusin`. The portal node's capture `focusin` listener calls
                   `enableFocusInside` too late relative to the inside guard's `onFocus` handler.
                   Explicitly re-enable here so the inside guard's tabbable search works correctly. */
                enableFocusInside(node);
                beforeInsideRef()?.focus();
              } else {
                const domReference = focusManagerState()?.domReference ?? null;
                const prevTabbable = getPreviousTabbable(domReference);
                prevTabbable?.focus();
              }
            }}
          />
        </Show>

        <Show when={shouldRenderGuards() && portalNode()} keyed>
          {(node) => <span aria-owns={node.id} style={ownerVisuallyHidden} />}
        </Show>

        <Show when={portalNode()} keyed>
          {(node) => <Portal mount={node}>{componentProps.children}</Portal>}
        </Show>

        <Show when={shouldRenderGuards() && portalNode()}>
          <FocusGuard
            data-type="outside"
            ref={setAfterOutsideRef}
            onFocus={(event) => {
              const node = portalNode();
              if (!node) return;
              if (isOutsideEvent(event, node)) {
                enableFocusInside(node);
                afterInsideRef()?.focus();
              } else {
                const domReference = focusManagerState()?.domReference ?? null;
                const nextTabbable = getNextTabbable(domReference);
                nextTabbable?.focus();

                if (focusManagerState()?.closeOnFocusOut) {
                  focusManagerState()?.onOpenChange(
                    false,
                    createChangeEventDetails(REASONS.focusOut, event),
                  );
                }
              }
            }}
          />
        </Show>
      </PortalContext.Provider>
    </>
  );
}

export namespace FloatingPortal {
  export interface Props<State> extends BaseUIComponentProps<'div', State> {
    /**
     * A parent element to render the portal element into.
     */
    container?: UseFloatingPortalNodeProps['container'] | undefined;
  }
}
