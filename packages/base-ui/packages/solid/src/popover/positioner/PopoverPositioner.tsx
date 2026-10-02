/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { usePositioner } from '../../utils/usePositioner';
import { createEffect, Show } from 'solid-js';
import { FloatingNode, useFloatingNodeId } from '../../floating-ui-solid';
import { splitComponentProps } from '../../solid-helpers';
import { POPUP_COLLISION_AVOIDANCE } from '../../utils/constants';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useAnchorPositioning, type Align, type Side } from '../../utils/useAnchorPositioning';
import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
import { useAnimationsFinished } from '../../utils/useAnimationsFinished';
import { usePopoverPortalContext } from '../portal/PopoverPortalContext';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { PopoverPositionerContext } from './PopoverPositionerContext';

/**
 * Positions the popover against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverPositioner(componentProps: PopoverPositioner.Props) {
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

  const { store } = usePopoverRootContext();
  const keepMounted = usePopoverPortalContext();
  const nodeId = useFloatingNodeId();

  const mounted = store.useState('mounted');
  const open = store.useState('open');
  const openReason = store.useState('openChangeReason');
  const triggerElement = store.useState('activeTriggerElement');
  const modal = store.useState('modal');
  const openMethod = store.useState('openMethod');
  const positionerElement = store.useState('positionerElement');
  const instantType = store.useState('instantType');
  const transitionStatus = store.useState('transitionStatus');
  const adaptiveOrigin = store.useState('adaptiveOrigin');

  let prevTriggerElementRef = null as Element | null | undefined;

  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement, false, false);

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
    nodeId,
    positionMethod,
    side,
    sideOffset,
    sticky,
  });

  // When the current trigger element changes, enable transitions on the
  // positioner temporarily
  createEffect(
    () => store.context.floatingRootContext.select('domReferenceElement'),
    (currentTriggerElement) => {
      const prevTriggerElement = prevTriggerElementRef;

      if (currentTriggerElement) {
        prevTriggerElementRef = currentTriggerElement;
      }

      if (
        prevTriggerElement &&
        currentTriggerElement &&
        currentTriggerElement !== prevTriggerElement
      ) {
        store.set('instantType', undefined);
        const ac = new AbortController();
        runOnceAnimationsFinish(() => {
          store.set('instantType', 'trigger-change');
        }, ac.signal);

        return () => {
          ac.abort();
        };
      }

      return undefined;
    },
  );

  const trueModalNonHover = () => modal() === true && openReason() !== REASONS.triggerHover;

  useAnchoredPopupScrollLock({
    enabled: () => open() && trueModalNonHover(),
    touchOpen: () => openMethod() === 'touch',
    positionerElement,
    referenceElement: triggerElement,
  });

  const state: PopoverPositioner.State = {
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
    <PopoverPositionerContext value={positioning}>
      <Show when={mounted() && modal() === true && openReason() !== REASONS.triggerHover}>
        <InternalBackdrop
          managed
          ref={(el) => {
            store.context.internalBackdropRef.current = el;
          }}
          inert={!open()}
          cutout={triggerElement()}
        />
      </Show>

      <FloatingNode id={nodeId()}>{element()}</FloatingNode>
    </PopoverPositionerContext>
  );
}

export interface PopoverPositionerState {
  /**
   * Whether the popover is currently open.
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

export interface PopoverPositionerProps
  extends
    useAnchorPositioning.SharedParameters,
    BaseUIComponentProps<'div', PopoverPositioner.State> {}

export namespace PopoverPositioner {
  export type State = PopoverPositionerState;
  export type Props = PopoverPositionerProps;
}
