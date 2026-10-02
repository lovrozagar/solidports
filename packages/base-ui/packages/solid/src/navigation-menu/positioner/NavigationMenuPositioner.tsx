import { createEffect, createSignal, untrack } from 'solid-js';
import {
  disableFocusInside,
  enableFocusInside,
  isOutsideEvent,
} from '../../floating-ui-solid/utils';
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import { createDepsEffect, splitComponentProps } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { adaptiveOrigin } from '../../utils/adaptiveOriginMiddleware';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../utils/constants';
import { flushSync } from '../../utils/flushSync';
import { ownerWindow } from '../../utils/owner';
import type { BaseUIComponentProps } from '../../utils/types';
import type { Align, Side, useAnchorPositioning } from '../../utils/useAnchorPositioning';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { usePositioner } from '../../utils/usePositioner';
import { useTimeout } from '../../utils/useTimeout';
import { useNavigationMenuPortalContext } from '../portal/NavigationMenuPortalContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuAnchorPositioning } from '../utils/useNavigationMenuAnchorPositioning';
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
    'style',
    'ref',
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

  const initialInstantTimeout = useTimeout();
  const resizeTimeout = useTimeout();

  // When the menu is initially open, disable the positioner's transition for one frame
  // so a default value does not animate in from the unpositioned portal state.
  const [instant, setInstant] = createSignal(untrack(open));
  let needsInitialInstantResetRef = untrack(open);

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  createEffect(positionerElement, (positionerEl) => {
    if (!positionerEl) {
      return undefined;
    }

    // Make sure elements inside the portal element are tabbable only when the
    // portal has already been focused, either by tabbing into a focus trap
    // element outside or using the mouse.
    function onFocus(event: FocusEvent) {
      if (positionerEl && isOutsideEvent(event)) {
        const focusing = event.type === 'focusin';
        const manageFocus = focusing ? enableFocusInside : disableFocusInside;
        manageFocus(positionerEl);
      }
    }

    // Listen to the event on the capture phase so they run before the focus
    // trap elements onFocus prop is called.
    return mergeCleanups(
      addEventListener(positionerEl, 'focusin', onFocus, true),
      addEventListener(positionerEl, 'focusout', onFocus, true),
    );
  });

  const domReference = () =>
    (floatingRootContext() || EMPTY_ROOT_CONTEXT).useState('domReferenceElement')();

  const positioning = useNavigationMenuAnchorPositioning({
    anchor: () => local.anchor ?? domReference(),
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
    shift: { rootBoundary: 'layoutViewport' },
    nodeId: () => nodeId?.(),
    // Allows the menu to remain anchored without wobbling while its size
    // and position transition simultaneously when side=top or side=left.
    adaptiveOrigin,
  });

  const state: NavigationMenuPositionerState = {
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get instant() {
      return instant();
    },
  };

  createDepsEffect(
    () => ({ open: open(), positionerElement: positionerElement() }),
    ({ open: isOpen, positionerElement: positionerEl }) => {
      if (!isOpen) {
        return undefined;
      }

      if (needsInitialInstantResetRef) {
        initialInstantTimeout.start(0, () => {
          needsInitialInstantResetRef = false;

          if (!resizeTimeout.isStarted()) {
            setInstant(false);
          }
        });
      }

      function handleResize() {
        flushSync(() => {
          setInstant(true);
        });

        resizeTimeout.start(100, () => {
          setInstant(false);
        });
      }

      const win = ownerWindow(positionerEl ?? null);
      return addEventListener(win, 'resize', handleResize);
    },
  );

  const element = usePositioner(componentProps, state, {
    get styles() {
      return positioning.positionerStyles();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    props: elementProps,
    refs: setPositionerElement,
    get hidden() {
      return !mounted();
    },
    get inert() {
      return !open();
    },
  });

  return (
    <NavigationMenuPositionerContext value={positioning}>
      {element()}
    </NavigationMenuPositionerContext>
  );
}

export interface NavigationMenuPositionerState {
  /**
   * Whether the navigation menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
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
