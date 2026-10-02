import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { usePopupViewport } from '../../utils/usePopupViewport';
import { useRenderElement } from '../../utils/useRenderElement';
import type { BaseUIComponentProps } from '../../utils/types';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuViewportCssVars } from './MenuViewportCssVars';

const stateAttributesMapping: StateAttributesMapping<MenuViewport.State> = {
  activationDirection: (value) =>
    value
      ? {
          'data-activation-direction': value,
        }
      : null,
};

/**
 * A viewport for displaying content transitions.
 * Only required when one popup can be opened by multiple triggers, its content changes based on the trigger,
 * and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuViewport(componentProps: MenuViewport.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['children']);

  const { store } = useMenuRootContext();
  const { side } = useMenuPositionerContext();

  const instantType = store.useState('instantType');

  const { children: childrenToRender, state: viewportState } = usePopupViewport({
    get children() {
      return local.children;
    },
    cssVars: MenuViewportCssVars,
    get side() { return side(); },
    store,
  });

  const state: MenuViewport.State = {
    get activationDirection() {
      return viewportState.activationDirection;
    },
    get instant() {
      return instantType();
    },
    get transitioning() {
      return viewportState.transitioning;
    },
  };

  return useRenderElement('div', componentProps, {
    get props() {
      return [elementProps, { get children() { return childrenToRender; } }];
    },
    state,
    stateAttributesMapping,
  });
}

export interface MenuViewportState {
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
}

export interface MenuViewportProps extends BaseUIComponentProps<'div', MenuViewport.State> {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element;
}

export namespace MenuViewport {
  export type State = MenuViewportState;
  export type Props = MenuViewportProps;
}
