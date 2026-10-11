import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createRenderer } from '#test-utils';
import { useItemRegistry, type ItemRegistry } from './useItemRegistry';

describe('useItemRegistry', () => {
  const { render } = createRenderer();

  it('publishes one snapshot for every registration in the same flush', () => {
    let registry: ItemRegistry<string, number> | undefined;

    function Probe() {
      registry = useItemRegistry<string, number>();
      return null;
    }

    render(Probe);
    const api = registry!;
    const removeA = api.registerItem('a', 1);
    const removeB = api.registerItem('b', 2);

    expect(api.liveItems.get('a')).toBe(1);
    expect(api.liveItems.get('b')).toBe(2);
    flush();
    expect(Array.from(api.items.entries())).toEqual([
      ['a', 1],
      ['b', 2],
    ]);

    removeA();
    removeB();
    flush();
    expect(api.items.size).toBe(0);
    expect(api.liveItems.size).toBe(0);
  });
});
