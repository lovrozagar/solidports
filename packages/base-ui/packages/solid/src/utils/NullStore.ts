import { NOOP } from './noop';
import { SolidStore } from './store/SolidStoreV2';

type SelectorFunction<State> = (state: State, ...args: any[]) => any;

/**
 * A store whose state never changes.
 *
 * Useful for fallback stores that need to support normal store reads while detached from the
 * component that owns real state. Context values may still contain mutable refs or maps.
 */
export function NullStore<
  State extends object,
  Context extends object = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
>(initialState: State, initialContext?: Context, selectors?: Selectors) {
  const store = SolidStore<State, Context, Selectors>(initialState, initialContext, selectors);
  // Solid: the synced-value hooks write through the store's own setter rather than `set`, so every
  // mutator is overridden to keep the store inert (React's subclass routes them all through `set`).
  return {
    ...store,
    set() {},
    setState() {},
    update() {},
    useSyncedValue() {},
    useSyncedValueWithCleanup() {},
    useSyncedValues() {},
    useControlledProp() {},
    useStateSetter: () => NOOP,
  } as typeof store;
}
