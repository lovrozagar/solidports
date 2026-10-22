/*
 * The Maps and Sets one more closed popup root constructs (D32's closed-root unit, step 2): a
 * closed root holds two stores (its popup store and its floating root store), and each store's
 * collections cost a table of their own even while empty, about 130 bytes in Chromium. A store
 * creates a collection when it first needs it, so a closed root keeps only those it fills.
 */
import { flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Popover } from '@solidports/base-ui/popover';
import { Tooltip } from '@solidports/base-ui/tooltip';
import { Dialog } from '@solidports/base-ui/dialog';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';

const NativeMap = globalThis.Map;
const NativeSet = globalThis.Set;
let constructed = 0;

class CountingMap<K, V> extends NativeMap<K, V> {
  constructor(entries?: readonly (readonly [K, V])[] | null) {
    super(entries);
    constructed += 1;
  }
}
class CountingSet<T> extends NativeSet<T> {
  constructor(values?: readonly T[] | null) {
    super(values);
    constructed += 1;
  }
}

afterEach(() => {
  globalThis.Map = NativeMap;
  globalThis.Set = NativeSet;
});

describe('closed popup root collections', () => {
  const { render } = createRenderer();

  function collections(ui: () => JSX.Element) {
    constructed = 0;
    globalThis.Map = CountingMap as MapConstructor;
    globalThis.Set = CountingSet as SetConstructor;
    const view = render(ui);
    flush();
    globalThis.Map = NativeMap;
    globalThis.Set = NativeSet;
    const created = constructed;
    view.unmount();
    return created;
  }

  /** Collections one more copy of `root` constructs next to four. */
  const perCopy = (root: () => JSX.Element) =>
    collections(() => Array.from({ length: 5 }, root)) -
    collections(() => Array.from({ length: 4 }, root));

  // Budgets are the counts after creating collections on first use; the comments give the counts
  // before.
  it.each([
    ['Popover', 7, () => <Popover.Root />], // before: 30
    ['Tooltip', 5, () => <Tooltip.Root />], // before: 27
    ['Dialog', 5, () => <Dialog.Root />], // before: 27
  ] as const)(
    'a closed %s root constructs at most its budget of Maps and Sets',
    (name, budget, root) => {
      const created = perCopy(root);
      expect(created, `${name} ${created}`).toBeLessThanOrEqual(budget);
    },
  );
});
