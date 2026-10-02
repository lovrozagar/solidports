/* eslint-disable typescript/no-explicit-any -- ref forwarding + Solid relatedTarget Element bridge */
import { createTrackedEffect, createEffect, createSignal, Match, Switch } from 'solid-js';
import { Portal } from '@solidjs/web';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { FloatingNode } from '../../floating-ui-solid';
import { contains, getTarget } from '../../floating-ui-solid/utils';
import { splitComponentProps } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/empty';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { on } from '../../solid-1-compat';

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

  const open = () => popupMounted() && value() === itemValue();

  let ref = null as HTMLDivElement | null | undefined;

  const [hasMountedInPortal, setHasMountedInPortal] = createSignal(false);
  const [focusInside, setFocusInside] = createSignal(false);

  const { transitionStatus, setMounted, mounted } = useTransitionStatus(open);

  // If the popup unmounts before the content's exit animation completes, reset the internal
  // mounted state so the next open can re-enter via `transitionStatus="starting"`.
  createEffect(...on([mounted, popupMounted], ([mountedValue, popupMountedValue]) => {
      if (mountedValue && !popupMountedValue) {
        setMounted(false);
      }
    }),
  );

  useOpenChangeComplete({
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
    open,
    ref: () => ref,
  });

  const state: NavigationMenuContent.State = {
    get activationDirection() {
      return activationDirection();
    },
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const handleCurrentContentRef = (node: HTMLDivElement | null | undefined) => {
    if (node) {
      currentContentRef.current = node;
    }
  };

  const commonProps: HTMLProps<HTMLDivElement> = {
    onBlur(event) {
      if (!contains(event.currentTarget, event.relatedTarget as any)) {
        setFocusInside(false);
      }
    },
    onFocus(event) {
      const target = getTarget(event) as Element | null;
      if (target?.hasAttribute('data-base-ui-focus-guard')) {
        return;
      }
      setFocusInside(true);
    },
  };

  const defaultProps = {
    get props(): HTMLProps {
      return !open() && mounted()
        ? {
            inert: !focusInside(),
            style: { left: 0, position: 'absolute', top: 0 },
            ...commonProps,
          }
        : commonProps;
    },
  };

  const portalContainer = () => viewportTargetElement() || viewportElement();
  const hidden = () => keepMounted() && !open() && !mounted();
  const shouldRenderInline = () => keepMounted() && !portalContainer() && !hasMountedInPortal();

  createTrackedEffect(() => {
    if (keepMounted() && portalContainer() && !hasMountedInPortal()) {
      setHasMountedInPortal(true);
    }
  });

  return (
    <Switch>
      <Match when={shouldRenderInline()}>
        <CompositeRoot
          render={renderProps.render}
          class={renderProps.class}
          state={state}
          refs={[
            (el) => {
              if (typeof componentProps.ref === 'function') {
                componentProps.ref(el as HTMLDivElement);
              } else {
                // eslint-disable-next-line solid/reactivity
                componentProps.ref = el as any;
              }
            },
          ]}
          props={[defaultProps, { hidden: true }, elementProps]}
          stateAttributesMapping={stateAttributesMapping}
        >
          {local.children}
        </CompositeRoot>
      </Match>

      <Match when={portalContainer() && (open() || mounted() || keepMounted())}>
        <Portal mount={portalContainer() ?? document.body}>
          <FloatingNode id={nodeId?.()}>
            <CompositeRoot
              render={renderProps.render}
              class={renderProps.class}
              state={state}
              refs={[
                (el) => {
                  if (typeof componentProps.ref === 'function') {
                    componentProps.ref(el as HTMLDivElement);
                  } else {
                    // eslint-disable-next-line solid/reactivity
                    componentProps.ref = el as any;
                  }
                  ref = el as HTMLDivElement;
                  handleCurrentContentRef(el as HTMLDivElement);
                },
              ]}
              props={[defaultProps.props, hidden() ? { hidden: true } : EMPTY_OBJECT, elementProps]}
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
