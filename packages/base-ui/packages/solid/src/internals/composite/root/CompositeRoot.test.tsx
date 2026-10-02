/* eslint-disable typescript/no-explicit-any -- render-prop props are spread onto nested composite items */
import { expect, vi, describe, it } from 'vitest';
import { act, createRenderer, flushMicrotasks, isJSDOM } from '#test-utils';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createMemo, createSignal, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { DirectionProvider } from '../../../direction-provider';
import { useRef } from '../../../solid-helpers';
import type { UseRenderElementRef } from '../../../utils/types';
import { CompositeItem } from '../item/CompositeItem';
import { type CompositeMetadata } from '../list/CompositeList';
import { useCompositeListItem } from '../list/useCompositeListItem';
import { CompositeRoot } from './CompositeRoot';
import { gridNavigation } from './gridNavigation';
import type { CompositeElementsRef } from './useCompositeRoot';

const threeColsGrid = gridNavigation({ cols: 3 });

describe('Composite', () => {
  const { render } = createRenderer();
  const gridItems = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  function IndexedItem(props: { index: number; active?: boolean; testId: string }) {
    const { setRef } = useCompositeListItem({ index: () => props.index });
    return (
      <div
        ref={setRef}
        data-testid={props.testId}
        data-composite-item-active={props.active ? '' : undefined}
      />
    );
  }

  function TestGridItems() {
    return (
      <For each={gridItems}>{(i) => <CompositeItem data-testid={i}>{i}</CompositeItem>}</For>
    );
  }

  describe('list', () => {
    it('does not add aria-orientation when orientation is set', async () => {
      const { container } = await render(() => (
        <CompositeRoot orientation="horizontal">
          <CompositeItem>1</CompositeItem>
          <CompositeItem>2</CompositeItem>
        </CompositeRoot>
      ));

      expect(container.firstElementChild as HTMLElement).not.toHaveAttribute('aria-orientation');
    });

    it('controlled mode', async () => {
      function App() {
        const [highlightedIndex, setHighlightedIndex] = createSignal(0);
        return (
          <CompositeRoot
            highlightedIndex={highlightedIndex()}
            onHighlightedIndexChange={setHighlightedIndex}
          >
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>
        );
      }

      render(() => <App />);

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      expect(item1).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('uncontrolled mode', async () => {
      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>
      ));

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('uses an active item explicit index as the initial highlighted index', async () => {
      const onHighlightedIndexChange = vi.fn();

      await render(() => (
        <CompositeRoot highlightedIndex={0} onHighlightedIndexChange={onHighlightedIndexChange}>
          <IndexedItem testId="two" index={2} active />
          <IndexedItem testId="zero" index={0} />
          <IndexedItem testId="one" index={1} />
        </CompositeRoot>
      ));

      expect(onHighlightedIndexChange).toHaveBeenCalledWith(2);
    });

    it('keeps native input behavior when the native target differs from the synthetic target', async () => {
      render(() => (
        <CompositeRoot orientation="horizontal">
          <CompositeItem data-testid="1">1</CompositeItem>
          <div data-testid="host" />
          <CompositeItem data-testid="2">2</CompositeItem>
        </CompositeRoot>
      ));

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const host = screen.getByTestId('host');
      const input = document.createElement('input');

      input.type = 'text';
      input.value = 'abcd';
      input.setSelectionRange(2, 2);

      // Solid: delegated events walk `composedPath()`, so the simulated shadow path continues
      // through the host's real ancestors.
      const pathFromHost = () => {
        const path: EventTarget[] = [];
        for (let node: Node | null = host; node; node = node.parentNode) {
          path.push(node);
        }
        return [input, ...path, window];
      };

      const focusEvent = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(focusEvent, 'composedPath', {
        configurable: true,
        value: pathFromHost,
      });

      fireEvent(host, focusEvent);

      // Focusing a native input within a composite selects the whole value so
      // the first arrow key returns control to the textbox before moving focus.
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);

      act(() => item1.focus());

      input.setSelectionRange(1, 1);

      const keyDownEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(keyDownEvent, 'composedPath', {
        configurable: true,
        value: pathFromHost,
      });

      fireEvent(host, keyDownEvent);
      await flushMicrotasks();

      expect(item1).toHaveFocus();
      expect(item2).not.toHaveFocus();
    });

    it.each([
      { orientation: 'horizontal' as const, key: 'ArrowRight', prevented: true },
      { orientation: 'horizontal' as const, key: 'ArrowDown', prevented: false },
      { orientation: 'vertical' as const, key: 'ArrowDown', prevented: true },
      { orientation: 'vertical' as const, key: 'ArrowRight', prevented: false },
      { orientation: 'both' as const, key: 'ArrowRight', prevented: true },
      { orientation: 'both' as const, key: 'ArrowDown', prevented: true },
    ])(
      'sets default prevention to $prevented for $key with $orientation orientation',
      async ({ orientation, key, prevented }) => {
        await render(() => (
          <CompositeRoot orientation={orientation}>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
          </CompositeRoot>
        ));

        const item1 = screen.getByTestId('1');
        act(() => item1.focus());

        const allowed = fireEvent.keyDown(item1, { key });
        await flushMicrotasks();

        expect(allowed).toBe(!prevented);
      },
    );

    it.skipIf(isJSDOM)('updates the order of items', async () => {
      function App(props: { items: string[] }) {
        return (
          <CompositeRoot>
            <For each={props.items}>
              {(item) => <CompositeItem data-testid={item}>{item}</CompositeItem>}
            </For>
          </CompositeRoot>
        );
      }
      const [items, setItems] = createSignal(['1', '2', '3']);
      const { user } = render(() => <App items={items()} />);
      act(() => setItems(['1', '3', '2']));

      const item1 = screen.getByTestId('1');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());
      await user.keyboard('{ArrowDown}');
      expect(item3).toHaveFocus();
    });

    it.skipIf(isJSDOM)(
      'updates the order of items when their containers are reordered',
      async () => {
        function App(props: { groups: string[] }) {
          return (
            <CompositeRoot>
              <For each={props.groups}>
                {(group) => (
                  <div role="group">
                    <CompositeItem data-testid={group}>{group}</CompositeItem>
                  </div>
                )}
              </For>
            </CompositeRoot>
          );
        }
        const [groups, setGroups] = createSignal(['a', 'b', 'c']);
        const { user } = render(() => <App groups={groups()} />);
        act(() => setGroups(['b', 'a', 'c']));

        const itemA = screen.getByTestId('a');
        const itemB = screen.getByTestId('b');

        // The re-sort commits asynchronously (MutationObserver); once it does,
        // the roving tab stop (highlighted index 0) belongs to the first item in
        // the new DOM order.
        await waitFor(() => {
          expect(itemB).toHaveAttribute('tabindex', '0');
        });

        act(() => itemB.focus());
        await user.keyboard('{ArrowDown}');
        expect(itemA).toHaveFocus();
      },
    );

    describe('Home and End keys', () => {
      it('Home key moves focus to the first item', async () => {
        render(() => (
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>
        ));

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        act(() => item3.focus());

        fireEvent.keyDown(item3, { key: 'Home' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();
      });

      it('End key moves focus to the last item', async () => {
        render(() => (
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>
        ));

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        act(() => item1.focus());

        fireEvent.keyDown(item1, { key: 'End' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });

    it('calls onLoop and uses its return value', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          _nextIndex: number,
          _elementsRef: CompositeElementsRef,
        ) => 1,
      );

      function App() {
        return (
          <CompositeRoot onLoop={onLoop}>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(() => <App />);

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledOnce();

      const [event, prevIndex, nextIndex, elementsRef] = onLoop.mock.calls[0]!;
      expect(event.key).toBe('ArrowDown');
      expect(prevIndex).toBe(8);
      expect(nextIndex).toBe(0);
      expect(elementsRef.current[8]).toBe(screen.getByTestId('9'));
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveFocus();
    });

    it('does not loop or call onLoop when loopFocus is disabled', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: CompositeElementsRef,
        ) => nextIndex,
      );

      await render(() => (
        <CompositeRoot loopFocus={false} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).not.toHaveBeenCalled();
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    describe.skipIf(isJSDOM)('rtl', () => {
      it('horizontal orientation', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="horizontal">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        act(() => item1.focus());

        fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        // loop backward
        fireEvent.keyDown(item1, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });

      it('both horizontal and vertical orientation', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="both">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        act(() => item1.focus());

        fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });
  });

  describe('grid', () => {
    it('prevents default for grid navigation outside the configured orientation', async () => {
      await render(() => (
        <CompositeRoot grid={threeColsGrid} orientation="horizontal">
          <TestGridItems />
        </CompositeRoot>
      ));

      const item1 = screen.getByTestId('1');
      act(() => item1.focus());

      const allowed = fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(allowed).toBe(false);
    });

    it('uniform 1x1 items', async () => {
      function App() {
        return (
          <CompositeRoot grid={threeColsGrid} enableHomeAndEndKeys>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(() => <App />);

      act(() => screen.getByTestId('1').focus());

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('4')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('5')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('5'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('8')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('8'), { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(screen.getByTestId('7')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('7')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('7'), { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('4')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(screen.getByTestId('6')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('6')).toHaveFocus();

      act(() => screen.getByTestId('9').focus());
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'Home' });
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'End' });
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
    });

    it('calls onLoop while navigating through grid cells', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          _nextIndex: number,
          _elementsRef: CompositeElementsRef,
        ) => 4,
      );

      function App() {
        return (
          <CompositeRoot grid={threeColsGrid} onLoop={onLoop}>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(() => <App />);

      act(() => screen.getByTestId('6').focus());

      fireEvent.keyDown(screen.getByTestId('6'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledOnce();

      const [event, prevIndex, nextIndex, elementsRef] = onLoop.mock.calls[0]!;
      expect(event.key).toBe('ArrowRight');
      expect(prevIndex).toBe(5);
      expect(nextIndex).toBe(3);
      expect(elementsRef.current[5]).toBe(screen.getByTestId('6'));
      expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('5')).toHaveFocus();
    });

    it('calls onLoop when looping vertically between rows', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: CompositeElementsRef,
        ) => nextIndex,
      );

      await render(() => (
        <CompositeRoot grid={threeColsGrid} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(1);

      const [downEvent, downPrevIndex, downNextIndex] = onLoop.mock.calls[0]!;
      expect(downEvent.key).toBe('ArrowDown');
      expect(downPrevIndex).toBe(8);
      expect(downNextIndex).toBe(2);
      expect(screen.getByTestId('3')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(2);

      const [upEvent, upPrevIndex, upNextIndex] = onLoop.mock.calls[1]!;
      expect(upEvent.key).toBe('ArrowUp');
      expect(upPrevIndex).toBe(2);
      expect(upNextIndex).toBe(8);
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('stays on the current item when onLoop returns prevIndex', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          prevIndex: number,
          _nextIndex: number,
          _elementsRef: CompositeElementsRef,
        ) => prevIndex,
      );

      await render(() => (
        <CompositeRoot grid={threeColsGrid} orientation="horizontal" onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('does not loop or call onLoop when loopFocus is disabled', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: CompositeElementsRef,
        ) => nextIndex,
      );

      await render(() => (
        <CompositeRoot grid={threeColsGrid} loopFocus={false} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).not.toHaveBeenCalled();
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('skips disabled indices', async () => {
      function App() {
        return (
          <CompositeRoot grid={threeColsGrid} disabledIndices={[4]}>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(() => <App />);

      act(() => screen.getByTestId('2').focus());

      fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('8')).toHaveFocus();
    });

    it('packs items into earlier gaps when dense', async () => {
      await render(() => (
        <CompositeRoot
          grid={gridNavigation({
            cols: 2,
            dense: true,
            itemSizes: [
              { width: 1, height: 1 },
              { width: 2, height: 1 },
              { width: 1, height: 1 },
            ],
          })}
        >
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>
      ));

      // Item 2 is too wide for the first row, so dense packing backfills
      // item 3 into the gap next to item 1. Without `dense`, that cell stays
      // empty and item 3 is placed below item 2.
      act(() => screen.getByTestId('1').focus());

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('3')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveFocus();
    });

    describe.skipIf(isJSDOM)('rtl', () => {
      it('horizontal orientation', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot grid={threeColsGrid} orientation="horizontal" enableHomeAndEndKeys>
                <TestGridItems />
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));

        act(() => screen.getByTestId('1').focus());

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('2')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('3')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('5')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('5'), { key: 'Home' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'End' });
        await flushMicrotasks();

        expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      });

      it('both horizontal and vertical orientation', async () => {
        await render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot grid={threeColsGrid} orientation="both" enableHomeAndEndKeys>
                <TestGridItems />
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));

        act(() => screen.getByTestId('1').focus());

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('5')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('5'), { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('8')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('8'), { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(screen.getByTestId('7')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('7')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('7'), { key: 'ArrowUp' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'End' });
        await flushMicrotasks();

        expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(screen.getByTestId('9'), { key: 'Home' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      });

      it('uses the forward edge when navigating from a spanning item', async () => {
        await render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot
                grid={gridNavigation({
                  cols: 3,
                  itemSizes: [
                    { width: 1, height: 1 },
                    { width: 2, height: 1 },
                    { width: 1, height: 1 },
                  ],
                })}
                orientation="both"
              >
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));

        act(() => screen.getByTestId('2').focus());

        fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('1')).toHaveFocus();
      });
    });
  });

  describe('prop: disabledIndices', () => {
    it('moves the initial tab stop to the first enabled item when the default item is disabled', async () => {
      await render(() => (
        <CompositeRoot disabledIndices={[0]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
        </CompositeRoot>
      ));

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the initial tab stop when all items are disabled', async () => {
      await render(() => (
        <CompositeRoot disabledIndices={[0, 1]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
        </CompositeRoot>
      ));

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });

    it('disables navigating item when their index is included', async () => {
      function App() {
        const [highlightedIndex, setHighlightedIndex] = createSignal(0);
        return (
          <CompositeRoot
            highlightedIndex={highlightedIndex()}
            onHighlightedIndexChange={setHighlightedIndex}
            disabledIndices={[1]}
          >
            <CompositeItem data-testid="1" />
            <CompositeItem data-testid="2" />
            <CompositeItem data-testid="3" />
          </CompositeRoot>
        );
      }

      render(() => <App />);

      const item1 = screen.getByTestId('1');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('allows navigating items disabled in the DOM when their index is excluded', async () => {
      // Solid: the render prop takes a tag and attributes instead of an element.
      const disabledSpan = {
        component: 'span',
        'data-disabled': true,
        'aria-disabled': true,
        disabled: true,
      } as const;

      function App() {
        const [highlightedIndex, setHighlightedIndex] = createSignal(0);
        return (
          <CompositeRoot
            highlightedIndex={highlightedIndex()}
            onHighlightedIndexChange={setHighlightedIndex}
            disabledIndices={[]}
          >
            <CompositeItem data-testid="1" render={disabledSpan} />
            <CompositeItem data-testid="2" render={disabledSpan} />
            <CompositeItem data-testid="3" render={disabledSpan} />
          </CompositeRoot>
        );
      }

      await render(() => <App />);

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();
    });
  });

  // Solid: props change through signals instead of `setProps`.
  describe('item removal', () => {
    it('keeps the tab stop on the highlighted item when an earlier item is removed', async () => {
      const [showFirst, setShowFirst] = createSignal(true);

      await render(() => (
        <CompositeRoot>
          <Show when={showFirst()}>
            <CompositeItem data-testid="1" />
          </Show>
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
          <CompositeItem data-testid="4" />
        </CompositeRoot>
      ));

      const item1 = screen.getByTestId('1');
      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      act(() => setShowFirst(false));
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '-1');

      // navigation continues from the item that holds the tab stop
      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveFocus();
    });

    it('moves the tab stop back into range when the highlighted item is removed', async () => {
      const [showLast, setShowLast] = createSignal(true);

      await render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <Show when={showLast()}>
            <CompositeItem data-testid="3" />
          </Show>
        </CompositeRoot>
      ));

      const item1 = screen.getByTestId('1');
      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');

      act(() => setShowLast(false));
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });

    it('moves the tab stop to the active item when the highlighted item is removed', async () => {
      const [showLast, setShowLast] = createSignal(true);

      await render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" data-composite-item-active="" />
          <Show when={showLast()}>
            <CompositeItem data-testid="4" />
          </Show>
        </CompositeRoot>
      ));

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      act(() => item3.focus());

      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');

      act(() => setShowLast(false));
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(item3).toHaveAttribute('tabindex', '0');
    });

    it('skips items that cannot hold the tab stop', async () => {
      const [showLast, setShowLast] = createSignal(true);

      await render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" style={{ display: 'none' }} />
          <CompositeItem data-testid="2" aria-disabled="true" />
          <CompositeItem data-testid="3" />
          <Show when={showLast()}>
            <CompositeItem data-testid="4" />
          </Show>
        </CompositeRoot>
      ));

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      act(() => item3.focus());

      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');

      act(() => setShowLast(false));
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
      expect(item3).toHaveAttribute('tabindex', '0');
    });

    it('keeps the tab stop in range when no item can hold it', async () => {
      const [showLast, setShowLast] = createSignal(true);

      await render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" aria-disabled="true" />
          <CompositeItem data-testid="2" aria-disabled="true" />
          <Show when={showLast()}>
            <CompositeItem data-testid="3" />
          </Show>
        </CompositeRoot>
      ));

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');

      act(() => setShowLast(false));
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });
  });

  // Solid-only: `refs` accepts Solid's ref shapes.
  describe('prop: refs', () => {
    it('calls callback refs with the root element', () => {
      let rootEl: HTMLElement | null | undefined;
      render(() => (
        <CompositeRoot
          refs={[
            (el: HTMLElement | null | undefined) => {
              rootEl = el;
            },
          ]}
          data-testid="root"
        >
          <CompositeItem data-testid="1">1</CompositeItem>
        </CompositeRoot>
      ));
      expect(rootEl).toBe(screen.getByTestId('root'));
    });

    it('calls multiple callback refs with the root element', () => {
      const received: (HTMLElement | null | undefined)[] = [];
      render(() => (
        <CompositeRoot
          refs={[
            (el: HTMLElement | null | undefined) => received.push(el),
            (el: HTMLElement | null | undefined) => received.push(el),
          ]}
          data-testid="root"
        >
          <CompositeItem data-testid="1">1</CompositeItem>
        </CompositeRoot>
      ));
      expect(received).toHaveLength(2);
      expect(received[0]).toBe(screen.getByTestId('root'));
      expect(received[1]).toBe(screen.getByTestId('root'));
    });

    it('handles mixed ref types (variable, object, useRef, callback, setter-to-both)', () => {
      let ref1: HTMLElement | null | undefined;
      const ref2 = { current: null as HTMLElement | null };
      const ref3 = useRef<HTMLElement | null>(null);
      const [ref4, setRef4] = createSignal<HTMLElement | null | undefined>(undefined);
      const ref51 = useRef<HTMLElement | null>(null);
      let ref52: HTMLElement | null | undefined;
      const setRef5 = (el: HTMLElement | null | undefined) => {
        ref51.current = el ?? null;
        ref52 = el;
      };
      render(() => (
        <CompositeRoot
          refs={[
            (el) => {
              ref1 = el;
            },
            ref2,
            ref3,
            (el) => setRef4(el),
            setRef5,
          ]}
          data-testid="root"
        >
          <CompositeItem data-testid="1">1</CompositeItem>
        </CompositeRoot>
      ));
      const root = screen.getByTestId('root');
      expect(ref1).toBe(root);
      expect(ref2.current).toBe(root);
      expect(ref3.current).toBe(root);
      // eslint-disable-next-line solid/reactivity
      expect(ref4()).toBe(root);
      expect(ref51.current).toBe(root);
      expect(ref52).toBe(root);
    });

    it('plain let ref stays null when passed by value (primitive cannot be reassigned)', () => {
      const ref: HTMLElement | null = null;
      render(() => (
        <CompositeRoot refs={[ref as any]} data-testid="root">
          <CompositeItem data-testid="1">1</CompositeItem>
        </CompositeRoot>
      ));
      expect(ref).toBe(null);
    });

    it('flattens nested arrays of refs', () => {
      const received: (HTMLElement | null | undefined)[] = [];
      const refObj = { current: null as HTMLElement | null };
      render(() => (
        <CompositeRoot
          refs={[[(el) => received.push(el), (el) => received.push(el)], refObj]}
          data-testid="root"
        >
          <CompositeItem data-testid="1">1</CompositeItem>
        </CompositeRoot>
      ));
      const root = screen.getByTestId('root');
      expect(received).toHaveLength(2);
      expect(received[0]).toBe(root);
      expect(received[1]).toBe(root);
      expect(refObj.current).toBe(root);
    });
  });

  describe('prop: modifierKeys', () => {
    it('prevents arrow key navigation when any modifier key is pressed by default', async () => {
      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
        </CompositeRoot>
      ));

      const item1 = screen.getByTestId('1');

      act(() => item1.focus());

      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();
    });

    it('specifies allowed modifier keys that do not prevent arrow key navigation when pressed', async () => {
      render(() => (
        <CompositeRoot modifierKeys={['Alt', 'Meta']}>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>
      ));

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item3).toHaveFocus();
    });
  });
});

interface NestedItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

const FOCUSABLE_DISABLED: NestedItemMetadata = {
  disabled: true,
  focusableWhenDisabled: true,
};

const UNFOCUSABLE_DISABLED: NestedItemMetadata = {
  disabled: true,
  focusableWhenDisabled: false,
};

// Solid: the outer item's render function hands its props (and ref) to the nested item.
function NestedItem(
  props: JSX.HTMLAttributes<HTMLButtonElement> & { ref?: UseRenderElementRef<HTMLElement> },
) {
  return (
    <CompositeItem
      tag="button"
      metadata={UNFOCUSABLE_DISABLED}
      refs={props.ref ? [props.ref] : []}
      {...(props as any)}
    />
  );
}

function NestedItemsRoot() {
  // Solid: CompositeList reports the sorted items as an array.
  const [itemMap, setItemMap] = createSignal<
    Array<{ element: Element; metadata: CompositeMetadata<NestedItemMetadata> | null }>
  >([]);
  const disabledIndices = createMemo(() => {
    const output: number[] = [];

    itemMap().forEach(({ metadata }) => {
      if (metadata && metadata.disabled && !metadata.focusableWhenDisabled) {
        output.push(metadata.index!);
      }
    });

    return output;
  });

  return (
    <CompositeRoot
      orientation="horizontal"
      disabledIndices={disabledIndices()}
      onMapChange={setItemMap}
    >
      <CompositeItem tag="button" metadata={FOCUSABLE_DISABLED} data-testid="first" />
      <CompositeItem
        tag="button"
        render={(props: any) => <NestedItem {...props} data-testid="second" />}
        metadata={FOCUSABLE_DISABLED}
      />
      <CompositeItem
        tag="button"
        render={(props: any) => <NestedItem {...props} data-testid="third" />}
        metadata={FOCUSABLE_DISABLED}
      />
    </CompositeRoot>
  );
}

function DynamicNestedItem(
  props: JSX.HTMLAttributes<HTMLButtonElement> & {
    revision: number;
    ref?: UseRenderElementRef<HTMLElement>;
  },
) {
  // Only the inner registration data changes; the outer item's stays put.
  const metadata = createMemo(() => ({ ...UNFOCUSABLE_DISABLED, revision: props.revision }));

  return (
    <CompositeItem
      tag="button"
      metadata={metadata}
      refs={props.ref ? [props.ref] : []}
      {...(props as any)}
    />
  );
}

function DynamicNestedRoot(props: {
  onMapChange: (map: Array<{ element: Element; metadata: CompositeMetadata<any> | null }>) => void;
}) {
  const [revision, setRevision] = createSignal(0);

  return (
    <>
      <button type="button" onClick={() => setRevision((value) => value + 1)}>
        Update inner
      </button>
      <CompositeRoot orientation="horizontal" onMapChange={props.onMapChange}>
        <CompositeItem
          tag="button"
          render={(itemProps: any) => (
            <DynamicNestedItem {...itemProps} data-testid="shared" revision={revision()} />
          )}
          metadata={FOCUSABLE_DISABLED}
        />
      </CompositeRoot>
    </>
  );
}

// Solid: there is no StrictMode, so both variants run the same way.
describe.each([false, true])('nested Composite items (strict: %s)', () => {
  const { render } = createRenderer();

  it('keeps outer metadata and focus navigation when items share a DOM node', async () => {
    const { user } = await render(() => <NestedItemsRoot />);
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    const third = screen.getByTestId('third');

    await user.tab();
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(second).toHaveFocus();
    });

    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(third).toHaveFocus();
    });
  });

  it('keeps the outer registration when only the inner item updates', async () => {
    const onMapChange = vi.fn();
    const { user } = await render(() => <DynamicNestedRoot onMapChange={onMapChange} />);
    const shared = screen.getByTestId('shared');
    const publishedMetadata = () =>
      (
        onMapChange.mock.lastCall?.[0] as Array<{
          element: Element;
          metadata: NestedItemMetadata;
        }>
      )?.find((item) => item.element === shared)?.metadata;

    // Both items register the same node; the outer ref attaches last and owns the entry.
    expect(publishedMetadata()).toMatchObject({ focusableWhenDisabled: true });

    // Updating only the inner item must not hand it ownership. Registration precedence comes
    // from ref attachment order, so the inner item cannot republish on its own.
    await user.click(screen.getByRole('button', { name: 'Update inner' }));

    expect(publishedMetadata()).toMatchObject({ focusableWhenDisabled: true });
  });
});
