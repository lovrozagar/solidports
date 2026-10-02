import { vi, it, describe, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, For, Show, untrack } from 'solid-js';
import { useClick, useFloating, useInteractions, useListNavigation } from '../index';

vi.mock('../../utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../utils/platform')>('../../utils/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

function App() {
  const [open, setOpen] = createSignal(false);
  const listRef: Array<HTMLLIElement | null> = [];
  const [activeIndex, setActiveIndex] = createSignal<null | number>(null);
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick({ context }),
    useListNavigation({
      context,
      props: {
        listRef,
        get activeIndex() {
          return activeIndex();
        },
        onNavigate: setActiveIndex,
      },
    }),
  ]);

  return (
    <>
      <button {...getReferenceProps({ ref: refs.setReference })} />
      <Show when={open()}>
        <div role="menu" {...getFloatingProps({ ref: refs.setFloating })}>
          <ul>
            <For each={['one', 'two', 'three']}>
              {(string, index) => (
                <li
                  data-testid={`item-${index()}`}
                  aria-selected={activeIndex() === index() ? 'true' : 'false'}
                  tabindex={-1}
                  {...getItemProps<HTMLLIElement>({
                    ref(node) {
                      // Solid: refs run untracked; read the index without subscribing.
                      listRef[untrack(index)] = node;
                    },
                  })}
                >
                  {string}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </>
  );
}

describe('useListNavigation (WebKit)', () => {
  it('ignores stationary mousemove events fired when the list scrolls beneath the pointer', async () => {
    render(() => <App />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // WebKit fires a `mousemove` event with zero movement deltas on the item
    // that moves under the stationary pointer during a keyboard-driven scroll.
    fireEvent.mouseMove(screen.getByTestId('item-1'));
    expect(screen.getByTestId('item-0')).toHaveFocus();
    expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'false');

    // An actual pointer movement still moves the highlight.
    fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });
    expect(screen.getByTestId('item-1')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps keyboard modality when a stationary pointermove fires on the floating element', async () => {
    render(() => <App />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // The stationary sequence bubbles a `pointermove` through the floating
    // element before the item receives the `mousemove`.
    fireEvent.pointerMove(screen.getByRole('menu'), { pointerType: 'mouse' });
    fireEvent.mouseMove(screen.getByTestId('item-1'));
    expect(screen.getByTestId('item-0')).toHaveFocus();

    // Scrolling can also move the active item out from under the pointer. This
    // must not reset the keyboard highlight as though the pointer had left it.
    fireEvent.pointerLeave(screen.getByTestId('item-0'), {
      pointerType: 'mouse',
      relatedTarget: screen.getByRole('menu'),
    });
    expect(screen.getByTestId('item-0')).toHaveAttribute('aria-selected', 'true');
  });
});
