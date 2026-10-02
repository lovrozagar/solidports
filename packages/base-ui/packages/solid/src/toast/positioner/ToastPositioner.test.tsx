import { expect, vi, describe, it } from 'vitest';
import { For } from 'solid-js';
import { Toast } from '@solidports/base-ui/toast';
import { screen, waitFor } from '@solidjs/testing-library';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import type { ToastManagerAddOptions } from '../useToastManager';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props: Toast.Positioner.Props) => <Toast.Positioner {...props} toast={toast} />,
    () => ({
      refInstanceof: window.HTMLDivElement,
      render(node, props) {
        return render(() => <Toast.Provider>{node(props!)}</Toast.Provider>);
      },
    }),
  );

  function AnchoredList() {
    return (
      <For each={Toast.useToastManager().toasts()}>
        {(toastItem) => (
          <Toast.Positioner toast={toastItem} data-testid={toastItem.id}>
            <Toast.Root toast={toastItem}>
              <Toast.Title />
            </Toast.Root>
          </Toast.Positioner>
        )}
      </For>
    );
  }

  function AddButton(props: { options?: Partial<ToastManagerAddOptions<any>> }) {
    const { add } = Toast.useToastManager();
    return (
      <button type="button" onClick={() => add({ title: 'title', ...props.options })}>
        add
      </button>
    );
  }

  it.skipIf(isJSDOM)('positions an anchored toast against its anchor element', async () => {
    function App() {
      let anchorRef: HTMLButtonElement | undefined;
      const { add } = Toast.useToastManager();
      return (
        <>
          <button
            type="button"
            ref={anchorRef}
            style={{
              position: 'absolute',
              top: '200px',
              left: '100px',
              width: '80px',
              height: '20px',
            }}
            onClick={() =>
              add({
                id: 'anchored',
                title: 'title',
                positionerProps: { anchor: anchorRef, side: 'bottom', sideOffset: 8 },
              })
            }
          >
            anchor
          </button>
          <Toast.Viewport>
            <AnchoredList />
          </Toast.Viewport>
        </>
      );
    }

    const { user } = await render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));

    const anchor = screen.getByRole('button', { name: 'anchor' });
    await user.click(anchor);

    const positioner = screen.getByTestId('anchored');
    await waitFor(() => expect(positioner).toHaveAttribute('data-side', 'bottom'));

    const anchorRect = anchor.getBoundingClientRect();
    await waitFor(() => {
      expect(positioner.getBoundingClientRect().top).toBeCloseTo(anchorRect.bottom + 8, 0);
    });
  });

  it('falls back to the viewport when no anchor is provided', async () => {
    const { user } = await render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <AnchoredList />
        </Toast.Viewport>
        <AddButton options={{ id: 'unanchored' }} />
      </Toast.Provider>
    ));

    await user.click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('unanchored');
    // An unanchored positioner still renders, with the defaults applied.
    expect(positioner).toHaveAttribute('data-side', 'top');
    expect(positioner).toHaveAttribute('data-align', 'center');
    expect(positioner).toHaveTextContent('title');
  });

  it('lets positioner props override the ones carried on the toast', async () => {
    function OverridingList() {
      return (
        <For each={Toast.useToastManager().toasts()}>
          {(toastItem) => (
            <Toast.Positioner toast={toastItem} data-testid="positioner" side="left">
              <Toast.Root toast={toastItem}>
                <Toast.Title />
              </Toast.Root>
            </Toast.Positioner>
          )}
        </For>
      );
    }

    const { user } = await render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <OverridingList />
        </Toast.Viewport>
        <AddButton options={{ positionerProps: { side: 'bottom', align: 'end' } }} />
      </Toast.Provider>
    ));

    await user.click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'left');
    // Props not set on the element still come from the toast.
    expect(positioner).toHaveAttribute('data-align', 'end');
  });

  describe('--toast-index', () => {
    const { render: renderFakeTimers, clock } = createRenderer();

    clock.withFakeTimers();

    it('keeps the DOM index while a toast animates out', async () => {
      const manager = Toast.createToastManager();

      await renderFakeTimers(() => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport>
            <AnchoredList />
          </Toast.Viewport>
        </Toast.Provider>
      ));

      await act(async () => {
        manager.add({ id: 'oldest', title: 'oldest' });
      });
      await act(async () => {
        manager.add({ id: 'newest', title: 'newest' });
      });

      const newest = screen.getByTestId('newest');
      const oldest = screen.getByTestId('oldest');

      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('1');

      await act(async () => manager.close('newest'));

      // The closing toast is excluded from the visible stack, but it must keep a
      // real index while it animates out rather than collapsing to `-1`.
      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('0');
    });
  });

  it('throws a descriptive error when rendered outside <Toast.Provider>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() => render(() => <Toast.Positioner toast={toast} />)).toThrow(
        'Base UI: useToastManager must be used within <Toast.Provider>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
