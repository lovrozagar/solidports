import { describe, expect, it } from 'vitest';
import { createRoot, createSignal, merge } from 'solid-js';
import { isStaticProp } from './solid-helpers';

describe('isStaticProp', () => {
  it('a plain object: an absent key and a plain value are static, a getter is not', () => {
    const props = {
      value: 1,
      get reactive() {
        return 2;
      },
    };
    expect(isStaticProp(props, 'missing')).toBe(true);
    expect(isStaticProp(props, 'value')).toBe(true);
    expect(isStaticProp(props, 'reactive')).toBe(false);
  });

  it('a merge of static objects keeps a fixed key set: an absent key is static', () => {
    createRoot((dispose) => {
      const props = merge({ a: 1 }, { b: 2 });
      expect(isStaticProp(props, 'missing')).toBe(true);
      dispose();
    });
  });

  it('a merge whose key set can change: an absent key is not static, since it can appear later', () => {
    createRoot((dispose) => {
      const [on] = createSignal(false);
      const props = merge(() => (on() ? { keepMounted: true } : {}));
      expect(isStaticProp(props, 'keepMounted')).toBe(false);
      dispose();
    });
  });
});
