import { expect, vi, describe, it } from 'vitest';
import { createMemo, createSignal, For, Show, untrack } from 'solid-js';
import { Portal } from '@solidjs/web';
import { screen, waitFor } from '@solidjs/testing-library';
import { act, createRenderer } from '#test-utils';
import { CompositeList } from './CompositeList';
import { IndexGuessBehavior, useCompositeListItem } from './useCompositeListItem';

// Solid: `CompositeList` fills a `refs: { elements, labels }` object in place (React's
// `elementsRef`/`labelsRef`), and publishes the sorted items as an array instead of a Map.
type MapChangeItems = Array<{ element: Element; metadata: Record<string, unknown> | null }>;

function createRefs() {
  return {
    elements: [] as Array<HTMLElement | null | undefined>,
    labels: [] as Array<string | null>,
  };
}

describe('<CompositeList />', () => {
  const { render } = createRenderer();

  describe('prop: elementsRef', () => {
    function Item(props: { label?: string; index?: number }) {
      const { setRef, index } = useCompositeListItem({ index: () => props.index });
      return (
        <div ref={setRef} data-testid={props.label} data-index={props.label ? index() : undefined}>
          {props.label}
        </div>
      );
    }

    it('cleans up refs on unmount', async () => {
      const refs = createRefs();
      const { unmount } = await render(() => (
        <CompositeList refs={refs}>
          <Item />
          <Item />
          <Item />
        </CompositeList>
      ));

      expect(refs.elements).toHaveLength(3);
      expect(refs.labels).toHaveLength(3);

      unmount();
      expect(refs.elements).toHaveLength(0);
      expect(refs.labels).toHaveLength(0);
    });

    it('keeps refs populated for items whose guessed index is already correct', async () => {
      function GuessedItem(props: { label: string }) {
        const { setRef } = useCompositeListItem({
          indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
          label: () => props.label,
        });
        return (
          <div ref={setRef} data-testid={props.label}>
            {props.label}
          </div>
        );
      }

      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <GuessedItem label="a" />
          <GuessedItem label="b" />
          <GuessedItem label="c" />
        </CompositeList>
      ));

      await waitFor(() => {
        expect(refs.elements[0]).toBe(screen.getByTestId('a'));
      });
      expect(refs.elements[1]).toBe(screen.getByTestId('b'));
      expect(refs.elements[2]).toBe(screen.getByTestId('c'));
      expect(refs.labels).toEqual(['a', 'b', 'c']);
    });

    it('only publishes maps that are aligned with the element registry', async () => {
      const refs = createRefs();
      const snapshots: Array<{
        elements: Array<HTMLElement | null | undefined>;
        mapElements: Element[];
      }> = [];
      const [items, setItems] = createSignal(['a', 'b', 'c']);

      function App(props: { items: string[] }) {
        return (
          <CompositeList
            refs={refs}
            onMapChange={(map) => {
              snapshots.push({
                elements: [...refs.elements],
                mapElements: map.map((item) => item.element),
              });
            }}
          >
            <For each={props.items}>{(item) => <Item label={item} />}</For>
          </CompositeList>
        );
      }

      await render(() => <App items={items()} />);

      expect(snapshots).toHaveLength(1);

      act(() => setItems(['a', 'b', 'c', 'd']));

      expect(snapshots).toHaveLength(2);
      snapshots.forEach((snapshot) => {
        expect(snapshot.elements).toEqual(snapshot.mapElements);
      });
    });

    it('registers explicitly indexed items in their index-addressed slots', async () => {
      const refs = createRefs();
      const onMapChange = vi.fn();

      await render(() => (
        <CompositeList refs={refs} onMapChange={onMapChange}>
          <Item label="two" index={2} />
          <Item label="zero" index={0} />
          <Item label="one" index={1} />
        </CompositeList>
      ));

      const map = onMapChange.mock.lastCall?.[0] as MapChangeItems;
      expect(map.map((item) => item.metadata?.index)).toEqual([0, 1, 2]);
      expect(refs.elements).toEqual([
        screen.getByTestId('zero'),
        screen.getByTestId('one'),
        screen.getByTestId('two'),
      ]);
    });

    it('reserves explicit slots when assigning automatic indexes', async () => {
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <Item label="automatic one" />
          <Item label="explicit zero" index={0} />
          <Item label="automatic two" />
        </CompositeList>
      ));

      expect(refs.elements).toEqual([
        screen.getByTestId('explicit zero'),
        screen.getByTestId('automatic one'),
        screen.getByTestId('automatic two'),
      ]);
      expect(screen.getByTestId('automatic one')).toHaveAttribute('data-index', '1');
      expect(screen.getByTestId('automatic two')).toHaveAttribute('data-index', '2');
    });

    it('does not consume an index guess for an explicitly indexed item', async () => {
      const baselineRefs = createRefs();
      const refs = createRefs();

      function GuessedItem(props: { label: string; index?: number }) {
        const { setRef, index } = useCompositeListItem({
          indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
          index: () => props.index,
        });
        const initialIndex = untrack(index);
        return <div ref={setRef} data-testid={props.label} data-initial-index={initialIndex} />;
      }

      await render(() => (
        <>
          <CompositeList refs={baselineRefs}>
            <GuessedItem label="baseline automatic" />
          </CompositeList>
          <CompositeList refs={refs}>
            <GuessedItem label="explicit" index={1} />
            <GuessedItem label="automatic" />
          </CompositeList>
        </>
      ));

      expect(screen.getByTestId('automatic').dataset.initialIndex).toBe(
        screen.getByTestId('baseline automatic').dataset.initialIndex,
      );
      expect(refs.elements[0]).toBe(screen.getByTestId('automatic'));
      expect(refs.elements[1]).toBe(screen.getByTestId('explicit'));
    });

    it('syncs replacement refs without publishing an unchanged map', async () => {
      const firstRefs = createRefs();
      const secondRefs = {
        elements: [null, null] as Array<HTMLElement | null | undefined>,
        labels: [null, null] as Array<string | null>,
      };
      const onMapChange = vi.fn();

      function UnstableRefItem() {
        const { setRef } = useCompositeListItem({ label: 'item' });

        return <div ref={setRef} data-testid="item" />;
      }

      function App() {
        const [useSecondRef, setUseSecondRef] = createSignal(false);
        return (
          <CompositeList refs={useSecondRef() ? secondRefs : firstRefs} onMapChange={onMapChange}>
            <button type="button" onClick={() => setUseSecondRef(true)}>
              Replace ref
            </button>
            <UnstableRefItem />
          </CompositeList>
        );
      }

      const { user } = await render(() => <App />);
      const item = screen.getByTestId('item');
      expect(firstRefs.elements).toEqual([item]);
      expect(firstRefs.labels).toEqual(['item']);
      onMapChange.mockClear();

      await user.click(screen.getByRole('button', { name: 'Replace ref' }));

      expect(firstRefs.elements).toEqual([]);
      expect(firstRefs.labels).toEqual([]);
      expect(secondRefs.elements).toEqual([item]);
      expect(secondRefs.labels).toEqual(['item']);
      expect(onMapChange).not.toHaveBeenCalled();
    });

    it('registers a replacement render target', async () => {
      const refs = createRefs();

      function SwitchingItem() {
        const [useButton, setUseButton] = createSignal(false);
        const { setRef } = useCompositeListItem();

        return (
          <>
            <button type="button" onClick={() => setUseButton(true)}>
              Replace target
            </button>
            <Show
              when={useButton()}
              fallback={
                <div ref={setRef} data-testid="item">
                  item
                </div>
              }
            >
              <button ref={setRef} data-testid="item" type="button">
                item
              </button>
            </Show>
          </>
        );
      }

      const { user } = await render(() => (
        <CompositeList refs={refs}>
          <SwitchingItem />
        </CompositeList>
      ));
      const initialItem = screen.getByTestId('item');

      await user.click(screen.getByRole('button', { name: 'Replace target' }));

      const replacementItem = screen.getByTestId('item');
      expect(replacementItem).not.toBe(initialItem);
      expect(initialItem.isConnected).toBe(false);
      expect(refs.elements).toEqual([replacementItem]);
    });

    it('does not register negative explicit indexes', async () => {
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <Item label="item" index={-1} />
        </CompositeList>
      ));

      expect(refs.elements).toHaveLength(0);
      expect(Object.hasOwn(refs.elements, '-1')).toBe(false);
    });

    it('updates refs when an item mounts from a nested state update', async () => {
      const refs = createRefs();

      function DeepSection() {
        const [showItem, setShowItem] = createSignal(false);
        return (
          <>
            <button type="button" onClick={() => setShowItem(true)}>
              Add item
            </button>
            <Show when={showItem()}>
              <Item label="nested" />
            </Show>
          </>
        );
      }

      const { user } = await render(() => (
        <CompositeList refs={refs}>
          <Item label="first" />
          <DeepSection />
          <Item label="last" />
        </CompositeList>
      ));

      await user.click(screen.getByRole('button', { name: 'Add item' }));

      expect(refs.elements).toEqual([
        screen.getByTestId('first'),
        screen.getByTestId('nested'),
        screen.getByTestId('last'),
      ]);
    });

    it('updates refs when an item unmounts from a nested state update', async () => {
      const refs = createRefs();
      const onMapChange = vi.fn();

      function DeepSection() {
        const [showItem, setShowItem] = createSignal(true);
        return (
          <>
            <button type="button" onClick={() => setShowItem(false)}>
              Remove item
            </button>
            <Show when={showItem()}>
              <Item label="nested" />
            </Show>
          </>
        );
      }

      const { user } = await render(() => (
        <CompositeList refs={refs} onMapChange={onMapChange}>
          <Item label="first" />
          <DeepSection />
          <Item label="last" />
        </CompositeList>
      ));

      expect(refs.elements).toHaveLength(3);

      await user.click(screen.getByRole('button', { name: 'Remove item' }));

      expect(refs.elements).toEqual([screen.getByTestId('first'), screen.getByTestId('last')]);
      const map = onMapChange.mock.lastCall?.[0] as MapChangeItems;
      expect(map.map((item) => item.element)).toEqual([
        screen.getByTestId('first'),
        screen.getByTestId('last'),
      ]);
      expect(screen.getByTestId('last')).toHaveAttribute('data-index', '1');
    });

    it('assigns correct guessed indexes during the first render', async () => {
      const renderCounts: Record<string, number> = { a: 0, b: 0, c: 0 };
      const initialIndexes: Record<string, number> = {};

      function GuessedItem(props: { label: string }) {
        const { setRef, index } = useCompositeListItem({
          indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
        });
        const label = untrack(() => props.label);
        renderCounts[label] += 1;
        if (!(label in initialIndexes)) {
          initialIndexes[label] = untrack(index);
        }
        return <div ref={setRef} data-testid={props.label} data-index={index()} />;
      }

      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <GuessedItem label="a" />
          <GuessedItem label="b" />
          <GuessedItem label="c" />
        </CompositeList>
      ));

      expect(initialIndexes).toEqual({ a: 0, b: 1, c: 2 });
      expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });
      expect(refs.elements).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('b'),
        screen.getByTestId('c'),
      ]);
    });

    it('re-registers an item when its explicit index changes or is removed', async () => {
      const refCalls: Array<HTMLElement | null> = [];
      const refs = createRefs();

      function TrackedItem(props: { index?: number }) {
        const { setRef, index } = useCompositeListItem({
          indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
          index: () => props.index,
        });
        const trackingRef = (node: HTMLElement) => {
          refCalls.push(node);
          setRef(node);
        };
        return <div ref={trackingRef} data-testid="tracked" data-index={index()} />;
      }

      const [index, setIndex] = createSignal<number | undefined>(0);

      await render(() => (
        <CompositeList refs={refs}>
          <TrackedItem index={index()} />
        </CompositeList>
      ));
      const tracked = screen.getByTestId('tracked');
      expect(refCalls).toEqual([tracked]);
      expect(refs.elements[0]).toBe(tracked);

      // Solid: refs are applied once, so the item re-registers from an effect when its
      // registration data changes instead of cycling its ref.
      act(() => setIndex(2));

      expect(refCalls).toEqual([tracked]);
      expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '2');
      expect(Object.hasOwn(refs.elements, 0)).toBe(false);
      expect(refs.elements[2]).toBe(tracked);

      act(() => setIndex(undefined));

      await waitFor(() => {
        expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '0');
      });
      expect(refCalls).toEqual([tracked]);
      expect(refs.elements).toEqual([tracked]);
    });

    it('resolves an automatic index when the equivalent explicit index is removed', async () => {
      const refs = createRefs();
      const [index, setIndex] = createSignal<number | undefined>(0);

      await render(() => (
        <CompositeList refs={refs}>
          <Item label="indexed" index={index()} />
        </CompositeList>
      ));
      act(() => setIndex(undefined));

      await waitFor(() => {
        expect(screen.getByTestId('indexed')).toHaveAttribute('data-index', '0');
      });
    });

    it('does not detach item refs when an index shifts', async () => {
      const refCalls: Array<HTMLElement | null> = [];

      function TrackedItem() {
        const { setRef, index } = useCompositeListItem();
        const trackingRef = (node: HTMLElement) => {
          refCalls.push(node);
          setRef(node);
        };
        return <div ref={trackingRef} data-testid="tracked" data-index={index()} />;
      }

      const [items, setItems] = createSignal(['tracked']);
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <For each={items()}>
            {(item) => (item === 'tracked' ? <TrackedItem /> : <Item label={item} />)}
          </For>
        </CompositeList>
      ));
      const tracked = screen.getByTestId('tracked');
      expect(refCalls).toEqual([tracked]);

      act(() => setItems(['before', 'tracked']));
      await waitFor(() => {
        expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '1');
      });
      expect(refCalls).toEqual([tracked]);
    });

    it('excludes items detached outside React from the registry', async () => {
      const refs = createRefs();
      const onMapChange = vi.fn();
      const [extra, setExtra] = createSignal(false);

      await render(() => (
        <CompositeList refs={refs} onMapChange={onMapChange}>
          <div>
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
          <Show when={extra()}>
            <Item label="d" />
          </Show>
        </CompositeList>
      ));

      // Detaching a registered item outside Solid never runs its cleanup, so it stays
      // registered while disconnected. `compareDocumentPosition` is meaningless for it, and
      // leaving it in would scramble the order of every other item.
      const detached = screen.getByTestId('b');
      detached.remove();

      act(() => setExtra(true));

      expect(refs.elements).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('c'),
        screen.getByTestId('d'),
      ]);
      const map = onMapChange.mock.lastCall?.[0] as MapChangeItems;
      expect(map.map((item) => item.element)).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('c'),
        screen.getByTestId('d'),
      ]);
    });

    it('skips detached items while verifying order after a move', async () => {
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <div data-testid="list">
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
        </CompositeList>
      ));

      const list = screen.getByTestId('list');
      const a = screen.getByTestId('a');
      const c = screen.getByTestId('c');

      // One batch that both detaches a registered item and moves another. The move makes the
      // observer verify order, and the verification walks the detached item, which no longer
      // has a meaningful document position.
      screen.getByTestId('b').remove();
      list.insertBefore(c, a);

      await waitFor(() => {
        expect(screen.getByTestId('c')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
    });

    it('updates the registry when a mounted item stops rendering an element', async () => {
      const refs = createRefs();

      function VanishingItem() {
        // Starts with no element at all, so the item registers nothing until it renders one.
        const [hidden, setHidden] = createSignal(true);
        const { setRef, index } = useCompositeListItem({
          label: () => (hidden() ? 'hidden' : 'shown'),
        });
        return (
          <>
            <button type="button" onClick={() => setHidden((value) => !value)}>
              Toggle element
            </button>
            <Show when={!hidden()}>
              <div ref={setRef} data-testid="vanishing" data-index={index()}>
                vanishing
              </div>
            </Show>
          </>
        );
      }

      const { user } = await render(() => (
        <CompositeList refs={refs}>
          <VanishingItem />
          <Item label="tail" />
        </CompositeList>
      ));

      expect(refs.elements).toEqual([screen.getByTestId('tail')]);

      await user.click(screen.getByRole('button', { name: 'Toggle element' }));
      expect(refs.elements).toHaveLength(2);

      // The item stays mounted and subscribed while its element detaches, so the next
      // publication reaches a subscriber whose node is gone.
      await user.click(screen.getByRole('button', { name: 'Toggle element' }));

      expect(refs.elements).toEqual([screen.getByTestId('tail')]);
      expect(screen.getByTestId('tail')).toHaveAttribute('data-index', '0');
    });

    it('updates indexes when a leaf item moves outside React', async () => {
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <div data-testid="container">
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
        </CompositeList>
      ));

      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');

      const container = screen.getByTestId('container');
      container.appendChild(screen.getByTestId('a'));

      await waitFor(() => {
        expect(screen.getByTestId('a')).toHaveAttribute('data-index', '2');
      });
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('c')).toHaveAttribute('data-index', '1');
      expect(refs.elements).toEqual([
        screen.getByTestId('b'),
        screen.getByTestId('c'),
        screen.getByTestId('a'),
      ]);
    });

    it('observes each shared mutation root once', async () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <div data-testid="list">
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
        </CompositeList>
      ));

      const observedRoots = observe.mock.calls.map(([root]) => root);
      observe.mockRestore();
      expect(observedRoots).toEqual([screen.getByTestId('list')]);
    });

    it('updates indexes when keyed groups reorder', async () => {
      function App() {
        const [reordered, setReordered] = createSignal(false);
        const refs = createRefs();
        const groups = () => (reordered() ? ['b', 'a'] : ['a', 'b']);

        return (
          <CompositeList refs={refs}>
            <button type="button" onClick={() => setReordered(true)}>
              Reorder
            </button>
            <div>
              <For each={groups()}>
                {(group) => (
                  <section>
                    <Item label={group} />
                  </section>
                )}
              </For>
            </div>
          </CompositeList>
        );
      }

      const { user } = await render(() => <App />);

      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');

      await user.click(screen.getByRole('button', { name: 'Reorder' }));

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
    });

    it('observes reorders after the list grows from one item', async () => {
      const [items, setItems] = createSignal(['a']);
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <For each={items()}>{(item) => <Item label={item} />}</For>
        </CompositeList>
      ));
      act(() => setItems(['a', 'b']));
      act(() => setItems(['b', 'a']));

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
    });

    it('updates indexes when grouped items reorder alongside unrelated mutations', async () => {
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <div data-testid="list">
            <section data-testid="group-a">
              <Item label="a" />
            </section>
            <section data-testid="group-b">
              <Item label="b" />
            </section>
          </div>
        </CompositeList>
      ));

      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');

      const list = screen.getByTestId('list');
      const groupA = screen.getByTestId('group-a');
      const groupB = screen.getByTestId('group-b');
      const badge = list.ownerDocument.createElement('span');
      badge.setAttribute('data-testid', 'badge');

      list.insertBefore(groupB, groupA);
      list.appendChild(badge);

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      });
      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '1');
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('ignores mutations for unrelated leaf nodes', async () => {
      const refs = createRefs();
      const onMapChange = vi.fn();

      const { user } = await render(() => (
        <CompositeList refs={refs} onMapChange={onMapChange}>
          <button type="button" onClick={() => screen.getByTestId('badge').remove()}>
            Remove badge
          </button>
          <div data-testid="list">
            <Item label="a" />
            <span data-testid="badge" />
            <Item label="b" />
          </div>
        </CompositeList>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');
      });
      onMapChange.mockClear();

      await user.click(screen.getByRole('button', { name: 'Remove badge' }));

      await waitFor(() => {
        expect(screen.queryByTestId('badge')).toBe(null);
      });
      expect(onMapChange).not.toHaveBeenCalled();
    });

    it('registers items that sit across a shadow boundary', async () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadowContainer = document.createElement('div');
      host.attachShadow({ mode: 'open' }).appendChild(shadowContainer);

      const refs = createRefs();

      try {
        // No ancestor can `contain` both items, so the pair has no common root to observe.
        // Registration still has to hold.
        const { unmount } = await render(() => (
          <CompositeList refs={refs}>
            <Item label="light" />
            <Portal mount={shadowContainer}>
              <Item label="shadow" />
            </Portal>
          </CompositeList>
        ));

        const shadowItem = shadowContainer.querySelector('[data-testid="shadow"]');
        expect(shadowItem).not.toBe(null);
        expect(refs.elements).toHaveLength(2);
        expect(refs.elements).toContain(screen.getByTestId('light'));
        expect(refs.elements).toContain(shadowItem);

        unmount();
        expect(refs.elements).toHaveLength(0);
      } finally {
        host.remove();
      }
    });
  });

  describe('prop: labelsRef', () => {
    function LabelledItem(props: {
      testId: string;
      label?: string | null;
      text?: string;
      useTextRef?: boolean;
    }) {
      const [textElement, setTextElement] = createSignal<HTMLElement | null>(null);
      const { setRef } = useCompositeListItem({
        label: () => props.label,
        textRef: () => (props.useTextRef ? textElement() : undefined),
      });
      return (
        <div ref={setRef} data-testid={props.testId}>
          <span
            ref={(node) => {
              if (untrack(() => props.useTextRef)) {
                setTextElement(node);
              }
            }}
          >
            {props.text}
          </span>
          {props.useTextRef ? '-ignored' : ''}
        </div>
      );
    }

    it('resolves each label source', async () => {
      const refs = createRefs();

      await render(() => (
        <CompositeList refs={refs}>
          <LabelledItem testId="explicit" label="explicit label" text="ignored" />
          {/* An explicit `null` means "no label", and must not fall back to the text. */}
          <LabelledItem testId="null-label" label={null} text="not a label" />
          <LabelledItem testId="text-ref" useTextRef text="from text ref" />
          <LabelledItem testId="element-text" text="from element" />
        </CompositeList>
      ));

      expect(refs.labels).toEqual(['explicit label', null, 'from text ref', 'from element']);
    });

    it('drops label slots for items that unmount', async () => {
      const refs = createRefs();
      const [items, setItems] = createSignal(['a', 'b', 'c']);

      await render(() => (
        <CompositeList refs={refs}>
          <For each={items()}>{(item) => <LabelledItem testId={item} label={item} />}</For>
        </CompositeList>
      ));
      expect(refs.labels).toEqual(['a', 'b', 'c']);

      act(() => setItems(['a']));
      expect(refs.labels).toEqual(['a']);
    });

    it('updates the label of a mounted item', async () => {
      const refs = createRefs();
      const [label, setLabel] = createSignal('before');

      await render(() => (
        <CompositeList refs={refs}>
          <LabelledItem testId="item" label={label()} />
        </CompositeList>
      ));
      expect(refs.labels).toEqual(['before']);

      act(() => setLabel('after'));

      expect(refs.labels).toEqual(['after']);
    });
  });

  describe('prop: onMapChange', () => {
    it('publishes item metadata alongside the index', async () => {
      const refs = createRefs();
      const onMapChange = vi.fn();

      function MetadataItem(props: { testId: string; kind: string }) {
        const metadata = createMemo(() => ({ kind: props.kind }));
        const { setRef } = useCompositeListItem({ metadata });
        return <div ref={setRef} data-testid={props.testId} />;
      }

      await render(() => (
        <CompositeList refs={refs} onMapChange={onMapChange}>
          <MetadataItem testId="first" kind="alpha" />
          <MetadataItem testId="second" kind="beta" />
        </CompositeList>
      ));

      const map = onMapChange.mock.lastCall?.[0] as MapChangeItems;
      const metadataOf = (element: Element) =>
        map.find((item) => item.element === element)?.metadata;
      expect(metadataOf(screen.getByTestId('first'))).toEqual({ kind: 'alpha', index: 0 });
      expect(metadataOf(screen.getByTestId('second'))).toEqual({ kind: 'beta', index: 1 });
    });
  });

  // Solid: there is no thrown-promise Suspense; async rendering suspends through `Loading`
  // boundaries without discarding the subtree, so the React scenario has no equivalent.
  describe.skip('Suspense integration', () => {
    it('does not publish an empty registry when an outer boundary repeatedly suspends', () => {});
  });

  // Solid: jsdom resolves the client build of `@solidjs/web`, which has no `renderToString`.
  describe.skip('server-side rendering', () => {
    it('hydrates a server-rendered list without a mismatch under Strict Mode', () => {});
  });

  describe('without a parent list', () => {
    it('renders an item that is not wrapped in a list', async () => {
      function OrphanItem() {
        const { setRef, index } = useCompositeListItem();
        return <div ref={setRef} data-testid="orphan" data-index={index()} />;
      }

      const { unmount } = await render(() => <OrphanItem />);

      // The default context no-ops keep a stray item inert rather than throwing.
      expect(screen.getByTestId('orphan')).toBeInTheDocument();
      expect(screen.getByTestId('orphan')).toHaveAttribute('data-index', '-1');
      expect(() => unmount()).not.toThrow();
    });
  });
});
