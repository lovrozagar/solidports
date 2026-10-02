import { createMemo, Show } from 'solid-js';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { FloatingNode } from '../../floating-ui-solid';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { createDepsEffect, createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../utils/constants';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
import { useAnchorPositioning, type Align, type Side } from '../../utils/useAnchorPositioning';
import { useAnimationsFinished } from '../../utils/useAnimationsFinished';
import { usePositioner } from '../../utils/usePositioner';
import { useTimeout } from '../../utils/useTimeout';
import { useMenuPortalContext } from '../portal/MenuPortalContext';
import type { MenuRoot } from '../root/MenuRoot';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuOpenEventDetails } from '../utils/types';
import { MenuPositionerContext } from './MenuPositionerContext';

/**
 * Positions the menu popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPositioner(componentProps: MenuPositioner.Props) {
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
    // `useRenderElement` applies `style` and `ref` from `componentProps`, as React destructures
    // them out.
    'style',
    'ref',
  ]);
  const positionMethodProp = () => local.positionMethod ?? 'absolute';
  const collisionBoundary = () => local.collisionBoundary ?? 'clipping-ancestors';
  const collisionPadding = () => local.collisionPadding ?? 5;
  const arrowPaddingProp = () => local.arrowPadding ?? 5;
  const sticky = () => local.sticky ?? false;
  const disableAnchorTracking = () => local.disableAnchorTracking ?? false;

  const { store } = useMenuRootContext();

  const keepMounted = useMenuPortalContext();
  const contextMenuContext = useContextMenuRootContext(true);

  const parent = store.useState('parent');
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const mounted = store.useState('mounted');
  const open = store.useState('open');
  const modal = store.useState('modal');
  const openMethod = store.useState('openMethod');
  const triggerElement = store.useState('activeTriggerElement');
  const transitionStatus = store.useState('transitionStatus');
  const positionerElement = store.useState('positionerElement');
  const instantType = store.useState('instantType');
  const adaptiveOriginState = store.useState('adaptiveOrigin');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  const floatingNodeId = store.useState('floatingNodeId');
  const floatingParentNodeId = store.useState('floatingParentNodeId');
  // Solid: the floating root lives on the store's context (React keeps it in state).
  const floatingRootContext = store.context.floatingRootContext;
  const domReference = () => floatingRootContext.select('domReferenceElement');

  let previousTriggerRef: Element | null = null;
  const runOnceAnimationsFinish = useAnimationsFinished(positionerElement);

  // Solid: React derives these locals during render; here they are memos over the same inputs.
  const resolved = createMemo(() => {
    const currentParent = parent();
    let anchor = local.anchor;
    let sideOffset = local.sideOffset ?? 0;
    let alignOffset = local.alignOffset ?? 0;
    let align = local.align;
    let collisionAvoidance = local.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;
    if (currentParent.type === 'context-menu') {
      anchor = local.anchor ?? currentParent.context?.anchor();
      align = align ?? 'start';
      if (!local.side && align !== 'center') {
        alignOffset = local.alignOffset ?? 2;
        sideOffset = local.sideOffset ?? -5;
      }
    }

    let computedSide = local.side;
    let computedAlign = align;
    if (currentParent.type === 'menu') {
      computedSide = computedSide ?? 'inline-end';
      computedAlign = computedAlign ?? 'start';
      collisionAvoidance = local.collisionAvoidance ?? POPUP_COLLISION_AVOIDANCE;
    } else if (currentParent.type === 'menubar') {
      computedSide =
        computedSide ??
        (currentParent.context.orientation() === 'vertical' ? 'inline-end' : 'bottom');
      computedAlign = computedAlign ?? 'start';
    }

    return {
      anchor,
      sideOffset,
      alignOffset,
      collisionAvoidance,
      computedSide,
      computedAlign,
    };
  });

  const contextMenu = () => parent().type === 'context-menu';

  const positioner = useAnchorPositioning({
    anchor: () => resolved().anchor,
    floatingRootContext,
    positionMethod: () => (contextMenuContext ? 'fixed' : positionMethodProp()),
    mounted,
    side: () => resolved().computedSide,
    sideOffset: () => resolved().sideOffset,
    align: () => resolved().computedAlign,
    alignOffset: () => resolved().alignOffset,
    arrowPadding: () => (contextMenu() ? 0 : arrowPaddingProp()),
    collisionBoundary,
    collisionPadding,
    sticky,
    nodeId: floatingNodeId,
    keepMounted,
    disableAnchorTracking,
    collisionAvoidance: () => resolved().collisionAvoidance,
    shift: () => {
      if (!contextMenu()) {
        return undefined;
      }
      const collisionAvoidance = resolved().collisionAvoidance;
      return {
        crossAxis: !('side' in collisionAvoidance && collisionAvoidance.side === 'flip'),
        rootBoundary: 'layoutViewport' as const,
      };
    },
    get externalTree() {
      return floatingTreeRoot();
    },
    adaptiveOrigin: adaptiveOriginState,
  });

  createDepsEffect(
    () => ({ events: floatingTreeRoot().events, nodeId: floatingNodeId() }),
    ({ events, nodeId }) => {
      function onMenuOpenChange(details: MenuOpenEventDetails) {
        if (details.open) {
          if (details.parentNodeId === nodeId) {
            store.set('hoverEnabled', false);
          }
          if (
            details.nodeId !== nodeId &&
            details.parentNodeId === store.select('floatingParentNodeId')
          ) {
            store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
          }
        }
      }

      events.on('menuopenchange', onMenuOpenChange);

      return () => {
        events.off('menuopenchange', onMenuOpenChange);
      };
    },
  );

  createDepsEffect(
    () => floatingTreeRoot().events,
    (events) => {
      if (store.select('floatingParentNodeId') == null) {
        return undefined;
      }

      function onParentClose(details: MenuOpenEventDetails) {
        if (details.open || details.nodeId !== store.select('floatingParentNodeId')) {
          return;
        }

        const reason: MenuRoot.ChangeEventReason = details.reason ?? REASONS.siblingOpen;
        store.setOpen(false, createChangeEventDetails(reason));
      }

      events.on('menuopenchange', onParentClose);

      return () => {
        events.off('menuopenchange', onParentClose);
      };
    },
  );

  const closeTimeout = useTimeout();

  // Clear pending close timeout when the menu closes.
  createDepsEffect(open, (isOpen) => {
    if (!isOpen) {
      closeTimeout.clear();
    }
  });

  // Close unrelated child submenus when hovering a different item in the parent menu.
  createDepsEffect(
    () => ({
      events: floatingTreeRoot().events,
      open: open(),
      triggerElement: triggerElement(),
    }),
    (deps) => {
      function onItemHover(event: { nodeId: string | undefined; target: Element | null }) {
        // If an item within our parent menu is hovered, and this menu's trigger is not that item,
        // close this submenu. This ensures hovering a different item in the parent closes other branches.
        if (!deps.open || event.nodeId !== store.select('floatingParentNodeId')) {
          return;
        }

        if (event.target && deps.triggerElement && deps.triggerElement !== event.target) {
          const delay = store.select('closeDelay');
          if (delay > 0) {
            if (!closeTimeout.isStarted()) {
              closeTimeout.start(delay, () => {
                store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
              });
            }
          } else {
            store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
          }
        } else {
          // User re-hovered the submenu trigger, cancel pending close.
          closeTimeout.clear();
        }
      }

      deps.events.on('itemhover', onItemHover);
      return () => {
        deps.events.off('itemhover', onItemHover);
      };
    },
  );

  createDepsEffect(
    () => ({
      events: floatingTreeRoot().events,
      open: open(),
      nodeId: floatingNodeId(),
      parentNodeId: floatingParentNodeId(),
    }),
    (deps) => {
      const eventDetails: MenuOpenEventDetails = {
        open: deps.open,
        nodeId: deps.nodeId,
        parentNodeId: deps.parentNodeId,
        reason: store.select('lastOpenChangeReason'),
      };

      deps.events.emit('menuopenchange', eventDetails);
    },
  );

  // Keep positioner transition behavior aligned with Popover when switching detached triggers.
  createDepsRenderEffect(domReference, (currentTrigger) => {
    const previousTrigger = previousTriggerRef;

    if (currentTrigger) {
      previousTriggerRef = currentTrigger;
    }

    if (previousTrigger && currentTrigger && currentTrigger !== previousTrigger) {
      store.set('instantType', undefined);

      const abortController = new AbortController();
      runOnceAnimationsFinish(() => {
        store.set('instantType', 'trigger-change');
      }, abortController.signal);

      return () => {
        abortController.abort();
      };
    }

    return undefined;
  });

  const state: MenuPositioner.State = {
    get open() {
      return open();
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
    get anchorHidden() {
      return positioner.anchorHidden();
    },
    get nested() {
      return parent().type === 'menu';
    },
    get instant() {
      return instantType();
    },
  };

  const menubarModal = () => {
    const currentParent = parent();
    return currentParent.type === 'menubar' && currentParent.context.modal();
  };
  const popupModal = () => modal() && lastOpenChangeReason() !== REASONS.triggerHover;

  useAnchoredPopupScrollLock({
    enabled: () => open() && (menubarModal() || popupModal()),
    touchOpen: () => openMethod() === 'touch',
    positionerElement,
    referenceElement: triggerElement,
  });

  const setPositionerElement = store.useStateSetter('positionerElement');

  const element = usePositioner(componentProps, state, {
    get styles() {
      return positioner.positionerStyles();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    props: elementProps,
    refs: [setPositionerElement],
    get hidden() {
      return !mounted();
    },
    get inert() {
      return !open();
    },
  });

  const shouldRenderBackdrop = () => {
    const currentParent = parent();
    return (
      mounted() &&
      currentParent.type !== 'menu' &&
      ((currentParent.type !== 'menubar' &&
        modal() &&
        lastOpenChangeReason() !== REASONS.triggerHover) ||
        (currentParent.type === 'menubar' && currentParent.context.modal()))
    );
  };

  // cuts a hole in the backdrop to allow pointer interaction with the menubar or dropdown menu trigger element
  const backdropCutout = () => {
    const currentParent = parent();
    if (currentParent.type === 'menubar') {
      return currentParent.context.contentElement() ?? null;
    }
    if (currentParent.type === undefined) {
      return (triggerElement() as HTMLElement | null | undefined) ?? null;
    }
    return null;
  };

  return (
    <MenuPositionerContext value={positioner}>
      <Show when={shouldRenderBackdrop()}>
        <InternalBackdrop
          managed
          ref={(el) => {
            const currentParent = parent();
            if (
              currentParent.type === 'context-menu' ||
              currentParent.type === 'nested-context-menu'
            ) {
              currentParent.context.internalBackdropRef.current = el;
            }
          }}
          inert={!open()}
          cutout={backdropCutout()}
        />
      </Show>
      <FloatingNode id={floatingNodeId()}>
        <CompositeList
          refs={{
            elements: store.context.itemDomElements.current,
            labels: store.context.itemLabels.current,
          }}
        >
          {element()}
        </CompositeList>
      </FloatingNode>
    </MenuPositionerContext>
  );
}

export interface MenuPositionerState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  side: Side;
  align: Align;
  anchorHidden: boolean;
  nested: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
}

export interface MenuPositionerProps
  extends
    Omit<useAnchorPositioning.SharedParameters, 'side' | 'align'>,
    BaseUIComponentProps<'div', MenuPositioner.State> {
  /**
   * How to align the popup relative to the specified side.
   *
   * Submenus and menubars default to `'start'`.
   * @default 'center'
   */
  align?: useAnchorPositioning.SharedParameters['align'] | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   *
   * Submenus and vertical menubars default to `'inline-end'`.
   * @default 'bottom'
   */
  side?: useAnchorPositioning.SharedParameters['side'] | undefined;
}

export namespace MenuPositioner {
  export type State = MenuPositionerState;
  export type Props = MenuPositionerProps;
}
