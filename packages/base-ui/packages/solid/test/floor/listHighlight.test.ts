/*
 * The list-highlight floors (`./listHighlight.ts`): what each mechanism re-runs per move and which
 * signals it holds, so a library highlight has a defined target per metric.
 */
import { createMemo, createOwner, createRoot, createSignal, flush, runWithOwner } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { directHighlight, keyedHighlight } from './listHighlight';
import type { IsHighlighted } from './listHighlight';

const N = 100;

/** `N` readers of `make(active)`, each counting its runs; `keys` picks each reader's key. */
function list(
  make: (active: () => number) => IsHighlighted<number>,
  keys: (i: number) => number = (i) => i,
) {
  const runs = Array.from({ length: N }, () => 0);
  let setActive!: (next: number) => void;
  let isHighlighted!: IsHighlighted<number>;
  let readers!: (() => boolean)[];
  const dispose = createRoot((disposeRoot) => {
    const [active, set] = createSignal(-1);
    setActive = set;
    isHighlighted = make(active);
    readers = runs.map((_, i) =>
      createMemo(() => {
        runs[i] += 1;
        return isHighlighted(keys(i));
      }),
    );
    readers.forEach((reader) => void reader());
    flush();
    return disposeRoot;
  });
  const move = (next: number) => {
    runs.fill(0);
    setActive(next);
    flush();
    readers.forEach((reader) => void reader());
    return runs.reduce((sum, n) => sum + n, 0);
  };
  const highlighted = () => readers.flatMap((reader, i) => (reader() ? [i] : []));
  return { move, highlighted, dispose, isHighlighted };
}

describe('list highlight floors', () => {
  it('direct compare: every move re-runs every reader', () => {
    const view = list(directHighlight);
    expect(view.move(10)).toBe(N);
    expect(view.highlighted()).toEqual([10]);
    expect(view.move(11)).toBe(N);
    expect(view.highlighted()).toEqual([11]);
    view.dispose();
  });

  it('keyed (createSelector shape): every move, the first included, re-runs the old and new reader only', () => {
    const view = list(keyedHighlight);
    // The first move: no reader was active, so only the new one re-runs.
    expect(view.move(10)).toBe(1);
    expect(view.highlighted()).toEqual([10]);
    expect(view.move(11)).toBe(2);
    expect(view.highlighted()).toEqual([11]);
    // A move to a key no reader reads re-runs only the old one.
    expect(view.move(N + 5)).toBe(1);
    expect(view.highlighted()).toEqual([]);
    view.dispose();
  });

  it('keyed: one signal per key with readers, dropped with its last reader', () => {
    // Two readers per key: still one signal each.
    const view = list(keyedHighlight, (i) => Math.floor(i / 2));
    const keyed = view.isHighlighted as ReturnType<typeof keyedHighlight<number>>;
    expect(keyed.slots()).toBe(N / 2);
    view.move(3);
    expect(keyed.slots()).toBe(N / 2);
    view.dispose();
    expect(keyed.slots()).toBe(0);
  });

  // A list's selector lives in a component. The floor builds its effect at mount, in the
  // component's body, so its writes are not owned writes; the library's selector, built lazily
  // inside the first reader's computation, needs `ownedWrite` on its signals for the same writes.
  it('keyed: moves under a component owner raise no dev error', () => {
    const runs = { count: 0 };
    let setActive!: (next: number) => void;
    let readers!: (() => boolean)[];
    const dispose = createRoot((disposeRoot) => {
      runWithOwner(createOwner(), () => {
        const [active, set] = createSignal(0);
        setActive = set;
        const keyed = keyedHighlight(active);
        readers = Array.from({ length: 10 }, (_, i) =>
          createMemo(() => {
            runs.count += 1;
            return keyed(i);
          }),
        );
        readers.forEach((reader) => void reader());
      });
      flush();
      return disposeRoot;
    });
    runs.count = 0;
    setActive(4);
    flush();
    expect(readers.map((reader) => reader()).indexOf(true)).toBe(4);
    expect(runs.count).toBe(2);
    dispose();
  });

  it('keyed: a reader that changes its key moves to the new key and releases the old one', () => {
    let setKey!: (key: number) => void;
    let keyed!: ReturnType<typeof keyedHighlight<number>>;
    let reader!: () => boolean;
    const dispose = createRoot((disposeRoot) => {
      const [active, setActive] = createSignal(4);
      const [key, set] = createSignal(1);
      setKey = set;
      keyed = keyedHighlight(active);
      reader = createMemo(() => keyed(key()));
      void reader();
      flush();
      void setActive;
      return disposeRoot;
    });
    expect(reader()).toBe(false);
    setKey(4);
    flush();
    expect(reader()).toBe(true);
    expect(keyed.slots()).toBe(1);
    dispose();
    expect(keyed.slots()).toBe(0);
  });
});
