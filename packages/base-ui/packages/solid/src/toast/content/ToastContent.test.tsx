import { expect, describe, it } from 'vitest';
import { createSignal, For } from 'solid-js';
import { Toast } from '@solidports/base-ui/toast';
import { createRenderer, describeConformance } from '#test-utils';
import { fireEvent, screen } from '@solidjs/testing-library';

const toast = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Content />', () => {
  const { render } = createRenderer();

  describeConformance(Toast.Content, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast}>{node(props!)}</Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      ));
    },
  }));

  function App() {
    const { toasts, add } = Toast.useToastManager();
    const [count, setCount] = createSignal(0);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            const next = count() + 1;
            setCount(next);
            add({ title: `toast-${next}` });
          }}
        >
          add
        </button>
        <Toast.Viewport data-testid="viewport">
          <For each={toasts()}>
            {(toastItem) => (
              <Toast.Root toast={toastItem}>
                <Toast.Content data-testid={`content-${toastItem.title}`}>
                  <Toast.Title />
                </Toast.Content>
              </Toast.Root>
            )}
          </For>
        </Toast.Viewport>
      </>
    );
  }

  it('marks content behind the frontmost toast with data-behind', async () => {
    await render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));

    const addButton = screen.getByRole('button', { name: 'add' });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    // The newest toast is at the front; the older one sits behind it.
    expect(screen.getByTestId('content-toast-2')).not.toHaveAttribute('data-behind');
    expect(screen.getByTestId('content-toast-1')).toHaveAttribute('data-behind');
  });

  it('reflects the expanded state when the viewport is hovered', async () => {
    await render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    const content = screen.getByTestId('content-toast-1');
    expect(content).not.toHaveAttribute('data-expanded');

    fireEvent.mouseEnter(screen.getByTestId('viewport'));
    expect(content).toHaveAttribute('data-expanded');
  });
});
