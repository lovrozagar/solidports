/** Default sizes; `?size=large` multiplies them by 5 (set by the runner's SIZE=large). */
const scale = typeof location !== 'undefined' && location.search.includes('size=large') ? 5 : 1;

/**
 * A fixture's item count. While a heap sample warms up (`shared/cycles.mjs`), the runner sets
 * `__benchWarmup` and every fixture renders one item: the code and the library's one-time state
 * load without a tree worth holding.
 */
export const size = (n: number) =>
  (globalThis as { __benchWarmup?: boolean }).__benchWarmup ? 1 : n * scale;

export const items = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: `item-${i}`, label: `Item ${i}` }));

/**
 * A module-level list that follows the warm-up flag: `list()` returns one array per current count,
 * made once, so a fixture keeps a stable array across renders and the warm-up mounts one item.
 */
export function itemList<T = ReturnType<typeof items>[number]>(
  n: number,
  map?: (item: ReturnType<typeof items>[number]) => T,
): () => T[] {
  const lists = new Map<number, T[]>();
  return () => {
    const count = size(n);
    let list = lists.get(count);
    if (!list) {
      const made = items(count);
      list = (map ? made.map(map) : made) as T[];
      lists.set(count, list);
    }
    return list;
  };
}
