import { usePositioner } from '../../utils/usePositioner';
import { splitComponentProps } from '../../solid-helpers';
import { POPUP_COLLISION_AVOIDANCE } from '../../utils/constants';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useAnchorPositioning, type Align, type Side } from '../../utils/useAnchorPositioning';
import { useTooltipPortalContext } from '../portal/TooltipPortalContext';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPositionerContext } from './TooltipPositionerContext';

/**
 * Positions the tooltip against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipPositioner(componentProps: TooltipPositioner.Props) {
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
    'arrowPadding',
    'sticky',
    'disableAnchorTracking',
    'collisionAvoidance',
  ]);
  const positionMethod = () => local.positionMethod ?? 'absolute';
  const side = () => local.side ?? 'top';
  const align = () => local.align ?? 'center';
  const sideOffset = () => local.sideOffset ?? 0;
  const alignOffset = () => local.alignOffset ?? 0;
  const collisionBoundary = () => local.collisionBoundary ?? 'clipping-ancestors';
  const collisionPadding = () => local.collisionPadding ?? 5;
  const arrowPadding = () => local.arrowPadding ?? 5;
  const sticky = () => local.sticky ?? false;
  const disableAnchorTracking = () => local.disableAnchorTracking ?? false;
  const collisionAvoidance = () => local.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE;

  const { store } = useTooltipRootContext();
  const keepMounted = useTooltipPortalContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const trackCursorAxis = store.useState('trackCursorAxis');
  const disableHoverablePopup = store.useState('disableHoverablePopup');
  const instantType = store.useState('instantType');
  const transitionStatus = store.useState('transitionStatus');
  const adaptiveOrigin = store.useState('adaptiveOrigin');

  const positioning = useAnchorPositioning({
    get adaptiveOrigin() {
      return adaptiveOrigin();
    },
    align,
    alignOffset,
    anchor: () => local.anchor,
    arrowPadding,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking,
    get floatingRootContext() {
      return store.context.floatingRootContext;
    },
    keepMounted,
    mounted,
    positionMethod,
    side,
    sideOffset,
    sticky,
  });

  const state: TooltipPositioner.State = {
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get instant() {
      return trackCursorAxis() !== 'none' ? 'tracking-cursor' : instantType();
    },
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
  };

  const contextValue: TooltipPositionerContext = {
    align: () => state.align,
    anchorHidden: () => state.anchorHidden,
    arrowRef: positioning.arrowRef,
    arrowStyles: () => positioning.arrowStyles(),
    arrowUncentered: () => positioning.arrowUncentered(),
    open: () => state.open,
    side: () => state.side,
  };

  const element = usePositioner(componentProps, state, {
    get styles() {
      return positioning.positionerStyles();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    props: elementProps,
    refs: (el: HTMLDivElement | null) => {
      store.set('positionerElement', el);
    },
    get hidden() {
      return !mounted();
    },
    get inert() {
      return !open() || trackCursorAxis() === 'both' || disableHoverablePopup();
    },
  });

  return <TooltipPositionerContext value={contextValue}>{element()}</TooltipPositionerContext>;
}

export interface TooltipPositionerState {
  /**
   * Whether the tooltip is currently open.
   */
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface TooltipPositionerProps
  extends
    BaseUIComponentProps<'div', TooltipPositioner.State>,
    Omit<useAnchorPositioning.SharedParameters, 'side'> {
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
}

export namespace TooltipPositioner {
  export type State = TooltipPositionerState;
  export type Props = TooltipPositionerProps;
}
