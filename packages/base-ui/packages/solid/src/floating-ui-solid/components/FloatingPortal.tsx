/* eslint-disable typescript/no-explicit-any -- generic render-element bridge, mirrors useRenderElement plumbing */
import {
  createContext,
  createMemo,
  createSignal,
  omit,
  onCleanup,
  Show,
  useContext,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import { isNode } from '@floating-ui/utils/dom';
import type { JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
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
import { createDepsEffect } from '../../solid-helpers';

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
  /** Re-enables tabbing into the portal if leaving it had disabled that. */
  restoreFocusInside: () => void;
} | null>(null);

export const usePortalContext = () => useContext(PortalContext);

const attr = createAttribute('portal');

type PortalContainer = HTMLElement | ShadowRoot | { current: HTMLElement | ShadowRoot | null };

export interface UseFloatingPortalNodeProps {
  container?: PortalContainer | null | undefined;
  componentProps?: useRenderElement.ComponentProps<any, HTMLDivElement> | undefined;
  elementProps?: Record<string, any> | undefined;
}

export interface UseFloatingPortalNodeResult {
  node: Accessor<HTMLElement | null>;
  /**
   * The `id` attribute of the portal node. `id` and `render` props can override or remove the
   * generated id, so this reads the rendered value.
   */
  nodeId: Accessor<string | undefined>;
  subtree: () => JSX.Element;
}

export function useFloatingPortalNode(
  props: UseFloatingPortalNodeProps = {},
): UseFloatingPortalNodeResult {
  const uniqueId = useId();
  const portalContext = usePortalContext();

  // The host clears itself when its container changes or goes away. That disposal can run inside
  // the parent computation that swaps the subtree, so the write is an intentional owned write.
  const [portalNode, setPortalNode] = createSignal<HTMLElement | null>(null, { ownedWrite: true });

  const containerElement = createMemo<HTMLElement | ShadowRoot | null>(() => {
    const containerProp = props.container;
    // Wait for the container to be resolved if explicitly `null`.
    if (containerProp === null) {
      return null;
    }
    const resolvedContainer =
      (containerProp && (isNode(containerProp) ? containerProp : containerProp.current)) ??
      portalContext?.portalNode() ??
      document.body;
    return resolvedContainer ?? null;
  });

  // Children go into the host through the second portal, never through the host element.
  const portalElement = useRenderElement(
    'div',
    omit(
      props.componentProps ?? ({} as NonNullable<UseFloatingPortalNodeProps['componentProps']>),
      'children',
    ),
    {
      ref: (node: Element | null | undefined) => {
        if (node) {
          setPortalNode(node as HTMLElement);
        }
      },
      props: [
        {
          get id() {
            return uniqueId();
          },
          [attr]: '',
        },
        props.elementProps ?? EMPTY_OBJECT,
      ],
    },
  );

  // This `Portal` injects `portalElement` into the container. Another `Portal` inside
  // `FloatingPortal`/`FloatingPortalLite` then injects the children into `portalElement`.
  const subtree = () => (
    <Show when={containerElement()} keyed>
      {(container) => {
        let host: HTMLElement | null = null;
        // Clear only this subtree's host: on a container change Solid mounts the next subtree
        // (and applies its ref) before disposing this one.
        onCleanup(() => setPortalNode((current) => (current === host ? null : current)));
        return (
          <Portal mount={container as HTMLElement}>
            {portalElement({
              ref: (element: HTMLElement) => {
                host = element;
              },
            })}
          </Portal>
        );
      }}
    </Show>
  );

  return {
    node: portalNode,
    nodeId: () => portalNode()?.id || undefined,
    subtree,
  };
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
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'children',
    'container',
    'portalOwnerRole',
    'renderGuards',
    'ref',
  );

  const {
    node: portalNode,
    nodeId: portalNodeId,
    subtree: portalSubtree,
  } = useFloatingPortalNode({
    get container() {
      return componentProps.container;
    },
    componentProps,
    elementProps,
  });

  const [beforeOutsideRef, setBeforeOutsideRef] = createSignal<HTMLSpanElement | null>(null);
  const [afterOutsideRef, setAfterOutsideRef] = createSignal<HTMLSpanElement | null>(null);
  const [beforeInsideRef, setBeforeInsideRef] = createSignal<HTMLSpanElement | null>(null);
  const [afterInsideRef, setAfterInsideRef] = createSignal<HTMLSpanElement | null>(null);

  const [focusManagerState, setFocusManagerState] = createSignal<FocusManagerState>(null, {
    // Focus managers clear it from their unmount cleanup, which can run inside a disposing parent.
    ownedWrite: true,
  });
  let focusInsideDisabledRef = false;

  const modal = () => focusManagerState()?.modal;
  const open = () => focusManagerState()?.open;

  const shouldRenderGuards = createMemo(() => {
    if (typeof componentProps.renderGuards === 'boolean') {
      return componentProps.renderGuards;
    }
    const state = focusManagerState();
    return !!state && !state.modal && state.open && !!portalNode();
  });

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  createDepsEffect(
    () => ({ node: portalNode(), modal: modal() }),
    ({ node, modal: isModal }) => {
      if (!node || isModal) {
        return undefined;
      }

      // Make sure elements inside the portal element are tabbable only when the
      // portal has already been focused, either by tabbing into a focus trap
      // element outside or using the mouse.
      function onFocus(event: FocusEvent) {
        if (node && event.relatedTarget && isOutsideEvent(event)) {
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

      // Listen to the event on the capture phase so they run before the focus
      // trap elements onFocus prop is called.
      node.addEventListener('focusin', onFocus, true);
      node.addEventListener('focusout', onFocus, true);
      return () => {
        node.removeEventListener('focusin', onFocus, true);
        node.removeEventListener('focusout', onFocus, true);
      };
    },
  );

  function restoreFocusInside() {
    const node = untrack(portalNode);
    if (!node || !focusInsideDisabledRef) {
      return;
    }
    enableFocusInside(node);
    focusInsideDisabledRef = false;
  }

  createDepsEffect(
    () => ({ node: portalNode(), open: open() }),
    ({ node, open: isOpen }) => {
      if (node && isOpen === true) {
        // Restore tabbability before the focus manager's queued focus-on-open step runs. Solid: the
        // focus manager also calls this from that step, since `open` reaches this portal through
        // the focus manager's state one flush later.
        restoreFocusInside();
      }
    },
  );

  const portalContextValue = {
    restoreFocusInside,
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
      <PortalContext value={portalContextValue}>
        <Show when={shouldRenderGuards() && portalNode()}>
          <FocusGuard
            data-type="outside"
            ref={setBeforeOutsideRef}
            onFocus={(event) => {
              const node = portalNode();
              if (!node) {
                return;
              }
              if (isOutsideEvent(event, node)) {
                // Solid's `onFocus` is the native non-bubbling `focus` event, which fires before
                // the portal node's capture `focusin` listener re-enables the inside tabbables.
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
        <Show when={shouldRenderGuards() && portalNode()}>
          <span
            role={componentProps.portalOwnerRole}
            aria-owns={portalNodeId()}
            style={ownerVisuallyHidden}
          />
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
              if (!node) {
                return;
              }
              if (isOutsideEvent(event, node)) {
                enableFocusInside(node);
                afterInsideRef()?.focus();
              } else {
                const state = focusManagerState();
                const nextTabbable = getNextTabbable(state?.domReference ?? null);
                nextTabbable?.focus();

                if (state?.closeOnFocusOut) {
                  state.onOpenChange(false, createChangeEventDetails(REASONS.focusOut, event));
                }
              }
            }}
          />
        </Show>
      </PortalContext>
    </>
  );
}

export namespace FloatingPortal {
  export interface Props<State> extends BaseUIComponentProps<'div', State> {
    /**
     * A parent element to render the portal element into.
     */
    container?: UseFloatingPortalNodeProps['container'] | undefined;
    /**
     * @ignore
     * The role for the hidden `aria-owns` owner element.
     */
    portalOwnerRole?: JSX.AriaAttributes['role'] | undefined;
  }
}
