import { createMemo, createRoot, createSignal, flush, isStatic } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { splitProps } from './solid-1-compat';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('splitProps', () => {
  const props = () => {
    const [value, setValue] = createSignal('a');
    const source = {
      get value() {
        return value();
      },
      disabled: true,
      class: 'c',
      id: 'x',
    };
    return { source, setValue };
  };

  it('picks each group as a live view and leaves the rest', () => {
    const { source, setValue } = props();
    const [local, other, rest] = splitProps(source, ['value', 'disabled'], ['disabled', 'class']);
    expect(local.value).toBe('a');
    expect(local.disabled).toBe(true);
    // A key goes to the first group that names it.
    expect(Object.keys(other)).toEqual(['class']);
    expect(Object.keys(rest)).toEqual(['id']);
    setValue('b');
    flush();
    expect(local.value).toBe('b');
  });

  it('lists, spreads and answers `in` for every key of the group, present or not', () => {
    const { source } = props();
    const [local] = splitProps(source as typeof source & { missing?: number }, [
      'value',
      'missing',
    ]);
    expect(Object.keys(local)).toEqual(['value', 'missing']);
    expect('missing' in local).toBe(true);
    expect('id' in local).toBe(false);
    expect({ ...local }).toEqual({ value: 'a', missing: undefined });
    expect((local as Record<string, unknown>).id).toBe(undefined);
  });

  it('ignores writes and reports its keys as getters', () => {
    const { source } = props();
    const [local] = splitProps(source, ['value', 'disabled']);
    (local as { disabled: boolean }).disabled = false;
    expect(local.disabled).toBe(true);
    expect(isStatic(local, 'disabled')).toBe(false);
  });

  it('tracks the source through a picked key', () => {
    const { source, setValue } = props();
    const [local] = splitProps(source, ['value']);
    const runs = { count: 0 };
    const [read, dispose] = createRoot((d) => [
      createMemo(() => {
        runs.count += 1;
        return local.value;
      }),
      d,
    ]);
    expect(read()).toBe('a');
    setValue('c');
    flush();
    expect(read()).toBe('c');
    expect(runs.count).toBe(2);
    dispose();
  });

  it('defines no property per picked key', () => {
    // Plan 3, 4.6a: a getter defined per key per call was the shim's largest cost on the server.
    const define = vi.spyOn(Object, 'defineProperty');
    const { source } = props();
    splitProps(source, ['value', 'disabled'], ['class']);
    expect(define).not.toHaveBeenCalled();
  });
});
