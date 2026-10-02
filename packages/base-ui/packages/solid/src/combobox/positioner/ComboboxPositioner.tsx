import { createRenderEffect, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../utils/constants';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import type { BaseUIComponentProps, BaseUIHTMLProps } from '../../utils/types';
import { type Align, type Side, useAnchorPositioning } from '../../utils/useAnchorPositioning';
import { usePositioner } from '../../utils/usePositioner';
import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
import { useComboboxPortalContext } from '../portal/ComboboxPortalContext';
import { useComboboxFloatingContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import { useListEmpty } from '../utils/parts';
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

  const store = useComboboxRootContext();
  const floatingRootContext = useComboboxFloatingContext();
  const keepMounted = useComboboxPortalContext();

  const modal = store.useState('modal');
  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const openMethod = store.useState('openMethod');
  const triggerElement = store.useState('triggerElement');
  const inputElement = store.useState('inputElement');
  const inputGroupElement = store.useState('inputGroupElement');
  const inputInsidePopup = store.useState('inputInsidePopup');
  const transitionStatus = store.useState('transitionStatus');

  const empty = useListEmpty();
  const resolvedAnchor = () =>
    local.anchor ??
    (inputInsidePopup() ? triggerElement() : (inputGroupElement() ?? inputElement()));

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
    enabled: () => open() && modal(),
    positionerElement: store.useState('positionerElement'),
    referenceElement: triggerElement,
    touchOpen: () => openMethod() === 'touch',
  });

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

  createRenderEffect(positioning.side, (side) => {
    store.set('popupSide', side);
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
  };

  const element = usePositioner(componentProps, state, {
    get styles() {
      return positioning.positionerStyles();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    // Solid: the remaining positioner props are plain element props once the positioning options are split off.
    props: elementProps as BaseUIHTMLProps<HTMLDivElement>,
    refs: setPositionerElement,
    get hidden() {
      return !mounted();
    },
    get inert() {
      return !open();
    },
  });

  return (
    <ComboboxPositionerContext value={contextValue}>
      <Show when={mounted() && modal()}>
        <InternalBackdrop
          managed
          inert={!open()}
          cutout={inputGroupElement() ?? inputElement() ?? triggerElement()}
        />
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
