import { EMPTY_OBJECT, NOOP } from '../utils/empty';
import { SolidStore } from '../utils/store/SolidStoreV2';

export type State = {
  visibleItemIds: ReadonlySet<symbol> | null;
  registeredItemCount: number;
};

export const selectors = {
  visibleItemIds: (state: State) => state.visibleItemIds,
  // A null `visibleItemIds` means no query, so fall back to whether anything registered.
  isEmpty: (state: State) =>
    state.visibleItemIds === null
      ? state.registeredItemCount === 0
      : state.visibleItemIds.size === 0,
  isItemVisible: (state: State, id: symbol) =>
    state.visibleItemIds === null || state.visibleItemIds.has(id),
};

export function createFilterDropdownStore() {
  return SolidStore<State, Record<string, never>, typeof selectors>(
    { visibleItemIds: null, registeredItemCount: 0 },
    EMPTY_OBJECT,
    selectors,
  );
}

export type FilterDropdownStore = ReturnType<typeof createFilterDropdownStore>;

/**
 * Stand-in for an item whose owning dropdown is absent, such as a filterable submenu's trigger
 * inside a plain parent menu. Nothing registers and every item stays visible.
 */
const detachedStore = createFilterDropdownStore();

export const DETACHED_OWNER = {
  registerItem: (_id: symbol, _item: unknown) => NOOP,
  store: detachedStore,
};
