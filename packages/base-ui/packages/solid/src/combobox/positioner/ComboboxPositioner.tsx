import { createTrackedEffect, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../utils/constants';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import { popupStateMapping } from '../../utils/popupStateMapping';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { type Align, type Side, useAnchorPositioning } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../utils/useRenderElement';
import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
import { useComboboxPortalContext } from '../portal/ComboboxPortalContext';
import {
  useComboboxDerivedItemsContext,
  useComboboxFloatingContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { ComboboxPositionerContext } from './ComboboxPositionerContext';

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 */
export function ComboboxPositioner(componentProps: ComboboxPositioner.Props) {
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
  const collisionAvoidance = () => local.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;

  const { store } = useComboboxRootContext();
  const { filteredItems } = useComboboxDerivedItemsContext();
  const { context: floatingRootContext } = useComboboxFloatingContext();
  const keepMounted = useComboboxPortalContext();

  const modal = store.useSelector('modal');
  const open = store.useSelector('open');
  const mounted = store.useSelector('mounted');
  const openMethod = store.useSelector('openMethod');
  const triggerElement = store.useState('triggerElement');
  const inputElement = store.useState('inputElement');
  const inputInsidePopup = store.useState('inputInsidePopup');
  const transitionStatus = store.useState('transitionStatus');

  const empty = () => filteredItems().length === 0;
  const resolvedAnchor = () =>
    local.anchor ?? (inputInsidePopup() ? triggerElement() : inputElement());

  const positioning = useAnchorPositioning({
    align,
    alignOffset,
    anchor: resolvedAnchor,
    arrowPadding,
    collisionAvoidance,
    collisionBoundary,
    collisionPadding,
    disableAnchorTracking,
    get floatingRootContext() {
      return floatingRootContext;
    },
    keepMounted,
    lazyFlip: true,
    mounted,
    positionMethod,
    side,
    sideOffset,
    sticky,
  });

  useAnchoredPopupScrollLock({
    enabled: () => open() && modal() && openMethod() !== 'touch',
    positionerElement: store.useState('positionerElement'),
    referenceElement: triggerElement,
    touchOpen: () => openMethod() === 'touch',
  });

  const defaultProps: HTMLProps = {
    get hidden() {
      return !mounted();
    },
    role: 'presentation',
    get style(): JSX.CSSProperties {
      const positionerStyles = positioning.positionerStyles();
      return {
        ...positionerStyles,
        'pointer-events': !open() ? 'none' : positionerStyles['pointer-events'],
      };
    },
  };

  const state: ComboboxPositioner.State = {
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
    get empty() {
      return empty();
    },
    get open() {
      return open();
    },
    get side() {
      return positioning.side();
    },
  };

  createTrackedEffect(() => {
    store.set('popupSide', positioning.side());
  });

  const contextValue: ComboboxPositionerContext = {
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    arrowRef: positioning.arrowRef,
    get arrowStyles() {
      return positioning.arrowStyles();
    },
    arrowUncentered: positioning.arrowUncentered,
    isPositioned: positioning.isPositioned,
    side: positioning.side,
  };

  const setPositionerElement = (element: HTMLElement | null | undefined) => {
    store.set('positionerElement', element);
    /* Register floating element with floating-ui — without this, `autoUpdate` never runs and the popup is stuck at its default 0,0 origin. Tooltip/Select positioners do the same. */
    positioning.context.refs.setFloating(element ?? null);
  };

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [defaultProps, getDisabledMountTransitionStyles(transitionStatus()), elementProps];
    },
    ref: setPositionerElement,
    state,
    stateAttributesMapping: popupStateMapping,
  });

  return (
    <ComboboxPositionerContext value={contextValue}>
      <Show when={mounted() && modal()}>
        <InternalBackdrop managed inert={!open()} cutout={inputElement() ?? triggerElement()} />
      </Show>
      {element()}
    </ComboboxPositionerContext>
  );
}

export interface ComboboxPositionerState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  empty: boolean;
}

export interface ComboboxPositionerProps
  extends
    useAnchorPositioning.SharedParameters,
    BaseUIComponentProps<'div', ComboboxPositioner.State> {}

export namespace ComboboxPositioner {
  export type State = ComboboxPositionerState;
  export type Props = ComboboxPositionerProps;
}
