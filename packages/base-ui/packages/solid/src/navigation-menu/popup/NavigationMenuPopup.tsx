import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDirection } from '../../direction-provider/DirectionContext';
import { splitComponentProps } from '../../solid-helpers';
import { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import { Align, Side } from '../../utils/useAnchorPositioning';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';

const stateAttributesMapping: StateAttributesMapping<NavigationMenuPopup.State> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the navigation menu contents.
 * Renders a `<nav>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuPopup(componentProps: NavigationMenuPopup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id']);
  const idProp = () => local.id;

  const { open, transitionStatus, setPopupElement } = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();
  const direction = useDirection();

  const id = useBaseUiId(idProp);

  const state: NavigationMenuPopup.State = {
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
  const isPhysicalLeft = createMemo(() => {
    const side = positioning.side();
    let physicalLeft = side === 'left';
    if (direction() === 'rtl') {
      physicalLeft = physicalLeft || side === 'inline-end';
    } else {
      physicalLeft = physicalLeft || side === 'inline-start';
    }
    return physicalLeft;
  });
  const isOriginSide = () => positioning.side() === 'top' || isPhysicalLeft();

  const element = useRenderElement('nav', componentProps, {
    get props() {
      return [
        {
          get id() {
            return id();
          },
          tabindex: -1,
          style: (isOriginSide()
            ? {
                position: 'absolute',
                [positioning.side() === 'top' ? 'bottom' : 'top']: '0',
                [isPhysicalLeft() ? 'right' : 'left']: '0',
              }
            : {}) as JSX.CSSProperties,
        },
        getDisabledMountTransitionStyles(transitionStatus()),
        elementProps,
      ];
    },
    ref: setPopupElement,
    state,
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface NavigationMenuPopupState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface NavigationMenuPopupProps extends BaseUIComponentProps<
  'nav',
  NavigationMenuPopup.State
> {}

export namespace NavigationMenuPopup {
  export type State = NavigationMenuPopupState;
  export type Props = NavigationMenuPopupProps;
}
