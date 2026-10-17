/*
 * `useInteractions` merges every interaction hook's props per element kind. A hook's entry can be
 * re-read without changing (a getter that reads state, the same object back): then the merged
 * props must not re-merge, or every list item re-merges and re-enumerates its props on each popup
 * open and close (a 50-item Select re-listed every item's props views 176 times over two cycles).
 */
import { createMemo, createRoot, createSignal, flush } from 'solid-js';
import type { Accessor } from 'solid-js';
import { describe, expect, it } from 'vitest';
import type { ElementProps } from '../types';
import { useInteractions } from './useInteractions';

/** Runs `setup` in a root; the returned dispose ends it. Signal writes happen outside it. */
function inRoot<T>(setup: () => T): [T, () => void] {
  let value!: T;
  const dispose = createRoot((d) => {
    value = setup();
    return d;
  });
  return [value, dispose];
}

describe('useInteractions merged props', () => {
  it('do not re-merge when the hooks hand back the same entries', () => {
    const [tick, setTick] = createSignal(0);
    const item = { onClick() {} };
    const reference = { onKeyDown() {} };
    const entry: ElementProps = {
      get item() {
        tick();
        return item;
      },
      get reference() {
        tick();
        return reference;
      },
    };
    let enumerations = 0;
    const [keys, dispose] = inRoot((): Accessor<string[]> => {
      const { getItemProps, getReferenceProps } = useInteractions([entry]);
      const itemProps = getItemProps();
      const referenceProps = getReferenceProps();
      return createMemo(() => {
        enumerations += 1;
        return [...Object.keys(itemProps), ...Object.keys(referenceProps)];
      });
    });
    expect(keys()).toEqual(['onClick', 'onKeyDown']);
    const before = enumerations;

    setTick(1);
    flush();
    expect(keys()).toEqual(['onClick', 'onKeyDown']);
    expect(enumerations).toBe(before);
    dispose();
  });

  it('re-merge when a hook hands back a new entry', () => {
    const [item, setItem] = createSignal<Record<string, unknown>>({ onClick() {} });
    const entry: ElementProps = {
      get item() {
        return item();
      },
    };
    const [keys, dispose] = inRoot(() => {
      const itemProps = useInteractions([entry]).getItemProps();
      return createMemo(() => Object.keys(itemProps));
    });
    expect(keys()).toEqual(['onClick']);

    setItem({ onClick() {}, onFocus() {} });
    flush();
    expect(keys()).toEqual(['onClick', 'onFocus']);
    dispose();
  });
});
