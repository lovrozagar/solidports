/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { RenderDialogRoot } from '../../dialog/root/useRenderDialogRoot';
import type { DrawerHandle } from '../handle';
import {
  createDepsEffect,
  ComponentWithPayload,
  type ReactLikeRef,
  createLayoutEffect,
} from '../../solid-helpers';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { addEventListener } from '../../utils/addEventListener';
import { isAndroid } from '../../utils/detectBrowser';
import { ownerWindow } from '../../utils/owner';
import type { PayloadChildRenderFunction } from '../../utils/popups';
import { REASONS } from '../../utils/reasons';
import { useControlled } from '../../utils/useControlled';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import {
  DrawerRootContext,
  useDrawerRootContext,
  type DrawerNestedSwipeProgressStore,
  type DrawerSnapPoint,
  type DrawerSwipeDirection,
} from './DrawerRootContext';

/**
 * Groups all parts of the drawer.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerRoot<Payload = unknown>(props: DrawerRoot.Props<Payload>) {
  const openProp = () => props.open;
  const defaultOpen = () => props.defaultOpen ?? false;
  const disablePointerDismissal = () => props.disablePointerDismissal ?? false;
  const modal = () => props.modal ?? true;
  const triggerIdProp = () => props.triggerId;
  const defaultTriggerIdProp = () => props.defaultTriggerId ?? null;
  const swipeDirection = () => props.swipeDirection ?? 'down';
  const snapToSequentialPoints = () => props.snapToSequentialPoints ?? false;
  const snapPointProp = () => props.snapPoint;

  const parentDrawerRootContext = useDrawerRootContext(true);

  const notifyParentSwipeProgressChange = parentDrawerRootContext?.onNestedSwipeProgressChange;
  const notifyParentFrontmostHeight = parentDrawerRootContext?.onNestedFrontmostHeightChange;
  const notifyParentSwipingChange = parentDrawerRootContext?.onNestedSwipingChange;
  const notifyParentHasNestedDrawer = parentDrawerRootContext?.onNestedDrawerPresenceChange;

  // Written from the popup's render effects.
  const [popupHeight, setPopupHeight] = createSignal(0, { ownedWrite: true });
  const [frontmostHeight, setFrontmostHeight] = createSignal(0, { ownedWrite: true });
  const [hasNestedDrawer, setHasNestedDrawer] = createSignal(false, { ownedWrite: true });
  const [nestedSwiping, setNestedSwiping] = createSignal(false);
  const nestedSwipeProgressStore = createNestedSwipeProgressStore();

  const resolvedDefaultSnapPoint = () =>
    props.defaultSnapPoint !== undefined ? props.defaultSnapPoint : (props.snapPoints?.[0] ?? null);
  const isSnapPointControlled = () => snapPointProp() !== undefined;

  const [activeSnapPoint, setActiveSnapPointUnwrapped] = useControlled({
    controlled: snapPointProp,
    default: resolvedDefaultSnapPoint,
    name: 'Drawer',
    state: 'snapPoint',
  });

  let isNestedDrawerOpenRef = false;
  const swipeAreaActiveRef = { current: false };

  const setActiveSnapPoint = (
    nextSnapPoint: DrawerSnapPoint | null,
    eventDetails?: DrawerRoot.SnapPointChangeEventDetails,
  ) => {
    const resolvedEventDetails = eventDetails ?? createChangeEventDetails(REASONS.none);

    props.onSnapPointChange?.(nextSnapPoint, resolvedEventDetails);

    if (resolvedEventDetails.isCanceled) {
      return;
    }

    setActiveSnapPointUnwrapped(nextSnapPoint);
  };

  const resolvedActiveSnapPoint = createMemo(() => {
    if (isSnapPointControlled()) {
      return activeSnapPoint();
    }

    if (!props.snapPoints || props.snapPoints.length === 0) {
      return activeSnapPoint();
    }

    if (
      activeSnapPoint() === null ||
      !props.snapPoints.some((snapPoint) => Object.is(snapPoint, activeSnapPoint()))
    ) {
      return resolvedDefaultSnapPoint();
    }

    return activeSnapPoint();
  });

  const onPopupHeightChange = (height: number) => {
    setPopupHeight(height);

    if (!isNestedDrawerOpenRef && height > 0) {
      setFrontmostHeight(height);
    }
  };

  const onNestedFrontmostHeightChange = (height: number) => {
    if (height > 0) {
      isNestedDrawerOpenRef = true;
      setFrontmostHeight(height);
      return;
    }

    isNestedDrawerOpenRef = false;
    const currentPopupHeight = untrack(popupHeight);
    if (currentPopupHeight > 0) {
      setFrontmostHeight(currentPopupHeight);
    }
  };

  const onNestedDrawerPresenceChange = (present: boolean) => {
    setHasNestedDrawer(present);
  };

  const onNestedSwipeProgressChange = (progress: number) => {
    nestedSwipeProgressStore.set(progress);
    notifyParentSwipeProgressChange?.(progress);
  };

  const onNestedSwipingChange = (swiping: boolean) => {
    setNestedSwiping(swiping);
    notifyParentSwipingChange?.(swiping);
  };

  const handleOpenChange = (nextOpen: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => {
    props.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (!nextOpen && props.snapPoints && props.snapPoints.length > 0) {
      setActiveSnapPoint(
        resolvedDefaultSnapPoint(),
        createChangeEventDetails(
          eventDetails.reason,
          eventDetails.event,
          eventDetails.trigger as HTMLElement | undefined,
        ),
      );
    }
  };

  const contextValue: DrawerRootContext = {
    swipeDirection,
    swipeAreaActiveRef,
    snapToSequentialPoints,
    snapPoints: () => props.snapPoints,
    activeSnapPoint: resolvedActiveSnapPoint,
    setActiveSnapPoint,
    frontmostHeight,
    popupHeight,
    hasNestedDrawer,
    nestedSwiping,
    nestedSwipeProgressStore,
    onNestedDrawerPresenceChange,
    onPopupHeightChange,
    onNestedFrontmostHeightChange,
    onNestedSwipingChange,
    onNestedSwipeProgressChange,
    notifyParentFrontmostHeight,
    notifyParentSwipingChange,
    notifyParentSwipeProgressChange,
    notifyParentHasNestedDrawer,
  };

  return (
    <DrawerRootContext value={contextValue}>
      <RenderDialogRoot
        mode="drawer"
        open={openProp()}
        defaultOpen={defaultOpen()}
        onOpenChange={handleOpenChange}
        onOpenChangeComplete={props.onOpenChangeComplete}
        disablePointerDismissal={disablePointerDismissal()}
        modal={modal()}
        actionsRef={props.actionsRef}
        handle={props.handle}
        triggerId={triggerIdProp()}
        defaultTriggerId={defaultTriggerIdProp()}
      >
        {(data) => (
          <>
            <DrawerProviderReporter />
            <ComponentWithPayload payload={() => data.payload} children={props.children} />
          </>
        )}
      </RenderDialogRoot>
    </DrawerRootContext>
  );
}

export interface DrawerRootState {}

export interface DrawerRootProps<Payload = unknown> {
  /**
   * Whether the drawer is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the drawer is initially open.
   *
   * To render a controlled drawer, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the drawer enters a modal state when open.
   * - `true`: user interaction is limited to just the drawer: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the drawer, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * Event handler called when the drawer is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the drawer is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the drawer from closing on outside presses.
   * For non-modal drawers, this also prevents the drawer from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the drawer.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the drawer imperatively when called.
   */
  actionsRef?: ReactLikeRef<DrawerRoot.Actions | null> | undefined;
  /**
   * A handle to associate the drawer with a trigger.
   * If specified, allows detached triggers to control the drawer's open state.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled drawer.
   * There's no need to specify this prop when the drawer is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open drawer.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * The content of the drawer.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * The swipe direction used to dismiss the drawer.
   * @default 'down'
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * Snap points used to position the drawer.
   * Use numbers between 0 and 1 to represent fractions of the viewport height,
   * numbers greater than 1 as pixel values, or strings in `px`/`rem` units
   * (for example, `'148px'` or `'30rem'`).
   */
  snapPoints?: DrawerSnapPoint[] | undefined;
  /**
   * Disables velocity-based snap skipping so drag distance determines the next snap point.
   * @default false
   */
  snapToSequentialPoints?: boolean | undefined;
  /**
   * The currently active snap point. Use with `onSnapPointChange` to control the snap point.
   */
  snapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * The initial snap point value when uncontrolled.
   */
  defaultSnapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * Callback fired when the snap point changes.
   */
  onSnapPointChange?:
    | ((
        snapPoint: DrawerSnapPoint | null,
        eventDetails: DrawerRoot.SnapPointChangeEventDetails,
      ) => void)
    | undefined;
}

export interface DrawerRootActions {
  unmount: () => void;
  close: () => void;
}

export type DrawerRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closeWatcher
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.swipe
  | typeof REASONS.none;

export type DrawerRootChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export type DrawerRootSnapPointChangeEventReason = DrawerRootChangeEventReason;

export type DrawerRootSnapPointChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRootSnapPointChangeEventReason>;

export namespace DrawerRoot {
  export type State = DrawerRootState;
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type Actions = DrawerRootActions;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = DrawerSnapPoint;
}

interface NestedSwipeProgressStore extends DrawerNestedSwipeProgressStore {
  set: (progress: number) => void;
}

function createNestedSwipeProgressStore(): NestedSwipeProgressStore {
  let progress = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => progress,
    set(nextProgress) {
      const resolved = Number.isFinite(nextProgress) ? nextProgress : 0;
      if (resolved === progress) {
        return;
      }

      progress = resolved;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function DrawerProviderReporter() {
  const providerContext = useDrawerProviderContext();
  const store = useDialogRootContext(false);
  const setDrawerOpen = providerContext?.setDrawerOpen;
  const removeDrawer = providerContext?.removeDrawer;

  const open = store.useState('open');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const popupElement = store.useState('popupElement');

  const isTopmost = () => nestedOpenDialogCount() === 0;

  // The provider and store are fixed for the reporter's lifetime. A layout effect's cleanup, as
  // React's: it never runs on the server, where the reporter registered nothing.
  createLayoutEffect(
    () => undefined,
    () => () => {
      removeDrawer?.(store);
    },
  );

  createLayoutEffect(open, (isOpen) => {
    setDrawerOpen?.(store, isOpen);
  });

  createDepsEffect(
    () => ({ open: open(), isTopmost: isTopmost(), popupElement: popupElement() }),
    (deps) => {
      // CloseWatcher enables the Android back gesture (Chromium-only).
      // Keep this Android-only for now to avoid interfering with Escape/nesting semantics on desktop due to `useDismiss`.
      if (!deps.open || !deps.isTopmost || !isAndroid) {
        return undefined;
      }

      const win = ownerWindow(deps.popupElement);

      const CloseWatcherCtor = (win as Window & { CloseWatcher?: (new () => any) | undefined })
        .CloseWatcher;
      if (!CloseWatcherCtor) {
        return undefined;
      }

      function handleCloseWatcher(event: Event) {
        if (!store.select('open')) {
          return;
        }
        store.setOpen(false, createChangeEventDetails(REASONS.closeWatcher, event));
      }

      const closeWatcher = new CloseWatcherCtor();
      const unsubscribe = addEventListener(closeWatcher, 'close', handleCloseWatcher);

      return () => {
        unsubscribe();
        closeWatcher.destroy();
      };
    },
  );

  return null;
}
