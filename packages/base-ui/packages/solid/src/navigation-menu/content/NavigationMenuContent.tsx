import { createMemo, createSignal, Match, Switch, untrack } from 'solid-js';
import { Portal } from '@solidjs/web';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { FloatingNode } from '../../floating-ui-solid';
import { contains, getTarget } from '../../floating-ui-solid/utils';
import { splitComponentProps, useRef, createLayoutEffect } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/empty';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps, HTMLProps, UseRenderElementRef } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';

const stateAttributesMapping: StateAttributesMapping<NavigationMenuContent.State> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
  activationDirection(value) {
    if (!value) {
      return null;
    }
    return {
      'data-activation-direction': value,
    };
  },
};

/**
 * A container for the content of the navigation menu item that is moved into the popup
 * when the item is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuContent(componentProps: NavigationMenuContent.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'keepMounted',
    'children',
    'ref',
  ]);
  const keepMounted = () => local.keepMounted ?? false;

  const {
    mounted: popupMounted,
    viewportElement,
    value,
    activationDirection,
    currentContentRef,
    viewportTargetElement,
  } = useNavigationMenuRootContext();
  const { value: itemValue } = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext();

  const open = createMemo(() => popupMounted() && value() === itemValue());

  const ref = useRef<HTMLDivElement | null>(null);

  const [focusInside, setFocusInside] = createSignal(false);

  // If the popup unmounts before the content's exit animation completes, reset the internal
  // mounted state so the next open can re-enter via `transitionStatus="starting"`. React does it
  // with a render-phase update; Solid derives it in the same flush.
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(
    open,
    false,
    false,
    false,
    popupMounted,
  );

  useOpenChangeComplete({
    ref: () => ref.current,
    open,
    onComplete() {
      if (!untrack(open)) {
        setMounted(false);
      }
    },
  });

  // When a content re-enters while still mounted (e.g. switching top-level triggers
  // back before the exit animation completes), the DOM element hasn't changed so the
  // callback ref won't fire again. Ensure the shared ref is updated so the
  // MutationObserver in the trigger watches the correct content element.
  createLayoutEffect(open, (isOpen) => {
    if (isOpen && ref.current) {
      currentContentRef.current = ref.current;
    }
  });

  const state: NavigationMenuContent.State = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get activationDirection() {
      return activationDirection();
    },
  };

  const handleCurrentContentRef = (node: HTMLDivElement | null) => {
    // Inactive `keepMounted` content also mounts in the viewport; only the
    // active content can own the shared sizing observer target.
    if (node && untrack(open)) {
      currentContentRef.current = node;
    }
  };

  const commonProps: HTMLProps<HTMLDivElement> = {
    onFocus(event) {
      const target = getTarget(event) as Element | null;
      if (target?.hasAttribute('data-base-ui-focus-guard')) {
        return;
      }
      setFocusInside(true);
    },
    onBlur(event) {
      if (!contains(event.currentTarget, event.relatedTarget as Element | null)) {
        setFocusInside(false);
      }
    },
  };

  const defaultProps = (): Omit<HTMLProps, 'children'> =>
    !open() && mounted()
      ? {
          style: { position: 'absolute', top: 0, left: 0 },
          inert: !focusInside(),
          ...commonProps,
        }
      : commonProps;

  const portalContainer = () => viewportTargetElement() || viewportElement();
  // Solid: `mounted` lags `open` by a flush, so an opening content is not treated as unmounted.
  const hidden = () => keepMounted() && !open() && !mounted();
  // React latches this state during render once a kept-mounted content has a portal container.
  const hasMountedInPortal = createMemo(
    (previous: boolean | undefined) => previous || (keepMounted() && Boolean(portalContainer())),
  );
  const shouldRenderInline = () => keepMounted() && !portalContainer() && !hasMountedInPortal();

  return (
    <Switch>
      <Match when={shouldRenderInline()}>
        <CompositeRoot
          render={renderProps.render}
          class={renderProps.class}
          state={state}
          refs={[local.ref as UseRenderElementRef<HTMLElement>]}
          props={[defaultProps(), { hidden: true }, elementProps]}
          stateAttributesMapping={stateAttributesMapping}
        >
          {local.children}
        </CompositeRoot>
      </Match>

      {/* Solid: `open` also renders, since `mounted` lags it by a flush. */}
      <Match when={portalContainer() && (open() || mounted() || keepMounted())}>
        <Portal mount={portalContainer() ?? undefined}>
          <FloatingNode id={nodeId?.()}>
            <CompositeRoot
              render={renderProps.render}
              class={renderProps.class}
              state={state}
              refs={[
                local.ref as UseRenderElementRef<HTMLElement>,
                ref as UseRenderElementRef<HTMLElement>,
                handleCurrentContentRef as UseRenderElementRef<HTMLElement>,
              ]}
              props={[defaultProps(), hidden() ? { hidden: true } : EMPTY_OBJECT, elementProps]}
              stateAttributesMapping={stateAttributesMapping}
            >
              {local.children}
            </CompositeRoot>
          </FloatingNode>
        </Portal>
      </Match>
    </Switch>
  );
}

export interface NavigationMenuContentState {
  /**
   * If `true`, the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The direction of the activation.
   */
  activationDirection: 'left' | 'right' | 'up' | 'down' | null;
}

export interface NavigationMenuContentProps extends BaseUIComponentProps<
  'div',
  NavigationMenuContent.State
> {
  /**
   * Whether to keep the content mounted in the DOM while the popup is closed.
   * Ensures the content is present during server-side rendering for web crawlers.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace NavigationMenuContent {
  export type State = NavigationMenuContentState;
  export type Props = NavigationMenuContentProps;
}
