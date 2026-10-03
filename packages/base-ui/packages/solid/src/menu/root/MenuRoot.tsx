import { createMemo, createRenderEffect, Show, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  ContextMenuRootContext,
  useContextMenuRootContext,
} from '../../context-menu/root/ContextMenuRootContext';
import { useDirection } from '../../direction-provider/DirectionContext';
import {
  FloatingTree,
  useDismiss,
  useFloatingNodeId,
  useFloatingParentNodeIdAccessor,
  useHasFloatingParentNode,
  useListNavigation,
  useSyncedFloatingRootContext,
  useTypeahead,
} from '../../floating-ui-solid';
import { MenubarContext, useMenubarContext } from '../../menubar/MenubarContext';
import { mergeProps } from '../../merge-props';
import {
  ComponentWithPayload,
  createDepsEffect,
  createDepsRenderEffect,
  type ReactLikeRef,
} from '../../solid-helpers';
import { TYPEAHEAD_RESET_MS } from '../../utils/constants';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../utils/empty';
import {
  attachPreventUnmountOnClose,
  createPopupOpenState,
  FOCUSABLE_POPUP_PROPS,
  PayloadChildRenderFunction,
  useImplicitActiveTrigger,
  useOpenStateTransitions,
  usePopupInteractionProps,
} from '../../utils/popups';
import { REASONS } from '../../utils/reasons';
import type { HTMLProps } from '../../utils/types';
import { useAnimationsFinished } from '../../utils/useAnimationsFinished';
import { useId } from '../../utils/useId';
import { useOpenInteractionType } from '../../utils/useOpenInteractionType';
import { useTimeout } from '../../utils/useTimeout';
import { MenuHandle } from '../store/MenuHandle';
import { MenuStore, type State as MenuStoreState } from '../store/MenuStore';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import { MenuRootContext, useMenuRootContext } from './MenuRootContext';

/**
 * Groups all parts of the menu.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRoot<Payload>(props: MenuRoot.Props<Payload>) {
  const openProp = () => props.open;
  const defaultOpen = () => props.defaultOpen ?? false;
  const disabledProp = () => props.disabled ?? false;
  const modalProp = () => props.modal;
  const loopFocus = () => props.loopFocus ?? true;
  const orientation = () => props.orientation ?? 'vertical';
  const closeParentOnEsc = () => props.closeParentOnEsc ?? false;
  const triggerIdProp = () => props.triggerId;
  const defaultTriggerIdProp = () => props.defaultTriggerId ?? null;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;

  const contextMenuContext = useContextMenuRootContext(true);
  const parentMenuRootContext = useMenuRootContext(true);
  const menubarContext = useMenubarContext(true);
  const isSubmenu = useMenuSubmenuRootContext();

  // Solid: contexts are fixed for the component's lifetime, so this is computed once.
  const parentFromContext: MenuParent = (() => {
    if (isSubmenu && parentMenuRootContext) {
      return {
        type: 'menu',
        store: parentMenuRootContext.store,
      };
    }

    if (menubarContext) {
      return {
        type: 'menubar',
        context: menubarContext,
      };
    }

    // Ensure this is not a Menu nested inside ContextMenu.Trigger.
    // ContextMenu parentContext is always undefined as ContextMenu.Root is instantiated with
    // <MenuRootContext value={null}>
    if (contextMenuContext && !parentMenuRootContext) {
      return {
        type: 'context-menu',
        context: contextMenuContext,
      };
    }

    return {
      type: undefined,
    };
  })();

  const rootId = useId();
  const floatingId = useId();
  const floatingParentNodeIdFromContext = useFloatingParentNodeIdAccessor();
  // Solid: the parent node's id can arrive after this root is created; being inside a node is what
  // React's `floatingParentNodeId != null` means once it has.
  const hasFloatingParentNode = useHasFloatingParentNode();

  const parentMenuStore = parentFromContext.type === 'menu' ? parentFromContext.store : undefined;
  // An initially open submenu should animate in only when the user watches it appear, i.e. when
  // its subtree mounts because the parent popup is playing its own enter transition. A parent
  // that was `defaultOpen` at page load never passes through `'starting'`, and under a
  // `keepMounted` parent these initializers run at page load while the parent's status is still
  // `undefined` — in both cases the submenu is page-load content that must not animate. Gated on
  // being open at mount so a closed submenu doesn't seed `instantType` it would never clear. Read
  // during the first render only — consumed exclusively by first-render initializers below
  // (`useOpenStateTransitions` and the store's initial state).
  const animateInitialOpen = untrack(
    () => (openProp() ?? defaultOpen()) && parentMenuStore?.state.transitionStatus === 'starting',
  );

  // Mirror an instantly-opened parent (e.g. keyboard click) so `[data-instant]` styling
  // suppresses the enter transition on both popups or neither. Captured once —
  // `animateInitialOpen` is only meaningful during the first render.
  const seededInstantType = animateInitialOpen
    ? untrack(() => parentMenuStore?.state.instantType)
    : undefined;

  const store = useMenuRootStore<Payload>(
    untrack(() => ({
      open: defaultOpen(),
      openProp: openProp(),
      activeTriggerId: defaultTriggerIdProp(),
      triggerIdProp: triggerIdProp(),
      parent: parentFromContext,
      disabled: disabledProp(),
      highlightItemOnHover: highlightItemOnHover(),
      modal: parentFromContext.type === undefined ? modalProp() : undefined,
      rootId: rootId(),
      instantType: seededInstantType,
    })),
    untrack(floatingId),
    hasFloatingParentNode,
  );

  store.useControlledProp('openProp', openProp);
  store.useControlledProp('triggerIdProp', triggerIdProp);

  store.useContextCallback('onOpenChangeComplete', (open: boolean) =>
    untrack(() => props.onOpenChangeComplete)?.(open),
  );

  const floatingTreeRoot = store.useState('floatingTreeRoot');
  // Solid: the floating tree is read once; the hook registers its node into it for the root's
  // lifetime.
  const floatingNodeIdFromContext = useFloatingNodeId(floatingTreeRoot);

  const open = store.useState('open');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const positionerElement = store.useState('positionerElement');
  const hoverEnabled = store.useState('hoverEnabled');
  const disabled = store.useState('disabled');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  const parent = store.useState('parent');

  const activeIndex = store.useState('activeIndex');
  const payload = store.useState('payload') as Accessor<Payload | undefined>;
  const floatingParentNodeId = store.useState('floatingParentNodeId');

  const openEventRef: ReactLikeRef<Event | null> = { current: null };
  const allowOutsidePressDismissalRef = {
    current: untrack(parent).type !== 'context-menu',
  };
  const allowOutsidePressDismissalTimeout = useTimeout();
  const allowTouchToCloseRef = { current: true };
  const allowTouchToCloseTimeout = useTimeout();

  const nested = () => floatingParentNodeId() != null;

  if (process.env.NODE_ENV !== 'production') {
    // Solid: React warns on every render; warn whenever the inputs change.
    createDepsEffect(
      () => ({ parentType: parent().type, modal: modalProp() }),
      ({ parentType, modal }) => {
        if (parentType !== undefined && modal !== undefined) {
          console.warn(
            'Base UI: The `modal` prop is not supported on nested menus. It will be ignored.',
          );
        }
      },
    );
  }

  const { openMethod, triggerProps: interactionTypeProps } = useOpenInteractionType(open);

  store.useSyncedValues({
    disabled: disabledProp,
    highlightItemOnHover,
    get modal() {
      return parent().type === undefined ? modalProp() : undefined;
    },
    openMethod,
    rootId,
  });

  useImplicitActiveTrigger(store);
  const { forceUnmount, transitionStatus } = useOpenStateTransitions(
    open,
    store,
    () => {
      store.set('allowMouseEnter', false);
    },
    animateInitialOpen,
  );

  const runOnceAnimationsFinish = useAnimationsFinished(() => store.context.popupRef.current);

  // An inherited `instantType` is only for the initial reveal. A later controlled `open` flip
  // bypasses `setOpen`, so nothing would reset it and `[data-instant]` would wrongly suppress
  // every subsequent transition. Clear it once the enter phase settles, unless an interactive
  // open change already replaced it.
  createDepsEffect(
    () => ({ open: open(), transitionStatus: transitionStatus() }),
    (deps) => {
      if (seededInstantType === undefined) {
        return undefined;
      }

      const clearSeededInstantType = () => {
        if (store.state.instantType === seededInstantType) {
          store.set('instantType', undefined);
        }
      };

      // A controlled close can interrupt the initial enter before the animations-finished cleanup
      // below fires (its abort cancels the pending callback, and a closed popup schedules no new
      // one). Nothing is left to protect once closing starts — the exit's suppression was already
      // decided at its trigger commit — so clear now or the next reopen renders a stale
      // `[data-instant]`.
      if (!deps.open) {
        clearSeededInstantType();
        return undefined;
      }

      if (deps.transitionStatus !== undefined) {
        return undefined;
      }

      // With no popup element (e.g. its subtree is suspended or waiting on data), there is no
      // enter transition to protect, and `useAnimationsFinished` would return without invoking the
      // callback — a ref assignment alone would never rerun this effect, leaving the seed stuck.
      // Clear immediately: a popup that appears after the reveal settles is page-load-like content.
      if (store.context.popupRef.current == null) {
        clearSeededInstantType();
        return undefined;
      }

      const abortController = new AbortController();
      runOnceAnimationsFinish(clearSeededInstantType, abortController.signal);

      return () => {
        abortController.abort();
      };
    },
  );

  createRenderEffect(
    () => ({
      floatingNodeId: floatingNodeIdFromContext(),
      floatingParentNodeId: floatingParentNodeIdFromContext(),
    }),
    ({ floatingNodeId, floatingParentNodeId }) => {
      if (contextMenuContext && !parentMenuRootContext) {
        // This is a context menu root.
        // It doesn't support detached triggers yet, so we have to sync the parent context manually.
        store.update({
          parent: {
            type: 'context-menu',
            context: contextMenuContext,
          },
          floatingNodeId,
          floatingParentNodeId,
        });
      } else if (parentMenuRootContext) {
        store.update({
          floatingNodeId,
          floatingParentNodeId,
        });
      }
    },
  );

  createDepsEffect(
    () => ({ open: open(), parentType: parent().type }),
    (deps) => {
      if (!deps.open) {
        openEventRef.current = null;
      }

      if (deps.parentType !== 'context-menu') {
        return;
      }

      if (!deps.open) {
        allowOutsidePressDismissalTimeout.clear();
        allowOutsidePressDismissalRef.current = false;
        return;
      }

      // With `mousedown` outside press events and long press touch input, there
      // needs to be a grace period after opening to ensure the dismissal event
      // doesn't fire immediately after open.
      allowOutsidePressDismissalTimeout.start(500, () => {
        allowOutsidePressDismissalRef.current = true;
      });
    },
  );

  createRenderEffect(
    () => !open() && !hoverEnabled(),
    (shouldEnableHover) => {
      if (shouldEnableHover) {
        store.set('hoverEnabled', true);
      }
    },
  );

  // Solid: a handler, so it reads the latest store values (React's stable callback).
  const setOpen = (
    nextOpen: boolean,
    eventDetails: Omit<MenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) =>
    untrack(() => {
      const reason = eventDetails.reason;

      // Read the store directly, as relayed tree events and stale hover timers can request
      // a close after the state changed but before this component re-rendered.
      if (!nextOpen && !store.select('open')) {
        return;
      }

      const currentActiveTriggerElement = activeTriggerElement();

      if (
        open() === nextOpen &&
        eventDetails.trigger === currentActiveTriggerElement &&
        lastOpenChangeReason() === reason
      ) {
        return;
      }

      const shouldPreventUnmountOnClose = attachPreventUnmountOnClose(
        eventDetails as MenuRoot.ChangeEventDetails,
      );

      // Do not immediately reset the activeTriggerId to allow
      // exit animations to play and focus to be returned correctly.
      if (!nextOpen && eventDetails.trigger == null) {
        eventDetails.trigger = currentActiveTriggerElement ?? undefined;
      }

      props.onOpenChange?.(nextOpen, eventDetails as MenuRoot.ChangeEventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      store.context.floatingRootContext.dispatchOpenChange(nextOpen, eventDetails);

      const nativeEvent = eventDetails.event as Event;
      if (
        nextOpen === false &&
        nativeEvent?.type === 'click' &&
        (nativeEvent as PointerEvent).pointerType === 'touch' &&
        !allowTouchToCloseRef.current
      ) {
        return;
      }

      // Prevent the menu from closing on mobile devices that have a delayed click event.
      // In some cases the menu, when tapped, will fire the focus event first and then the click event.
      // Without this guard, the menu will close immediately after opening.
      if (nextOpen && reason === REASONS.triggerFocus) {
        allowTouchToCloseRef.current = false;
        allowTouchToCloseTimeout.start(300, () => {
          allowTouchToCloseRef.current = true;
        });
      } else {
        allowTouchToCloseRef.current = true;
        allowTouchToCloseTimeout.clear();
      }

      // Keyboard and assistive-technology activations produce `detail === 0` clicks;
      // mouse-gesture clicks (including the synthesized drag-release click from
      // `useMenuItemCommonProps`) carry `detail >= 1`.
      const isKeyboardClick =
        (reason === REASONS.triggerPress || reason === REASONS.itemPress) &&
        (nativeEvent as MouseEvent).detail === 0;
      const isDismissClose = !nextOpen && (reason === REASONS.escapeKey || reason == null);

      openEventRef.current = eventDetails.event ?? null;

      const popupOpenState = createPopupOpenState(
        store.state,
        nextOpen,
        eventDetails.trigger,
        shouldPreventUnmountOnClose(),
      ) as ReturnType<typeof createPopupOpenState> & {
        openChangeReason: MenuRoot.ChangeEventReason;
        instantType: MenuStoreState<Payload>['instantType'];
      };

      popupOpenState.openChangeReason = reason;

      if (
        parent().type === 'menubar' &&
        (reason === REASONS.triggerFocus ||
          reason === REASONS.focusOut ||
          reason === REASONS.triggerHover ||
          reason === REASONS.listNavigation ||
          reason === REASONS.siblingOpen)
      ) {
        popupOpenState.instantType = 'group';
      } else if (isKeyboardClick || isDismissClose) {
        popupOpenState.instantType = isKeyboardClick ? 'click' : 'dismiss';
      } else {
        popupOpenState.instantType = undefined;
      }

      // `instantType` must land in the same update that mounts the popup subtree, so an initially
      // open submenu seeding its own store from this one reads the new value.
      store.update(popupOpenState);
    });

  const floatingRootContext = useSyncedFloatingRootContext({
    popupStore: store,
    floatingRootContext: store.context.floatingRootContext,
    floatingId,
    nested: hasFloatingParentNode,
    onOpenChange: setOpen,
  });

  const floatingEvents = floatingRootContext.context.events;

  // Registered in a render effect (React's layout effect) so `setOpen` emits from imperative
  // `MenuHandle.open()` calls made in the same commit this root mounts are received instead of
  // being silently dropped.
  createRenderEffect(
    () => floatingEvents,
    (events) => {
      const handleSetOpenEvent = ({
        open: nextOpen,
        eventDetails,
      }: {
        open: boolean;
        eventDetails: MenuRoot.ChangeEventDetails;
      }) => setOpen(nextOpen, eventDetails);

      events.on('setOpen', handleSetOpenEvent);

      return () => {
        events.off('setOpen', handleSetOpenEvent);
      };
    },
  );

  // Solid: React renders `<PopupHandleAttachment>` as the first child so its layout effect attaches
  // the store before later siblings' effects run. Solid inserts the root's children lazily, so a
  // sibling's render effect would run first; attaching from the root's own body keeps React's order.
  createDepsRenderEffect(
    () => props.handle,
    (handle) => handle?.attachStore(store),
  );

  const handleImperativeClose = () => {
    store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
  };

  // React's `useImperativeHandle`.
  createRenderEffect(
    () => props.actionsRef,
    (actionsRef) => {
      if (!actionsRef) {
        return undefined;
      }

      actionsRef.current = { unmount: forceUnmount, close: handleImperativeClose };
      return () => {
        actionsRef.current = null;
      };
    },
  );

  const contextMenuParentContext = () => {
    const currentParent = parent();
    return currentParent.type === 'context-menu' ? currentParent.context : undefined;
  };

  createRenderEffect(
    () => ({ ctx: contextMenuParentContext(), element: positionerElement() }),
    ({ ctx, element }) => {
      if (!ctx) {
        return undefined;
      }

      ctx.positionerRef.current = element ?? null;
      return () => {
        ctx.positionerRef.current = null;
      };
    },
  );

  createRenderEffect(contextMenuParentContext, (ctx) => {
    if (!ctx) {
      return undefined;
    }

    ctx.actionsRef.current = { setOpen };
    return () => {
      ctx.actionsRef.current = null;
    };
  });

  const dismiss = useDismiss({
    context: floatingRootContext,
    props: {
      get enabled() {
        return !disabled();
      },
      get bubbles() {
        return { escapeKey: closeParentOnEsc() && parent().type === 'menu' };
      },
      outsidePress() {
        if (parent().type !== 'context-menu' || openEventRef.current?.type === 'contextmenu') {
          return true;
        }

        return allowOutsidePressDismissalRef.current;
      },
      get externalTree() {
        return nested() ? floatingTreeRoot() : undefined;
      },
    },
  });

  const direction = useDirection();

  // List navigation resets the highlight from an effect once the menu closes. Solid derives the
  // reset, so a closed menu has no active item in the same flush.
  store.useSyncedValue('activeIndex', (prev) => (open() ? prev : null));

  const setActiveIndex = (index: number | null) => {
    if (store.select('activeIndex') === index) {
      return;
    }
    store.set('activeIndex', index);
  };

  const listNavigation = useListNavigation({
    context: floatingRootContext,
    props: {
      get enabled() {
        return !disabled();
      },
      get listRef() {
        return store.context.itemDomElements.current;
      },
      get activeIndex() {
        return activeIndex();
      },
      get nested() {
        return parent().type !== undefined;
      },
      get loopFocus() {
        return loopFocus();
      },
      get orientation() {
        return orientation();
      },
      get parentOrientation() {
        const currentParent = parent();
        return currentParent.type === 'menubar' ? currentParent.context.orientation() : undefined;
      },
      get rtl() {
        return direction() === 'rtl';
      },
      disabledIndices: EMPTY_ARRAY,
      onNavigate: setActiveIndex,
      get openOnArrowKeyDown() {
        return parent().type !== 'context-menu';
      },
      get externalTree() {
        return nested() ? floatingTreeRoot() : undefined;
      },
      get focusItemOnHover() {
        return highlightItemOnHover();
      },
    },
  });

  const onTyping = (nextTyping: boolean) => {
    store.context.typingRef.current = nextTyping;
  };

  const typeahead = useTypeahead({
    context: floatingRootContext,
    props: {
      get enabled() {
        return !disabled();
      },
      get listRef() {
        return store.context.itemLabels.current;
      },
      get elementsRef() {
        return store.context.itemDomElements.current;
      },
      get activeIndex() {
        return activeIndex();
      },
      resetMs: TYPEAHEAD_RESET_MS,
      onMatch: (index) => {
        if (store.select('open') && index !== store.select('activeIndex')) {
          store.set('activeIndex', index);
        }
      },
      onTyping,
    },
  });

  // Solid: `mergeProps` returns a read-through view, so the ARIA keys React assigns afterwards are
  // merged in last instead.
  const activeTriggerProps = createMemo(
    () =>
      mergeProps(
        typeahead.reference,
        listNavigation.reference,
        dismiss.reference,
        {
          onMouseMove() {
            store.set('allowMouseEnter', true);
          },
        },
        interactionTypeProps,
        {
          'aria-haspopup': 'menu' as const,
          // Solid: ARIA booleans are strings.
          'aria-expanded': open() ? 'true' : 'false',
        },
      ) as HTMLProps,
  );

  const inactiveTriggerProps = createMemo(
    () =>
      mergeProps(listNavigation.trigger, dismiss.trigger, interactionTypeProps, {
        'aria-haspopup': 'menu' as const,
        'aria-expanded': 'false',
      }) as HTMLProps,
  );

  // The initial render has no store subscribers yet. Seed these props before triggers render so
  // the synchronization effect below doesn't make every trigger render twice in the first commit.
  store.update({ inactiveTriggerProps: untrack(inactiveTriggerProps) });

  const popupProps = createMemo(
    () =>
      mergeProps(
        FOCUSABLE_POPUP_PROPS,
        {
          id: floatingId(),
          role: 'menu' as const,
          // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
          'aria-orientation': orientation() === 'horizontal' ? 'horizontal' : undefined,
          'aria-labelledby': activeTriggerElement()?.id,
          onMouseMove() {
            store.set('allowMouseEnter', true);
            if (store.select('parent').type === 'menu') {
              store.set('hoverEnabled', false);
            }
          },
          onClick() {
            if (store.select('hoverEnabled')) {
              store.set('hoverEnabled', false);
            }
          },
          onKeyDown(event: KeyboardEvent) {
            // The Menubar's CompositeRoot captures keyboard events via
            // event delegation. This works well when Menu.Root is nested inside Menubar,
            // but with detached triggers we need to manually forward the event to the CompositeRoot.
            const relay = store.select('keyboardEventRelay');
            // Solid: native events have no `isPropagationStopped()`; `cancelBubble` reports it.
            if (relay && !event.cancelBubble) {
              relay(event);
            }
          },
        },
        typeahead.floating,
        listNavigation.floating,
        dismiss.floating,
      ) as HTMLProps,
  );

  const itemProps = () => (listNavigation.item ?? EMPTY_OBJECT) as HTMLProps;

  usePopupInteractionProps(store, {
    get activeTriggerProps() {
      return activeTriggerProps();
    },
    get inactiveTriggerProps() {
      return inactiveTriggerProps();
    },
    get popupProps() {
      return popupProps();
    },
    get itemProps() {
      return itemProps();
    },
  });

  const context: MenuRootContext<Payload> = {
    store,
    parent: parentFromContext,
  };

  const content = () => (
    <MenuRootContext value={context as MenuRootContext}>
      <ComponentWithPayload payload={payload} children={props.children} />
    </MenuRootContext>
  );

  return (
    <Show
      when={parent().type === undefined || parent().type === 'context-menu'}
      fallback={content()}
    >
      {/* set up a FloatingTree to provide the context to nested menus */}
      <FloatingTree externalTree={untrack(floatingTreeRoot)}>{content()}</FloatingTree>
    </Show>
  );
}

function useMenuRootStore<Payload>(
  initialState: Partial<MenuStoreState<Payload>>,
  floatingId: string | undefined,
  nested: boolean,
) {
  // The store is owned by this Root instance and created exactly once. It is not tied to the handle:
  // the handle attaches to it, so swapping the handle re-attaches rather than recreating state.
  // Default values are only initial values; controlled values and root state are synced after creation.
  // Unlike other popups, Menu wires its floating root context separately (it relays open changes
  // through an event).
  return untrack(() => MenuStore<Payload>(initialState, floatingId, nested));
}

export interface MenuRootState {}

export interface MenuRootProps<Payload = unknown> {
  /**
   * Whether the menu is initially open.
   *
   * To render a controlled menu, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Determines if the menu enters a modal state when open.
   * - `true`: user interaction is limited to the menu: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * Nested menus ignore this prop, and menus opened by hover are never modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: MenuRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the menu is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the menu is currently open.
   */
  open?: boolean | undefined;
  /**
   * The visual orientation of the menu.
   * Controls whether roving focus uses up/down or left/right arrow keys.
   * @default 'vertical'
   */
  orientation?: MenuRoot.Orientation | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When in a submenu, determines whether pressing the Escape key
   * closes the entire menu, or only the current child menu.
   * @default false
   */
  closeParentOnEsc?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the menu.
   *   Call this after any externally controlled closing animation finishes.
   * - `close`: When specified, the menu can be closed imperatively.
   */
  actionsRef?: ReactLikeRef<MenuRoot.Actions | null> | undefined;
  /**
   * ID of the trigger that the menu is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled menu.
   * There's no need to specify this prop when the menu is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the menu is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open menu.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the menu with a trigger.
   * If specified, allows external triggers to control the menu's open state.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * The content of the menu.
   * This can be a regular Solid node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
}

export interface MenuRootActions {
  unmount: () => void;
  close: () => void;
}

export type MenuRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.escapeKey
  | typeof REASONS.itemPress
  | typeof REASONS.closePress
  | typeof REASONS.siblingOpen
  | typeof REASONS.cancelOpen
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type MenuRootChangeEventDetails = BaseUIChangeEventDetails<MenuRoot.ChangeEventReason> & {
  preventUnmountOnClose(): void;
};

export type MenuRootOrientation = 'horizontal' | 'vertical';

export type MenuParent =
  | {
      type: 'menu';
      store: MenuStore<unknown>;
    }
  | {
      type: 'menubar';
      context: MenubarContext;
    }
  | {
      type: 'context-menu';
      context: ContextMenuRootContext;
    }
  | {
      type: 'nested-context-menu';
      context: ContextMenuRootContext;
      menuContext: MenuRootContext;
    }
  | {
      type: undefined;
    };

export namespace MenuRoot {
  export type State = MenuRootState;
  export type Props<Payload = unknown> = MenuRootProps<Payload>;
  export type Actions = MenuRootActions;
  export type ChangeEventReason = MenuRootChangeEventReason;
  export type ChangeEventDetails = MenuRootChangeEventDetails;
  export type Orientation = MenuRootOrientation;
}
