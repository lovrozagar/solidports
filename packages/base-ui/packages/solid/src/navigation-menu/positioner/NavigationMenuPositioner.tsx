import { createEffect, createSignal, onCleanup, type JSX } from 'solid-js';
import {
  disableFocusInside,
  enableFocusInside,
  isOutsideEvent,
} from '../../floating-ui-solid/utils';
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import { splitComponentProps } from '../../solid-helpers';
import { adaptiveOrigin } from '../../utils/adaptiveOriginMiddleware';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../utils/constants';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import { ownerWindow } from '../../utils/owner';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { useAnchorPositioning, type Align, type Side } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { useNavigationMenuPortalContext } from '../portal/NavigationMenuPortalContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { NavigationMenuPositionerContext } from './NavigationMenuPositionerContext';

const EMPTY_ROOT_CONTEXT = getEmptyRootContext();

/**
 * Positions the navigation menu against the currently active trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuPositioner(componentProps: NavigationMenuPositioner.Props) {
  const {
    open,
    mounted,
    positionerElement,
    setPositionerElement,
    floatingRootContext,
    nested,
    transitionStatus,
  } = useNavigationMenuRootContext();

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'anchor',
    'positionMethod',
    'side',
    'align',
    'sideOffset',
    'alignOffset',
    'collisionBoundary',
    'collisionPadding',
    'collisionAvoidance',
    'arrowPadding',
    'sticky',
    'disableAnchorTracking',
  ]);

  const positionMethod = () => local.positionMethod ?? 'absolute';
  const side = () => local.side ?? 'bottom';
  const align = () => local.align ?? 'center';
  const sideOffset = () => local.sideOffset ?? 0;
  const alignOffset = () => local.alignOffset ?? 0;
  const collisionBoundary = () => local.collisionBoundary ?? 'clipping-ancestors';
  const collisionPadding = () => local.collisionPadding ?? 5;
  const collisionAvoidance = () =>
    local.collisionAvoidance ??
    (nested() ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE);
  const arrowPadding = () => local.arrowPadding ?? 5;
  const sticky = () => local.sticky ?? false;
  const disableAnchorTracking = () => local.disableAnchorTracking ?? false;

  const keepMounted = useNavigationMenuPortalContext();
  const nodeId = useNavigationMenuTreeContext();

  const resizeTimeout = useTimeout();

  const [instant, setInstant] = createSignal(false);

  let positionerRef = null as HTMLDivElement | null | undefined;
  let prevTriggerElementRef = null as Element | null | undefined;

  const domReference = () =>
    (floatingRootContext() || EMPTY_ROOT_CONTEXT).useState('domReferenceElement')();

  const positioning = useAnchorPositioning({
    anchor: () => local.anchor ?? domReference() ?? prevTriggerElementRef,
    positionMethod,
    mounted,
    side,
    sideOffset,
    align,
    alignOffset,
    arrowPadding,
    collisionBoundary,
    collisionPadding,
    sticky,
    disableAnchorTracking,
    keepMounted,
    get floatingRootContext() {
      return floatingRootContext();
    },
    collisionAvoidance,
    nodeId,
    // Allows the menu to remain anchored without wobbling while its size
    // and position transition simultaneously when side=top or side=left.
    adaptiveOrigin,
  });

  const defaultProps: JSX.HTMLAttributes<HTMLDivElement> = {
    get hidden() {
      return !mounted();
    },
    role: 'presentation',
    get style(): JSX.CSSProperties {
      const hiddenStyles: JSX.CSSProperties = {};

      if (!open()) {
        hiddenStyles['pointer-events'] = 'none';
      }

      return {
        ...positioning.positionerStyles(),
        ...hiddenStyles,
      };
    },
  };

  const state: NavigationMenuPositioner.State = {
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get instant() {
      return instant();
    },
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
  };

  createEffect(() => {
    if (!open()) {
      return;
    }

    function handleResize() {
      setInstant(true);

      resizeTimeout.start(100, () => {
        setInstant(false);
      });
    }

    const positionerEl = positionerElement() ?? null;
    const win = ownerWindow(positionerEl);
    win.addEventListener('resize', handleResize);
    onCleanup(() => {
      win.removeEventListener('resize', handleResize);
    });
  });

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [
        defaultProps,
        getDisabledMountTransitionStyles(transitionStatus()),
        // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
        {
          'on:focusin': {
            capture: true,
            handleEvent(event: FocusEvent) {
              if (positionerRef && isOutsideEvent(event)) {
                enableFocusInside(positionerRef);
              }
            },
          },
          'on:focusout': {
            capture: true,
            handleEvent(event: FocusEvent) {
              if (positionerRef && isOutsideEvent(event)) {
                disableFocusInside(positionerRef);
              }
            },
          },
        },
        elementProps,
      ];
    },
    ref: (el) => {
      setPositionerElement(el);
      positionerRef = el;
      /* Without setFloating, floating-ui's autoUpdate never runs and the popup stays at 0,0 with opacity:0 until something else triggers a recompute (e.g. hovering a different trigger). */
      positioning.context.refs.setFloating(el ?? null);
    },
    state,
    stateAttributesMapping: popupStateMapping,
  });

  return (
    <NavigationMenuPositionerContext.Provider value={positioning}>
      {element()}
    </NavigationMenuPositionerContext.Provider>
  );
}

export interface NavigationMenuPositionerState {
  /**
   * Whether the navigation menu is currently open.
   */
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: boolean;
}

export interface NavigationMenuPositionerProps
  extends
    useAnchorPositioning.SharedParameters,
    BaseUIComponentProps<'div', NavigationMenuPositioner.State> {}

export namespace NavigationMenuPositioner {
  export type State = NavigationMenuPositionerState;
  export type Props = NavigationMenuPositionerProps;
}
