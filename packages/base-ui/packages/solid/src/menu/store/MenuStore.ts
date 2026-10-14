import { untrack } from 'solid-js';
import { FloatingTreeStore } from '../../floating-ui-solid/components/FloatingTreeStore';
import type { ReactLikeRef } from '../../solid-helpers';
import type { AdaptiveOriginMiddleware } from '../../utils/adaptiveOriginConstants';
import { platform } from '../../utils/platform';
import { EMPTY_OBJECT, NOOP } from '../../utils/empty';
import { NullStore } from '../../utils/NullStore';
import type { PopupStoreContext, PopupStoreState, PopupTriggerStoreKeys } from '../../utils/popups';
import {
  createInitialPopupStoreState,
  createPopupFloatingRootContext,
  popupStoreSelectors,
  PopupTriggerMap,
} from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import type { HTMLProps } from '../../utils/types';
import type { InteractionType } from '../../utils/useEnhancedClickHandler';
import type { MenuParent, MenuRoot } from '../root/MenuRoot';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  modal: boolean | undefined;
  openMethod: InteractionType | null;
  /** Whether the popup last opened from the keyboard or an assistive-technology press. */
  keyboardOpen: boolean;
  allowMouseEnter: boolean;
  highlightItemOnHover: boolean;
  parent: MenuParent;
  rootId: string | undefined;
  activeIndex: number | null;
  /** The `Menu.List` element, which takes the `menu` role from the popup when rendered. */
  listElement: HTMLElement | null;
  /**
   * The id the `Menu.List` element renders with. Solid: the store has no `notifyAll()` to make
   * subscribers re-read the stored element's id, so the id is state of its own.
   */
  listId: string | undefined;
  /**
   * Props a filter root adds to its triggers (dialog semantics and the key relay to the input).
   * Published by the filter implementation so a plain menu never bundles them.
   */
  filterTriggerProps: HTMLProps;
  /** List navigation props for the element that holds real focus under virtual focus. */
  inputProps: HTMLProps;
  /** Whether this menu's filter input has focus. */
  inputFocused: boolean;
  /** The element at `activeIndex` once the item list settles. Only virtual focus publishes it. */
  highlightedItem: HTMLElement | undefined;
  hoverEnabled: boolean;
  instantType: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
  openChangeReason: MenuRoot.ChangeEventReason | null;
  floatingTreeRoot: FloatingTreeStore;
  floatingNodeId: string | undefined;
  floatingParentNodeId: string | null;
  itemProps: HTMLProps;
  closeDelay: number;
  keyboardEventRelay: ((event: KeyboardEvent) => void) | undefined;
  adaptiveOrigin: AdaptiveOriginMiddleware | undefined;
};

type Context = PopupStoreContext<MenuRoot.ChangeEventDetails> & {
  readonly positionerRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly popupRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly typingRef: ReactLikeRef<boolean>;
  readonly itemDomElements: ReactLikeRef<(HTMLElement | null | undefined)[]>;
  readonly itemLabels: ReactLikeRef<(string | null)[]>;
  /** Why the next `activeIndex` write happens. */
  highlightReason: MenuRoot.HighlightEventReason;
  /** The event that caused the next `activeIndex` write. */
  highlightEvent: Event | undefined;
  /** The item last committed as highlighted. */
  reportedItem: HTMLElement | undefined;
  allowMouseUpTriggerRef: ReactLikeRef<boolean>;
  /** The element that holds real focus while virtual list navigation is active. */
  virtualFocusRef: ReactLikeRef<HTMLElement | null> | undefined;
  /** Whether a filterable menu's trigger was last pressed by a screen reader. */
  virtualPress?: boolean | undefined;
  readonly beforeTriggerFocusGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly triggerFocusTargetRef: ReactLikeRef<HTMLElement | null | undefined>;
  readonly beforeContentFocusGuardRef: ReactLikeRef<HTMLElement | null | undefined>;
};

const selectors = {
  ...popupStoreSelectors,
  disabled: (state: State<unknown>) =>
    state.parent.type === 'menubar'
      ? state.parent.context.disabled() || state.disabled
      : state.disabled,
  modal: (state: State<unknown>) =>
    (state.parent.type === undefined || state.parent.type === 'context-menu') &&
    (state.modal ?? true),
  openMethod: (state: State<unknown>) => state.openMethod,
  keyboardOpen: (state: State<unknown>) => state.keyboardOpen,

  allowMouseEnter: (state: State<unknown>) => state.allowMouseEnter,
  highlightItemOnHover: (state: State<unknown>) => state.highlightItemOnHover,
  parent: (state: State<unknown>) => state.parent,
  rootId: (state: State<unknown>): string | undefined => {
    if (state.parent.type === 'menu') {
      return state.parent.store.select('rootId');
    }

    return state.parent.type !== undefined ? state.parent.context.rootId() : state.rootId;
  },
  activeIndex: (state: State<unknown>) => state.activeIndex,
  listElement: (state: State<unknown>) => state.listElement,
  listId: (state: State<unknown>) => state.listId,
  /** The trigger's `aria-controls`: the list when one holds the `menu` role, else the popup. */
  triggerControlsId: (state: State<unknown>, triggerId: () => string | undefined) => {
    const popupId = popupStoreSelectors.triggerPopupId(state, triggerId);
    return popupId ? (state.listElement ? state.listId : undefined) || popupId : undefined;
  },
  filterTriggerProps: (state: State<unknown>) => state.filterTriggerProps,
  inputProps: (state: State<unknown>) => state.inputProps,
  highlightedItem: (state: State<unknown>) => state.highlightedItem,
  // Solid: selector args are accessors.
  webkitAriaSelected: (state: State<unknown>, highlighted: () => boolean) =>
    platform.engine.webkit && state.inputFocused && highlighted() ? true : undefined,
  highlightedItemId: (state: State<unknown>) => state.highlightedItem?.id || undefined,
  // Solid: selector args are accessors.
  isActive: (state: State<unknown>, itemIndex: () => number) => state.activeIndex === itemIndex(),
  hoverEnabled: (state: State<unknown>) => state.hoverEnabled,
  // `trigger-change` describes a popup moving between triggers, which only has
  // meaning while it is open. Dropping it once closed keeps a late or stale
  // restoration from marking a closing popup instant and skipping its exit
  // transition, including on close paths that never reach `setOpen`.
  instantType: (state: State<unknown>) =>
    state.instantType === 'trigger-change' && !popupStoreSelectors.open(state)
      ? undefined
      : state.instantType,
  lastOpenChangeReason: (state: State<unknown>) => state.openChangeReason,
  floatingTreeRoot: (state: State<unknown>): FloatingTreeStore => {
    if (state.parent.type === 'menu') {
      return state.parent.store.select('floatingTreeRoot');
    }

    return state.floatingTreeRoot;
  },
  floatingNodeId: (state: State<unknown>) => state.floatingNodeId,
  floatingParentNodeId: (state: State<unknown>) => state.floatingParentNodeId,
  itemProps: (state: State<unknown>) => state.itemProps,
  closeDelay: (state: State<unknown>) => state.closeDelay,
  adaptiveOrigin: (state: State<unknown>): AdaptiveOriginMiddleware | undefined =>
    state.adaptiveOrigin,
  keyboardEventRelay: (state: State<unknown>): ((event: KeyboardEvent) => void) | undefined => {
    if (state.keyboardEventRelay) {
      return state.keyboardEventRelay;
    }

    if (state.parent.type === 'menu') {
      return state.parent.store.select('keyboardEventRelay');
    }

    return undefined;
  },
};

type Selectors = typeof selectors;

type MenuSetOpen = (
  open: boolean,
  eventDetails: Omit<MenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
) => void;

/**
 * The store view that detached handle-backed triggers read from. Both the real `MenuStore` and the
 * inert fallback store satisfy it, so a trigger can read from whichever store the handle currently
 * exposes. Narrowed to the members a trigger actually uses — the trigger-data members plus `setOpen`
 * (called by the focus guards) — so the exposed surface can't bypass the open-change pipeline; on
 * the detached fallback store every one of these mutations is a no-op.
 */
export type MenuHandleStore<Payload> = Pick<MenuStore<Payload>, PopupTriggerStoreKeys | 'setOpen'>;

export function MenuStore<Payload>(
  initialState?: Partial<State<Payload>>,
  floatingId?: string | undefined,
  nested = false,
) {
  const triggerElements = new PopupTriggerMap();
  const store = SolidStore<State<Payload>, Context, Selectors>(
    createInitialState<Payload>(initialState),
    createInitialContext(triggerElements, floatingId, nested),
    selectors,
  );

  // Set up propagation of state from parent menu if applicable.
  // Solid: selectors that read the parent store are tracked directly, so React's re-notify on
  // parent changes is not needed; only the shared mouse-up ref is wired here.
  store.observe('parent', (parent) => {
    if (parent.type === 'menu') {
      store.context.allowMouseUpTriggerRef = parent.store.context.allowMouseUpTriggerRef;
      return;
    }

    if (parent.type !== undefined) {
      store.context.allowMouseUpTriggerRef = parent.context.allowMouseUpTriggerRef;
    }
  });

  function setOpen(open: boolean, eventDetails: Parameters<MenuSetOpen>[1]) {
    store.context.floatingRootContext.context.events.emit('setOpen', { open, eventDetails });
  }

  function setActiveIndex(
    activeIndex: number | null,
    reason: MenuRoot.HighlightEventReason,
    event?: Event | undefined,
  ) {
    // Only a write that changes the index is reported. Tagging a no-op would let a later
    // registry-driven re-emit report this reason instead of `none`.
    if (store.state.activeIndex !== activeIndex) {
      const item =
        activeIndex === null ? undefined : store.context.itemDomElements.current[activeIndex];
      const isWriteBack = item === store.context.reportedItem;
      store.context.highlightReason = isWriteBack ? 'none' : reason;
      store.context.highlightEvent = isWriteBack ? undefined : event;
    }
    store.set('activeIndex', activeIndex);
  }

  function highlightItem(
    element: Element | null | undefined,
    reason: MenuRoot.HighlightEventReason,
    event?: Event | undefined,
  ) {
    const index = store.context.itemDomElements.current.indexOf(element as HTMLElement);
    if (index > -1) {
      setActiveIndex(index, reason, event);
    }
  }

  return Object.assign(store, { setOpen: setOpen as MenuSetOpen, setActiveIndex, highlightItem });
}

export type MenuStore<Payload> = ReturnType<typeof MenuStore<Payload>>;

/**
 * Creates the inert fallback store used by detached handle-backed triggers while no `Menu.Root` is
 * attached. It preserves a menu-specific trigger registry in context so detached triggers can
 * register before migrating to the live root store. `setOpen` is a no-op (matching the inert
 * reads/writes of `NullStore`), so a trigger can hand the store to focus-guard helpers that expect
 * `setOpen` without it ever taking effect while detached.
 */
export function createNullMenuStore<Payload>(): MenuHandleStore<Payload> {
  const triggerElements = new PopupTriggerMap();
  // `NullStore` takes a plain state object: snapshot the default state once.
  const [initialState] = createInitialState<Payload>();
  const store = NullStore<State<Payload>, Context, Selectors>(
    untrack(() => ({ ...initialState })),
    Object.freeze(createInitialContext(triggerElements)),
    selectors,
  );
  return Object.assign(store, { setOpen: NOOP as MenuSetOpen });
}

function createInitialContext(
  triggerElements: PopupTriggerMap,
  floatingId?: string | undefined,
  nested = false,
): Context {
  return {
    positionerRef: { current: null },
    popupRef: { current: null },
    typingRef: { current: false },
    itemDomElements: { current: [] },
    itemLabels: { current: [] },
    highlightReason: 'none',
    highlightEvent: undefined,
    reportedItem: undefined,
    allowMouseUpTriggerRef: { current: false },
    virtualFocusRef: undefined,
    beforeTriggerFocusGuardRef: { current: null },
    triggerFocusTargetRef: { current: null },
    beforeContentFocusGuardRef: { current: null },
    onOpenChangeComplete: undefined,
    triggerElements,
    // Solid keeps the floating root in context (React keeps it in state); see `usePopupRootStore`.
    floatingRootContext: createPopupFloatingRootContext(triggerElements, floatingId, nested),
  };
}

function createInitialState<Payload>(initialState?: Partial<State<Payload>>) {
  // Initial values: the spread reads the caller's getters once.
  return untrack(() =>
    createInitialPopupStoreState<Payload, State<Payload>>({
      disabled: false,
      modal: true,
      openMethod: null,
      keyboardOpen: false,
      allowMouseEnter: false,
      highlightItemOnHover: true,
      parent: {
        type: undefined,
      },
      rootId: undefined,
      activeIndex: null,
      listElement: null,
      listId: undefined,
      filterTriggerProps: EMPTY_OBJECT as HTMLProps,
      inputProps: EMPTY_OBJECT as HTMLProps,
      inputFocused: false,
      highlightedItem: undefined,
      hoverEnabled: true,
      instantType: undefined,
      openChangeReason: null,
      floatingTreeRoot: new FloatingTreeStore(),
      floatingNodeId: undefined,
      floatingParentNodeId: null,
      itemProps: EMPTY_OBJECT as HTMLProps,
      keyboardEventRelay: undefined,
      closeDelay: 0,
      adaptiveOrigin: undefined,
      ...initialState,
    }),
  );
}
