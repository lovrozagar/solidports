import { createRenderEffect, createSignal, flush, For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { describe, expect, it } from 'vitest';
import { act, createRenderer } from '#test-utils';
import { createLayoutEffect } from '../solid-helpers';
import { useItemRegistry } from './useItemRegistry';
import type { ItemRegistry } from './useItemRegistry';

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

  type Register = (id: string, value: string) => () => void;

  // Solid: an item registers from a layout effect, as React's `useIsoLayoutEffect`, and the app
  // records each published snapshot from a render effect, as React's render records it.
  function Item(props: { id: string; registerItem: Register; value?: (id: string) => string }) {
    createLayoutEffect(
      () => props.id,
      (id) => props.registerItem(id, props.value?.(id) ?? id),
    );
    return null;
  }

  function App(props: {
    items: string[];
    snapshots: ReadonlyMap<string, string>[];
    item?: (id: string, registerItem: Register) => JSX.Element;
  }) {
    const registry = useItemRegistry<string, string>();
    createRenderEffect(
      () => registry.items,
      (items) => {
        props.snapshots.push(items);
      },
    );

    return (
      <For each={props.items}>
        {(item) =>
          props.item ? (
            props.item(item, registry.registerItem)
          ) : (
            <Item id={item} registerItem={registry.registerItem} />
          )
        }
      </For>
    );
  }

  it('publishes one immutable snapshot for all registrations in a commit', async () => {
    const snapshots: ReadonlyMap<string, string>[] = [];
    const [items, setItems] = createSignal(['a', 'b', 'c']);

    await render(() => <App items={items()} snapshots={snapshots} />);

    expect(snapshots.map((snapshot) => Array.from(snapshot.keys()))).toEqual([[], ['a', 'b', 'c']]);

    await act(async () => {
      setItems(['b', 'd']);
    });

    expect(Array.from(snapshots.at(-1)?.keys() ?? [])).toEqual(['b', 'd']);
    expect(Array.from(snapshots[1].keys())).toEqual(['a', 'b', 'c']);
  });

  // Solid: there is no StrictMode, so each item replays its double effect (register -> cleanup ->
  // register), which is what can leave the update latch stuck or the map an entry short.
  it('publishes every registration under StrictMode double effects', async () => {
    const snapshots: ReadonlyMap<string, string>[] = [];
    const [items, setItems] = createSignal(['a', 'b', 'c']);

    function StrictItem(props: { id: string; registerItem: Register }) {
      createLayoutEffect(
        () => props.id,
        (id) => {
          props.registerItem(id, `value-${id}`)();
          return props.registerItem(id, `value-${id}`);
        },
      );
      return null;
    }

    await render(() => (
      <App
        items={items()}
        snapshots={snapshots}
        item={(id, registerItem) => <StrictItem id={id} registerItem={registerItem} />}
      />
    ));

    const latest = () => snapshots.at(-1)!;
    expect(Array.from(latest().keys())).toEqual(['a', 'b', 'c']);
    // The value channel, not just the keys.
    expect(latest().get('b')).toBe('value-b');

    await act(async () => {
      setItems(['b', 'd']);
    });

    expect(Array.from(latest().keys())).toEqual(['b', 'd']);
    expect(latest().get('d')).toBe('value-d');
  });

  it('publishes an empty snapshot once the last item unregisters', async () => {
    const snapshots: ReadonlyMap<string, string>[] = [];
    const [items, setItems] = createSignal(['a', 'b']);

    await render(() => <App items={items()} snapshots={snapshots} />);
    expect(Array.from(snapshots[snapshots.length - 1].keys())).toEqual(['a', 'b']);

    await act(async () => {
      setItems([]);
    });

    expect(Array.from(snapshots[snapshots.length - 1].keys())).toEqual([]);
  });
});
