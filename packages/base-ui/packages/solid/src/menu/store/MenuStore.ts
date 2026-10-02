import { untrack } from 'solid-js';
import { FloatingTreeStore } from '../../floating-ui-solid/components/FloatingTreeStore';
import type { ReactLikeRef } from '../../solid-helpers';
import type { AdaptiveOriginMiddleware } from '../../utils/adaptiveOriginConstants';
import { EMPTY_OBJECT, NOOP } from '../../utils/empty';
import { NullStore } from '../../utils/NullStore';
import {
  createInitialPopupStoreState,
  createPopupFloatingRootContext,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
  type PopupTriggerStoreKeys,
} from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { HTMLProps } from '../../utils/types';
import type { InteractionType } from '../../utils/useEnhancedClickHandler';
import type { MenuParent, MenuRoot } from '../root/MenuRoot';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  modal: boolean | undefined;
  openMethod: InteractionType | null;
  allowMouseEnter: boolean;
  highlightItemOnHover: boolean;
  parent: MenuParent;
  rootId: string | undefined;
  activeIndex: number | null;
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
  allowMouseUpTriggerRef: ReactLikeRef<boolean>;
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
  // Solid: selector args are accessors.
  isActive: (state: State<unknown>, itemIndex: () => number) => state.activeIndex === itemIndex(),
  hoverEnabled: (state: State<unknown>) => state.hoverEnabled,
  instantType: (state: State<unknown>) => state.instantType,
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

  return Object.assign(store, { setOpen: setOpen as MenuSetOpen });
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
    allowMouseUpTriggerRef: { current: false },
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
      allowMouseEnter: false,
      highlightItemOnHover: true,
      parent: {
        type: undefined,
      },
      rootId: undefined,
      activeIndex: null,
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
