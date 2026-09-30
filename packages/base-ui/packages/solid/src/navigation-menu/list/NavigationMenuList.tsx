/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, Show } from 'solid-js';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { useDismiss, useHoverFloatingInteraction } from '../../floating-ui-solid';
import { contains, getTarget } from '../../floating-ui-solid/utils';
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import { splitComponentProps } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/constants';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { NavigationMenuDismissContext } from './NavigationMenuDismissContext';

/**
 * Contains a list of navigation menu items.
 * Renders a `<ul>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuList(componentProps: NavigationMenuList.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, ['children']);

  const {
    orientation,
    open,
    floatingRootContext,
    positionerElement,
    popupElement,
    value,
    closeDelay,
    viewportElement,
    nested,
  } = useNavigationMenuRootContext();

  const nodeId = useNavigationMenuTreeContext();

  const fallbackContext = createMemo(() => getEmptyRootContext());
  const context = () => floatingRootContext() || fallbackContext();
  const interactionsEnabled = () => (positionerElement() ? true : !value());
  const hoverInteractionsEnabled = () =>
    positionerElement() || viewportElement() ? true : !value();

  useHoverFloatingInteraction({
    get context() {
      return context();
    },
    parameters: {
      get closeDelay() {
        return closeDelay();
      },
      get enabled() {
        return Boolean(floatingRootContext()) && hoverInteractionsEnabled();
      },
      get nodeId() {
        return nodeId?.();
      },
    },
  });

  const dismiss = useDismiss({
    get context() {
      return context();
    },
    props: {
      get enabled() {
        return interactionsEnabled();
      },
      outsidePress(event) {
        const target = getTarget(event) as HTMLElement | null;
        if (contains(positionerElement(), target) || contains(popupElement(), target)) {
          return false;
        }
        // Keep the menu open while interacting with nested dialogs rendered in a portal.
        if (target?.closest('[role="dialog"], [role="alertdialog"]')) {
          return false;
        }
        const closestNavigationMenuTrigger = target?.closest(
          `[${NAVIGATION_MENU_TRIGGER_IDENTIFIER}]`,
        );
        return closestNavigationMenuTrigger === null;
      },
      outsidePressEvent: 'intentional',
    },
  });

  const dismissProps = {
    get props() {
      return floatingRootContext() ? dismiss : undefined;
    },
  };

  const state: NavigationMenuList.State = {
    get open() {
      return open();
    },
  };

  // `stopEventPropagation` won't stop the propagation if the end of the list is reached,
  // but we want to block it in this case.
  // When nested, skip this handler so arrow keys can reach the parent CompositeRoot.
  const defaultProps: HTMLProps = {
    get onKeyDown() {
      if (nested()) {
        return undefined;
      }

      return (event: KeyboardEvent) => {
        const shouldStop =
          (orientation() === 'horizontal' &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) ||
          (orientation() === 'vertical' && (event.key === 'ArrowUp' || event.key === 'ArrowDown'));

        if (shouldStop) {
          event.stopPropagation();
        }
      };
    },
  };

  const props = {
    get props() {
      return [dismissProps.props?.floating || EMPTY_OBJECT, defaultProps, elementProps];
    },
  };

  // When nested, skip the CompositeRoot wrapper so that triggers can participate
  // in the parent Content's composite navigation context. Also skip the onKeyDown
  // handler that blocks propagation so arrow keys can reach the parent CompositeRoot.
  const element = useRenderElement('ul', componentProps, {
    enabled: nested,
    props: props.props,
    state,
  });

  return (
    <Show
      when={!nested()}
      fallback={
        <NavigationMenuDismissContext.Provider value={dismissProps.props}>
          {element()}
        </NavigationMenuDismissContext.Provider>
      }
    >
      <NavigationMenuDismissContext.Provider value={dismissProps.props}>
        <CompositeRoot
          render={renderProps.render}
          class={renderProps.class}
          state={state}
          refs={[
            (el) => {
              if (typeof componentProps.ref === 'function') {
                componentProps.ref(el as HTMLUListElement);
              } else {
                // eslint-disable-next-line solid/reactivity
                componentProps.ref = el as any;
              }
            },
          ]}
          props={props.props}
          loopFocus={false}
          orientation={orientation()}
          tag="ul"
        >
          {local.children}
        </CompositeRoot>
      </NavigationMenuDismissContext.Provider>
    </Show>
  );
}

export interface NavigationMenuListState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
}

export interface NavigationMenuListProps extends BaseUIComponentProps<
  'ul',
  NavigationMenuList.State
> {}

export namespace NavigationMenuList {
  export type State = NavigationMenuListState;
  export type Props = NavigationMenuListProps;
}
