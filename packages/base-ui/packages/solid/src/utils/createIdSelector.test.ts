/*
 * `createIdSelector`'s lifetime: it starts on the first tracked read and stops once no id has a
 * reader, so an unmounted list leaves no subscription behind. A lone reader that re-runs (a Tabs
 * with one tab, a list filtered down to one item) releases its id and reads it again in the same
 * run: that must not stop and rebuild the selector on every change.
 */
import { createMemo, createRoot, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isJSDOM } from '#test-utils';
import { createIdSelector, idSelectorRelays } from './createIdSelector';

const counted = vi.hoisted(() => ({ effects: 0 }));
// `effects` counts the selector's effects: one per start.

vi.mock('solid-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('solid-js')>();
  return {
    ...actual,
    createEffect: (...args: any[]) => {
      if ((new Error().stack ?? '').includes('createIdSelector')) {
        counted.effects += 1;
      }
      return (actual.createEffect as any)(...args);
    },
  };
});

// vi.mock('solid-js') does not reach the runtime in browser mode, so nothing would be counted.
describe.skipIf(!isJSDOM)('createIdSelector', () => {
  // These drive `current` as a plain signal that no writer pushes: the catch-all effect writes on
  // purpose, so the global check that fails a test on such writes is reset here.
  afterEach(() => {
    idSelectorRelays.writes = 0;
  });

  it('a lone reader re-running on every change builds the selector once', () => {
    counted.effects = 0;
    let setCurrent!: (next: number) => void;
    let reader!: () => boolean;
    const dispose = createRoot((disposeRoot) => {
      const [current, set] = createSignal(0);
      setCurrent = set;
      const isCurrent = createIdSelector(current);
      reader = createMemo(() => isCurrent(0));
      void reader();
      flush();
      return disposeRoot;
    });
    for (let change = 1; change <= 10; change += 1) {
      setCurrent(change % 2);
      flush();
      expect(reader()).toBe(change % 2 === 0);
    }
    expect(counted.effects).toBe(1);
    dispose();
  });

  // The owner rule (rc.14+): the selector starts inside its first reader's computation, here one
  // created while a parent computation runs, as a list's items mount on open. Its effect and
  // signals are created in the owner's lazy scope, never under the reader, and its writes are
  // `ownedWrite`: no dev error or warning (the suite fails on any console output).
  it('readers created inside a parent computation on open raise no dev error', () => {
    let setOpen!: (next: boolean) => void;
    let setCurrent!: (next: number) => void;
    let items!: () => (() => boolean)[];
    const dispose = createRoot((disposeRoot) => {
      const [open, setOpenSignal] = createSignal(false);
      const [current, setCurrentSignal] = createSignal(0);
      setOpen = setOpenSignal;
      setCurrent = setCurrentSignal;
      const isCurrent = createIdSelector(current);
      items = createMemo(() =>
        open() ? [0, 1, 2].map((id) => createMemo(() => isCurrent(id))) : [],
      );
      void items();
      flush();
      return disposeRoot;
    });
    const read = () => items().map((item) => item());
    setOpen(true);
    flush();
    expect(read()).toEqual([true, false, false]);
    setCurrent(2);
    flush();
    expect(read()).toEqual([false, false, true]);
    setOpen(false);
    flush();
    expect(read()).toEqual([]);
    setOpen(true);
    setCurrent(1);
    flush();
    expect(read()).toEqual([false, true, false]);
    dispose();
  });

  it('stops when its last reader is disposed, and starts again on the next read', () => {
    counted.effects = 0;
    let setCurrent!: (next: number) => void;
    let isCurrent!: (id: unknown) => boolean;
    const dispose = createRoot((disposeRoot) => {
      const [current, set] = createSignal(0);
      setCurrent = set;
      isCurrent = createIdSelector(current);
      return disposeRoot;
    });
    const mountReaders = () =>
      createRoot((disposeReaders) => {
        const readers = [0, 1].map((id) => createMemo(() => isCurrent(id)));
        readers.forEach((reader) => void reader());
        flush();
        return { readers, dispose: disposeReaders };
      });
    const first = mountReaders();
    first.dispose();
    expect(counted.effects).toBe(1);
    // The stopped selector no longer follows the current id: a write wakes nothing of it.
    setCurrent(1);
    flush();
    const second = mountReaders();
    expect(second.readers.map((reader) => reader())).toEqual([false, true]);
    expect(counted.effects).toBe(2);
    second.dispose();
    dispose();
  });
});
