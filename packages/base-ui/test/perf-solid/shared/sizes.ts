/** Default sizes; `?size=large` multiplies them by 5 (set by the runner's SIZE=large). */
const scale = typeof location !== 'undefined' && location.search.includes('size=large') ? 5 : 1;

export const size = (n: number) => n * scale;

export const items = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: `item-${i}`, label: `Item ${i}` }));
