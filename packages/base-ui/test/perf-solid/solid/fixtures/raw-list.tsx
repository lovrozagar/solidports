/*
 * Raw-Solid floors for a list's highlight (`packages/solid/test/floor/listHighlight.ts`): 1,000
 * options and an active index, each option marking itself `data-highlighted` when it is the active
 * one, through each floor mechanism. The keyed-highlight lists (Select, Combobox, Menu) are held to
 * the keyed floor; the direct one is reported beside it, ungated.
 */
import { SolidStore, keyedSelector } from '@solidports/base-ui/utils/store/SolidStoreV2';
import { directHighlight, keyedHighlight } from '@solidports/base-ui-floor/listHighlight';
import type { IsHighlighted } from '@solidports/base-ui-floor/listHighlight';
import { size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function RawList(props: { mechanism: (active: () => number) => IsHighlighted<number> }) {
  const active = useExposed('active', -1);
  // eslint-disable-next-line solid/reactivity -- the mechanism is fixed for the list's life
  const isHighlighted = props.mechanism(active);
  return (
    <div role="listbox">
      {/* eslint-disable-next-line solid/prefer-for -- the floor's list never changes: a plain map is the minimum a hand-written page writes */}
      {range(size(1000)).map((i) => (
        <div
          role="option"
          aria-selected="false"
          data-highlighted={isHighlighted(i) ? '' : undefined}
        >
          Item {i}
        </div>
      ))}
    </div>
  );
}

/**
 * The library's keyed highlight on the same list: the list stores' `isActive` (`keyedSelector` on
 * the active index, read through `SolidStore.select`), so its cost is measured against the floors
 * with nothing else of a Select or a Menu around it. Built from each variant's library source.
 */
const librarySelectors = { isActive: keyedSelector((state: { active: number }) => state.active) };

function LibraryList() {
  const store = SolidStore({ active: -1 }, {}, librarySelectors);
  setters.active = (value) => store.set('active', value as number);
  return (
    <div role="listbox">
      {/* eslint-disable-next-line solid/prefer-for -- the floor's list never changes: a plain map is the minimum a hand-written page writes */}
      {range(size(1000)).map((i) => (
        <div
          role="option"
          aria-selected="false"
          data-highlighted={store.select('isActive', () => i) ? '' : undefined}
        >
          Item {i}
        </div>
      ))}
    </div>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'select/raw-list-1000-direct': () => <RawList mechanism={directHighlight} />,
  'select/raw-list-1000-keyed': () => <RawList mechanism={keyedHighlight} />,
  'select/raw-list-1000-library': LibraryList,
};
