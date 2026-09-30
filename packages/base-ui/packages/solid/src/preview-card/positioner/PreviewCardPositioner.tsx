import { type JSX } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { adaptiveOrigin } from '../../utils/adaptiveOriginMiddleware';
import { POPUP_COLLISION_AVOIDANCE } from '../../utils/constants';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { type Align, type Side, useAnchorPositioning } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../utils/useRenderElement';
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

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const instantType = store.useState('instantType');
  const transitionStatus = store.useState('transitionStatus');
  const hasViewport = store.useState('hasViewport');

  const positioning = useAnchorPositioning({
    get adaptiveOrigin() {
      return hasViewport() ? adaptiveOrigin : undefined;
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

  const defaultProps: HTMLProps = {
    get hidden() {
      return !mounted();
    },
    role: 'presentation',
    get style() {
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

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [defaultProps, getDisabledMountTransitionStyles(transitionStatus()), elementProps];
    },
    ref: (el) => {
      store.set('positionerElement', el);
    },
    state,
    stateAttributesMapping: popupStateMapping,
  });

  return (
    <PreviewCardPositionerContext.Provider value={contextValue}>
      {element()}
    </PreviewCardPositionerContext.Provider>
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
