import { expect, vi, describe, it } from 'vitest';
import { For } from 'solid-js';
import { Toast } from '@solidports/base-ui/toast';
import { screen, waitFor } from '@solidjs/testing-library';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(Toast.Arrow, () => ({
    refInstanceof: window.Element,
    render(node, props) {
      return render(() => (
        <Toast.Provider>
          <Toast.Positioner toast={toast}>{node(props!)}</Toast.Positioner>
        </Toast.Provider>
      ));
    },
  }));

  it.skipIf(isJSDOM)('mirrors the resolved side of its positioner', async () => {
    function App() {
      let anchorRef: HTMLButtonElement | undefined;
      const { add, toasts } = Toast.useToastManager();
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
                title: 'title',
                positionerProps: { anchor: anchorRef, side: 'bottom' },
              })
            }
          >
            anchor
          </button>
          <Toast.Viewport>
            <For each={toasts()}>
              {(toastItem) => (
                <Toast.Positioner toast={toastItem}>
                  <Toast.Root toast={toastItem}>
                    <Toast.Arrow data-testid="arrow" />
                    <Toast.Title />
                  </Toast.Root>
                </Toast.Positioner>
              )}
            </For>
          </Toast.Viewport>
        </>
      );
    }

    const { user } = await render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));

    await user.click(screen.getByRole('button', { name: 'anchor' }));

    const arrow = screen.getByTestId('arrow');
    await waitFor(() => expect(arrow).toHaveAttribute('data-side', 'bottom'));
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
  });

  it('throws a descriptive error when rendered outside <Toast.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Solid: rendering is synchronous, so the error is thrown rather than rejected.
      expect(() =>
        render(() => (
          <Toast.Provider>
            <Toast.Arrow />
          </Toast.Provider>
        )),
      ).toThrow(
        'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
