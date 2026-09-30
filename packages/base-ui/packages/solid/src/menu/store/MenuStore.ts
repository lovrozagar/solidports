import { type Accessor, mergeProps as solidMergeProps } from 'solid-js';
import { FloatingTreeStore } from '../../floating-ui-solid/components/FloatingTreeStore';
import { getEmptyRootContext } from '../../floating-ui-solid/utils/getEmptyRootContext';
import type { ReactLikeRef } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/empty';
import {
  createInitialPopupStoreState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
} from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { HTMLProps } from '../../utils/types';
import type { MenuParent, MenuRoot } from '../root/MenuRoot';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  modal: boolean;
  openMethod: string | null;
  allowMouseEnter: boolean;
  rootId: string | undefined;
  activeIndex: number | null;
  hoverEnabled: boolean;
  stickIfOpen: boolean;
  instantType: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
  openChangeReason: MenuRoot.ChangeEventReason | null;
  floatingNodeId: string | undefined;
  floatingParentNodeId: string | null;
  itemProps: HTMLProps;
  closeDelay: number;
  keyboardEventRelay: ((event: KeyboardEvent) => void) | undefined;
  hasViewport: boolean;
  readonly context: Context;
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
  hasExplicitFinalFocus: boolean;
  parent: MenuParent;
  floatingTreeRoot: FloatingTreeStore;
};

const selectors = {
  ...popupStoreSelectors,
  activeIndex: (state: State<unknown>) => state.activeIndex,

  allowMouseEnter: (state: State<unknown>) => state.allowMouseEnter,

  closeDelay: (state: State<unknown>) => state.closeDelay,
  disabled: (state: State<unknown>) =>
    state.context.parent.type === 'menubar'
      ? state.context.parent.context.disabled() || state.disabled
      : state.disabled,
  floatingNodeId: (state: State<unknown>) => state.floatingNodeId,
  floatingParentNodeId: (state: State<unknown>) => state.floatingParentNodeId,
  floatingTreeRoot: (state: State<unknown>): FloatingTreeStore => {
    if (state.context.parent.type === 'menu') {
      return state.context.parent.store.select('floatingTreeRoot');
    }

    return state.context.floatingTreeRoot;
  },
  hasViewport: (state: State<unknown>) => state.hasViewport,
  hoverEnabled: (state: State<unknown>) => state.hoverEnabled,
  instantType: (state: State<unknown>) => state.instantType,
  isActive: (state: State<unknown>, itemIndex: Accessor<number>) =>
    state.activeIndex === itemIndex(),
  itemProps: (state: State<unknown>) => state.itemProps,
  keyboardEventRelay: (state: State<unknown>): ((event: KeyboardEvent) => void) | undefined => {
    if (state.keyboardEventRelay) {
      return state.keyboardEventRelay;
    }

    if (state.context.parent.type === 'menu') {
      return state.context.parent.store.select('keyboardEventRelay');
    }

    return undefined;
  },
  lastOpenChangeReason: (state: State<unknown>) => state.openChangeReason,
  modal: (state: State<unknown>) =>
    (state.context.parent.type === undefined || state.context.parent.type === 'context-menu') &&
    (state.modal ?? true),
  openMethod: (state: State<unknown>) => state.openMethod,
  parent: (state: State<unknown>) => state.context.parent,
  rootId: (state: State<unknown>): string | undefined => {
    if (state.context.parent.type === 'menu') {
      return state.context.parent.store.select('rootId');
    }

    return state.context.parent.type !== undefined
      ? state.context.parent.context.rootId()
      : state.rootId;
  },
  stickIfOpen: (state: State<unknown>) => state.stickIfOpen,
};

export function MenuStore<Payload>(
  initialState?: Partial<State<Payload>>,
  initialContext?: Partial<Context>,
) {
  const ctx: Context = {
    allowMouseUpTriggerRef: { current: false },
    beforeContentFocusGuardRef: { current: null },
    floatingRootContext: getEmptyRootContext(),
    floatingTreeRoot: new FloatingTreeStore(),
    hasExplicitFinalFocus: false,
    itemDomElements: { current: [] },
    itemLabels: { current: [] },
    onOpenChangeComplete: undefined,
    parent: { type: undefined },
    popupRef: { current: null },
    positionerRef: { current: null },
    triggerElements: new PopupTriggerMap(),
    triggerFocusTargetRef: { current: null },
    typingRef: { current: false },
    ...initialContext,
  };

  if (ctx.parent.type === 'menu') {
    ctx.allowMouseUpTriggerRef = ctx.parent.store.context.allowMouseUpTriggerRef;
  } else if (ctx.parent.type !== undefined) {
    ctx.allowMouseUpTriggerRef = ctx.parent.context.allowMouseUpTriggerRef;
  }

  const [state, setState] = createInitialState(initialState, ctx);
  const store = SolidStore<State<Payload>, Context, typeof selectors>(
    [state, setState],
    ctx,
    selectors,
  );

  function setOpen(
    open: boolean,
    eventDetails: Omit<MenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) {
    store.context.floatingRootContext.context.events.emit('setOpen', { eventDetails, open });
  }

  const merged = solidMergeProps(store, { setOpen });
  return merged;
}

function createInitialState<Payload>(
  initialState?: Partial<State<Payload>>,
  initialContext?: Context,
) {
  return createInitialPopupStoreState<Payload, State<Payload>>({
    activeIndex: null,
    allowMouseEnter: false,
    closeDelay: 0,
    get context() {
      return initialContext as Context;
    },
    disabled: false,

    floatingNodeId: undefined,
    floatingParentNodeId: null,
    hasViewport: false,
    hoverEnabled: true,
    instantType: undefined,
    itemProps: EMPTY_OBJECT as HTMLProps,
    keyboardEventRelay: undefined,
    modal: true,
    openChangeReason: null,
    openMethod: null,
    rootId: undefined,
    stickIfOpen: true,
    ...initialState,
  });
}

MenuStore.useStore = <_Payload>(
  externalStore: MenuStore<_Payload> | undefined,
  _initialState: Partial<State<_Payload>>,
): MenuStore<_Payload> => {
  return externalStore ?? MenuStore<_Payload>(_initialState);
};

export type MenuStore<Payload> = ReturnType<typeof MenuStore<Payload>>;
