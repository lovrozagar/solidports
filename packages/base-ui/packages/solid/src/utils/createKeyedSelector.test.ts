import { createEffect, createRenderEffect, createRoot, createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createKeyedSelector } from './createKeyedSelector';

/** Runs `isSelected(key)` in an effect per key, counting each key's runs. Writes stay outside. */
function track<K>(values: () => readonly unknown[], keys: K[]) {
  const runs = new Map<K, number>();
  const seen = new Map<K, boolean>();
  const dispose = createRoot((disposeRoot) => {
    const isSelected = createKeyedSelector(values);
    for (const key of keys) {
      runs.set(key, 0);
      createEffect(
        () => isSelected(key),
        (selected) => {
          runs.set(key, runs.get(key)! + 1);
          seen.set(key, selected);
        },
      );
    }
    return disposeRoot;
  });
  flush();
  return { runs, seen, dispose };
}

describe('createKeyedSelector', () => {
  it('re-runs only the readers whose key joined or left the values', () => {
    const [values, setValues] = createSignal<readonly string[]>(['a']);
    const { runs, seen, dispose } = track(values, ['a', 'b', 'c']);
    expect(Object.fromEntries(seen)).toEqual({ a: true, b: false, c: false });
    runs.forEach((_, key) => runs.set(key, 0));

    setValues(['a', 'b']);
    flush();
    expect(Object.fromEntries(seen)).toEqual({ a: true, b: true, c: false });
    expect(Object.fromEntries(runs)).toEqual({ a: 0, b: 1, c: 0 });

    setValues(['b']);
    flush();
    expect(Object.fromEntries(seen)).toEqual({ a: false, b: true, c: false });
    expect(Object.fromEntries(runs)).toEqual({ a: 1, b: 1, c: 0 });
    dispose();
  });

  // Object values (a Select's or Combobox's item objects) are keyed by identity: a toggle re-runs
  // only the objects that joined or left, not every object reader.
  it('re-runs only the readers whose object joined or left the values', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    const [values, setValues] = createSignal<readonly unknown[]>([a]);
    const { runs, seen, dispose } = track(values, [a, b, c, { id: 'a' }]);
    expect([...seen.values()]).toEqual([true, false, false, false]);
    runs.forEach((_, key) => runs.set(key, 0));

    setValues([a, b]);
    flush();
    expect([...seen.values()]).toEqual([true, true, false, false]);
    expect([...runs.values()]).toEqual([0, 1, 0, 0]);
    dispose();
  });

  // A selector rewrite must stay pulled: a writer that applies membership in an effect leaves a
  // reader that re-runs for another source in the same batch seeing the old membership with the
  // new value of that source for one pass (measured 2026-10-17: `second:open` before
  // `second:closed`), an inconsistent render. Pins the projection's consistency.
  it('never shows a reader a membership older than another source changed in the same batch', () => {
    const [values, setValues] = createSignal<readonly string[]>(['a']);
    const [label, setLabel] = createSignal('first');
    const seen: string[] = [];
    const dispose = createRoot((disposeRoot) => {
      const isSelected = createKeyedSelector(values);
      const bound = isSelected.forKey('a');
      createRenderEffect(
        () => `${label()}:${isSelected('a') ? 'open' : 'closed'}:${bound() ? 'open' : 'closed'}`,
        (value) => {
          seen.push(value);
        },
      );
      return disposeRoot;
    });
    flush();
    setValues([]);
    setLabel('second');
    flush();
    expect(seen).toEqual(['first:open:open', 'second:closed:closed']);
    dispose();
  });

  it('a read bound to one key with forKey follows that key as the plain read does', () => {
    const [values, setValues] = createSignal<readonly unknown[]>(['a']);
    const object = { id: 1 };
    const seen: boolean[][] = [];
    const dispose = createRoot((disposeRoot) => {
      const isSelected = createKeyedSelector(values);
      const reads = [isSelected.forKey('a'), isSelected.forKey(1), isSelected.forKey(object)];
      createEffect(
        () => reads.map((read) => read()),
        (value) => {
          seen.push(value);
        },
      );
      return disposeRoot;
    });
    flush();
    setValues([1, object]);
    flush();
    expect(seen).toEqual([
      [true, false, false],
      [false, true, true],
    ]);
    dispose();
  });

  it('keeps numbers and strings apart and compares any other key by identity', () => {
    const object = { id: 1 };
    const [values, setValues] = createSignal<readonly unknown[]>([1, object]);
    const { seen, dispose } = track(values, [1, '1', object, { id: 1 }] as unknown[]);
    expect([...seen.values()]).toEqual([true, false, true, false]);
    setValues(['1']);
    flush();
    expect([...seen.values()]).toEqual([false, true, false, false]);
    dispose();
  });
});
