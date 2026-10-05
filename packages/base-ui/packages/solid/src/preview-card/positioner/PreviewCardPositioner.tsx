import { usePositioner } from '../../utils/usePositioner';

import { FloatingNode, useFloatingNodeId } from '../../floating-ui-solid';
import { splitComponentProps, createLayoutEffect } from '../../solid-helpers';
import { POPUP_COLLISION_AVOIDANCE } from '../../utils/constants';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { type Align, type Side, useAnchorPositioning } from '../../utils/useAnchorPositioning';
import { createInlineMiddleware } from '../../utils/popups';
import { usePreviewCardPortalContext } from '../portal/PreviewCardPortalContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardPositionerContext } from './PreviewCardPositionerContext';

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardPositioner(componentProps: PreviewCardPositioner.Props) {
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
  const side = () => local.side ?? 'bottom';
  const align = () => local.align ?? 'center';
  const sideOffset = () => local.sideOffset ?? 0;
  const alignOffset = () => local.alignOffset ?? 0;
  const collisionBoundary = () => local.collisionBoundary ?? 'clipping-ancestors';
  const collisionPadding = () => local.collisionPadding ?? 5;
  const arrowPadding = () => local.arrowPadding ?? 5;
  const sticky = () => local.sticky ?? false;
  const disableAnchorTracking = () => local.disableAnchorTracking ?? false;
  const collisionAvoidance = () => local.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE;

  const { store } = usePreviewCardRootContext();
  const keepMounted = usePreviewCardPortalContext();
  const nodeId = useFloatingNodeId();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
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
    inline: createInlineMiddleware(store.context.inlineRectCoordsRef),
    keepMounted,
    mounted,
    nodeId,
    positionMethod,
    side,
    sideOffset,
    sticky,
  });

  const updatePosition = positioning.update;

  createLayoutEffect(
    () => open() && mounted(),
    (shouldUpdate) => {
      if (shouldUpdate) {
        updatePosition();
      }
    },
  );

  const state: PreviewCardPositioner.State = {
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get instant() {
      return instantType();
    },
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
  };

  const contextValue: PreviewCardPositionerContext = {
    align: positioning.align,
    arrowRef: positioning.arrowRef,
    arrowStyles: positioning.arrowStyles,
    arrowUncentered: positioning.arrowUncentered,
    side: positioning.side,
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
      return !open();
    },
  });

  return (
    <PreviewCardPositionerContext value={contextValue}>
      <FloatingNode id={nodeId()}>{element()}</FloatingNode>
    </PreviewCardPositionerContext>
  );
}

export interface PreviewCardPositionerState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  instant: 'dismiss' | 'focus' | undefined;
}

export interface PreviewCardPositionerProps
  extends
    useAnchorPositioning.SharedParameters,
    BaseUIComponentProps<'div', PreviewCardPositioner.State> {}

export namespace PreviewCardPositioner {
  export type State = PreviewCardPositionerState;
  export type Props = PreviewCardPositionerProps;
}
