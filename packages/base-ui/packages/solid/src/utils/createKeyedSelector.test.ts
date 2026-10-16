import { createEffect, createRoot, createSignal, flush } from 'solid-js';
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
