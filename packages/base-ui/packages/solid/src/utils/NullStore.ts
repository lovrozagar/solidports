import { SolidStore } from './store/SolidStoreV2';

type SelectorFunction<State> = (state: State, ...args: any[]) => any;

/**
 * A store whose state never changes. Fallback for detached popup handles.
 */
export function NullStore<
  State extends object,
  Context extends object = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
>(initialState: State, initialContext?: Context, selectors?: Selectors) {
  const store = SolidStore<State, Context, Selectors>(initialState, initialContext, selectors);
  return {
    ...store,
    set() {},
    setState() {},
    update() {},
  };
}
