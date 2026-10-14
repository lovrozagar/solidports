import { expectType } from '../testUtils';
import { SolidStore } from './SolidStoreV2';

// Solid: `SolidStore` is a factory; a store extends it by composition (as `MenuStore` does), and
// the extended store keeps both its own members and the base store's type.
{
  const store = SolidStore({ value: 1 });
  expectType<SolidStore<{ value: number }>, typeof store>(store);
}
{
  function SubStore(initialState: { value: number }) {
    return Object.assign(SolidStore(initialState), { isSub: true });
  }
  const sub = SubStore({ value: 1 });
  expectType<SolidStore<{ value: number }> & { isSub: boolean }, typeof sub>(sub);
}
