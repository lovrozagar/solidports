import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import {
  safePolygon,
  useClick,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
  useFocus,
  useHoverReferenceInteraction,
} from '../../floating-ui-solid';
import { FloatingTreeStore } from '../../floating-ui-solid/components/FloatingTreeStore';
import { contains } from '../../floating-ui-solid/utils';
import { useButton } from '../../internals/use-button/useButton';
import { useMenubarContext } from '../../menubar/MenubarContext';
import { mergeProps } from '../../merge-props';
import { live, splitComponentProps, type ReactLikeRef } from '../../solid-helpers';
import { PATIENT_CLICK_THRESHOLD } from '../../utils/constants';
import { EMPTY_OBJECT } from '../../utils/empty';
import { TriggerFocusGuards } from '../../utils/popups/TriggerFocusGuards';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { ownerDocument } from '../../utils/owner';
import {
  usePopupHandleStore,
  useTriggerDataForwarding,
  useTriggerFocusGuards,
} from '../../utils/popups';
import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useMixedToggleClickHandler } from '../../utils/useMixedToggleClickHandler';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { MenuParent } from '../root/MenuRoot';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuHandle } from '../store/MenuHandle';
import type { MenuStore } from '../store/MenuStore';
import { findRootOwnerId } from '../utils/findRootOwnerId';

/**
 * A button that opens the menu.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuTrigger<Payload>(componentProps: MenuTrigger.Props<Payload>) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'nativeButton',
    'id',
    'openOnHover',
    'delay',
    'closeDelay',
    'handle',
    'payload',
  ]);
  const disabledProp = () => local.disabled ?? false;
  const nativeButton = () => local.nativeButton ?? true;
  const idProp = () => local.id;
  const openOnHoverProp = () => local.openOnHover;
  const delay = () => local.delay ?? 100;
  const closeDelay = () => local.closeDelay ?? 0;

  const rootContext = useMenuRootContext(true);
  const handleStore = usePopupHandleStore(() => local.handle);
  // Solid: an accessor, as the handle's store pointer changes when a root attaches or detaches.
  // The live `MenuStore` and the detached fallback store share every member the trigger uses.
  // `live`: tracked inside computations, a plain latest read in handlers and refs.
  const store = live(() => (handleStore() ?? rootContext?.store) as MenuStore<Payload>);
  if (!untrack(store)) {
    throw new Error(
      'Base UI: <Menu.Trigger> must be either used within a <Menu.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = createMemo(() => store().select('isTriggerActive', thisTriggerId));
  const floatingRootContext = () => store().context.floatingRootContext;
  const isOpenedByThisTrigger = createMemo(() =>
    store().select('isOpenedByTrigger', thisTriggerId),
  );
  const popupId = createMemo(() => store().select('triggerPopupId', thisTriggerId));

  const triggerElementRef: ReactLikeRef<HTMLElement | null | undefined> = { current: null };
  // Solid: a signal mirror of `triggerElementRef` so the hover hook re-attaches its listeners once
  // the element exists (React re-renders on the ref assignment's commit).
  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null | undefined>(null);

  const parent = useMenuParent();
  // A trigger in a menubar reports the menu it opens, so the menubar derives `hasSubmenuOpen`.
  if (parent.type === 'menubar') {
    parent.context.registerMenu({
      open: isOpenedByThisTrigger,
      lastOpenChangeReason: () => store().select('lastOpenChangeReason'),
    });
  }
  const compositeRootContext = useCompositeRootContext(true);
  const floatingTreeRootFromContext = useFloatingTree();
  const floatingTreeRoot: FloatingTreeStore =
    floatingTreeRootFromContext ?? new FloatingTreeStore();

  const floatingNodeId = useFloatingNodeId(floatingTreeRoot);
  const floatingParentNodeId = useFloatingParentNodeId();

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      get payload() {
        return local.payload;
      },
      get closeDelay() {
        return closeDelay();
      },
      parent,
      floatingTreeRoot,
      get floatingNodeId() {
        return floatingNodeId();
      },
      floatingParentNodeId,
      // Solid: the composite root's relay is its `onKeyDown` handler function.
      keyboardEventRelay: compositeRootContext?.relayKeyboardEvent as
        ((event: KeyboardEvent) => void) | undefined,
    },
  );

  const isInMenubar = parent.type === 'menubar';

  const rootDisabled = createMemo(() => store().select('disabled'));
  const disabled = createMemo(
    () =>
      disabledProp() || rootDisabled() || (parent.type === 'menubar' && parent.context.disabled()),
  );

  const { buttonSources, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  createEffect(
    () => ({ currentStore: store(), openedByThisTrigger: isOpenedByThisTrigger() }),
    ({ currentStore, openedByThisTrigger }) => {
      if (!openedByThisTrigger && parent.type === undefined) {
        currentStore.context.allowMouseUpTriggerRef.current = false;
      }
    },
  );

  const triggerRef: ReactLikeRef<HTMLElement | null | undefined> = { current: null };
  const allowMouseUpTriggerTimeout = useTimeout();

  // A handler: reads the latest store.
  const handleDocumentMouseUp = (mouseEvent: MouseEvent) =>
    untrack(() => {
      if (!triggerRef.current) {
        return;
      }

      const currentStore = store();
      allowMouseUpTriggerTimeout.clear();
      currentStore.context.allowMouseUpTriggerRef.current = false;

      const mouseUpTarget = mouseEvent.target as Element | null;

      if (
        contains(triggerRef.current, mouseUpTarget) ||
        contains(currentStore.select('positionerElement'), mouseUpTarget) ||
        mouseUpTarget === triggerRef.current
      ) {
        return;
      }

      if (
        mouseUpTarget != null &&
        findRootOwnerId(mouseUpTarget) === currentStore.select('rootId')
      ) {
        return;
      }

      if (isMouseWithinBounds(mouseEvent, triggerRef.current)) {
        return;
      }

      floatingTreeRoot.events.emit('close', { domEvent: mouseEvent, reason: REASONS.cancelOpen });
    });

  createEffect(
    () => ({ currentStore: store(), openedByThisTrigger: isOpenedByThisTrigger() }),
    ({ currentStore, openedByThisTrigger }) => {
      if (
        openedByThisTrigger &&
        currentStore.select('lastOpenChangeReason') === REASONS.triggerHover
      ) {
        const doc = ownerDocument(triggerRef.current ?? null);
        doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
      }
    },
  );

  const parentMenubarHasSubmenuOpen = createMemo(
    () => parent.type === 'menubar' && parent.context.hasSubmenuOpen(),
  );
  const openOnHover = () => openOnHoverProp() ?? parentMenubarHasSubmenuOpen();

  const hoverProps = useHoverReferenceInteraction({
    get context() {
      return floatingRootContext();
    },
    props: {
      get enabled() {
        return (
          openOnHover() &&
          !disabled() &&
          (!isInMenubar || (parentMenubarHasSubmenuOpen() && !isMountedByThisTrigger()))
        );
      },
      handleClose: safePolygon({ blockPointerEvents: !isInMenubar }),
      mouseOnly: true,
      move: false,
      get restMs() {
        return parent.type === undefined ? delay() : undefined;
      },
      get delay() {
        return { close: closeDelay() };
      },
      get triggerElementRef() {
        return triggerElement();
      },
      externalTree: floatingTreeRoot,
      get isActiveTrigger() {
        return isTriggerActive();
      },
      isClosing: () => store().select('transitionStatus') === 'ending',
    },
  });

  // Whether to ignore clicks to open the menu.
  // `lastOpenChangeReason` doesn't need to be reactive here, as we need to run this
  // only when `isOpenedByThisTrigger` changes.
  const stickIfOpen = useStickIfOpen(isOpenedByThisTrigger, () =>
    untrack(() => store().select('lastOpenChangeReason')),
  );

  const click = useClick({
    get context() {
      return floatingRootContext();
    },
    props: {
      get enabled() {
        return !disabled();
      },
      get event() {
        return isOpenedByThisTrigger() && isInMenubar ? 'click' : 'mousedown';
      },
      toggle: true,
      ignoreMouse: false,
      get stickIfOpen() {
        return parent.type === undefined ? stickIfOpen() : false;
      },
    },
  });

  const focus = useFocus({
    get context() {
      return floatingRootContext();
    },
    props: {
      get enabled() {
        return !disabled() && parentMenubarHasSubmenuOpen();
      },
    },
  });

  const mixedToggleHandlers = useMixedToggleClickHandler({
    open: isOpenedByThisTrigger,
    enabled: isInMenubar,
    mouseDownAction: 'open',
  });

  const localInteractionProps = createMemo(
    () => mergeProps(focus.reference, click.reference) as HTMLProps,
  );

  const rootTriggerProps = createMemo(() => store().select('triggerProps', isMountedByThisTrigger));

  const { preFocusGuardRef, handlePreFocusGuardFocus, handleFocusTargetFocus } =
    useTriggerFocusGuards(store, triggerElementRef);

  const state: MenuTrigger.State = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const ref = [
    (element: HTMLElement | null | undefined) => {
      triggerRef.current = element;
    },
    buttonRef,
    registerTrigger,
    (element: HTMLElement | null | undefined) => {
      triggerElementRef.current = element;
      setTriggerElement(element);
    },
  ];

  // A static list whose changing parts are read per key (accessor sources and getters): a state
  // change updates its attribute without rebuilding the trigger's props chain.
  const props = [
    ...buttonSources.attributes,
    propsSourceAccessor(localInteractionProps),
    hoverProps ?? EMPTY_OBJECT,
    propsSourceAccessor(rootTriggerProps),
    {
      'aria-haspopup': 'menu' as const,
      get 'aria-controls'() {
        return popupId();
      },
      get id() {
        return thisTriggerId();
      },
      onMouseDown: (event: MouseEvent) => {
        const currentStore = store();
        if (currentStore.select('open')) {
          return;
        }

        // mousedown -> mouseup on menu item should not trigger it within 200ms.
        allowMouseUpTriggerTimeout.start(200, () => {
          currentStore.context.allowMouseUpTriggerRef.current = true;
        });

        const doc = ownerDocument(event.currentTarget as Element);
        doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
      },
    },
    isInMenubar ? { role: 'menuitem' } : {},
    propsSourceAccessor(mixedToggleHandlers),
    elementProps,
    buttonSources.handlers,
  ];

  const element = useRenderElement('button', componentProps, {
    enabled: !isInMenubar,
    stateAttributesMapping: pressableTriggerOpenStateMapping,
    state,
    ref,
    props,
  });

  if (isInMenubar) {
    // Solid: `CompositeItem` does not receive `componentProps`, so the user ref joins its refs.
    const forwardUserRef = (element: HTMLElement | null | undefined) => {
      const userRef = componentProps.ref as
        | ((el: HTMLElement | null | undefined) => void)
        | ReactLikeRef<HTMLElement | null | undefined>
        | undefined;
      if (typeof userRef === 'function') {
        userRef(element);
      } else if (userRef != null) {
        userRef.current = element;
      }
    };

    return (
      <CompositeItem
        tag="button"
        render={renderProps.render}
        class={renderProps.class}
        state={state}
        refs={[forwardUserRef, ...ref]}
        props={props}
        stateAttributesMapping={pressableTriggerOpenStateMapping}
      />
    );
  }

  return (
    <TriggerFocusGuards
      active={isOpenedByThisTrigger()}
      leadingGuardRef={preFocusGuardRef}
      onLeadingFocus={handlePreFocusGuardFocus}
      trailingGuardRef={store().context.triggerFocusTargetRef}
      onTrailingFocus={handleFocusTargetFocus}
    >
      {element()}
    </TriggerFocusGuards>
  );
}

export interface MenuTriggerProps<Payload = unknown>
  extends NativeButtonProps, BaseUIComponentProps<'button', MenuTriggerState> {
  children?: JSX.Element;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the trigger with a menu.
   */
  handle?: MenuHandle<Payload> | undefined;
  /**
   * A payload to pass to the menu when it is opened.
   */
  // Inferred from `handle` (React gets this from method bivariance), so the payload must match it.
  payload?: NoInfer<Payload> | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   */
  openOnHover?: boolean | undefined;
}

export interface MenuTriggerState {
  /**
   * Whether the menu is currently open and was opened by this trigger.
   */
  open: boolean;
  /**
   * Whether the trigger is disabled.
   */
  disabled: boolean;
}

export namespace MenuTrigger {
  export type Props<Payload = unknown> = MenuTriggerProps<Payload>;
  export type State = MenuTriggerState;
}

/**
 * Determines whether to ignore clicks after a hover-open.
 */
function useStickIfOpen(open: Accessor<boolean>, openReason: Accessor<string | null>) {
  const stickIfOpenTimeout = useTimeout();
  // Only allow "patient" clicks to close the menu if it's open: a menu opened by hover sticks
  // for a moment. Derived from the open change (a writable memo); the timeout ends it.
  const [stickIfOpen, setStickIfOpen] = createSignal<boolean>(
    () => open() && untrack(openReason) === REASONS.triggerHover,
    { ownedWrite: true },
  );
  createEffect(stickIfOpen, (stick) => {
    if (stick) {
      stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
        setStickIfOpen(false);
      });
    } else {
      stickIfOpenTimeout.clear();
    }
  });

  return stickIfOpen;
}

function useMenuParent() {
  const menubarContext = useMenubarContext(true);

  // Solid: contexts are fixed for the component's lifetime, so this is computed once.
  const parent: MenuParent = menubarContext
    ? {
        type: 'menubar',
        context: menubarContext,
      }
    : {
        type: undefined,
      };

  return parent;
}
