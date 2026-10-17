/*
 * The props view's reads: a key's value comes from the last source that holds it, in any spelling
 * of an attribute, and a read follows sources gaining and losing keys and the source list
 * changing. (Plan 3 leaf 4.3b tried a per-view winner cache; it made every per-key read depend on
 * the whole key layout, against the per-key contract.)
 */
import { createMemo, createRoot, createSignal, flush } from 'solid-js';
import type { Accessor } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createStore } from '../solid-1-compat';
import { createPropsView } from './propsView';

function inRoot<T>(setup: () => T): [T, () => void] {
  let value!: T;
  const dispose = createRoot((d) => {
    value = setup();
    return d;
  });
  return [value, dispose];
}

describe('createPropsView reads', () => {
  it('follow a later source that gains a key the list already holds', () => {
    const [store, setStore] = createStore<{ title?: string }>({});
    const [title, dispose] = inRoot((): Accessor<unknown> => {
      const view = createPropsView([{ title: 'a' }, store]);
      expect(Object.keys(view)).toEqual(['title']);
      return createMemo(() => view.title);
    });
    expect(title()).toBe('a');
    setStore((draft) => {
      draft.title = 'b';
    });
    flush();
    expect(title()).toBe('b');
    setStore((draft) => {
      delete draft.title;
    });
    flush();
    expect(title()).toBe('a');
    dispose();
  });

  it('follow a change of the source list', () => {
    const [sources, setSources] = createSignal<object[]>([{ title: 'a' }]);
    const [title, dispose] = inRoot((): Accessor<unknown> => {
      const view = createPropsView(sources);
      expect(Object.keys(view)).toEqual(['title']);
      return createMemo(() => view.title);
    });
    expect(title()).toBe('a');
    setSources([{ title: 'a' }, { title: 'c' }]);
    flush();
    expect(title()).toBe('c');
    dispose();
  });

  it('resolve every spelling of an attribute as one key, the later source winning', () => {
    const [read, dispose] = inRoot(() => {
      const view = createPropsView([{ tabindex: 0 }, { tabIndex: 1 }]);
      Object.keys(view);
      return () => [view.tabindex, view.tabIndex];
    });
    expect(read()).toEqual([1, 1]);
    dispose();
  });
});
