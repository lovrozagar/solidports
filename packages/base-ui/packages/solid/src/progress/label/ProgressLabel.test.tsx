import { expect, vi } from 'vitest';
import { createSignal, Show } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { Progress } from '@solidports/base-ui/progress';

describe('<Progress.Label />', () => {
  const { render } = createRenderer();

  describeConformance(Progress.Label, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => render(() => <Progress.Root value={40}>{node(props!)}</Progress.Root>),
  }));

  it('updates and clears the progress bar label association', async () => {
    function App() {
      const [labelId, setLabelId] = createSignal('label-a');
      const [showLabel, setShowLabel] = createSignal(true);

      return (
        <>
          <Progress.Root value={40}>
            <Show when={showLabel()}>
              <Progress.Label id={labelId()}>Upload progress</Progress.Label>
            </Show>
          </Progress.Root>
          <button type="button" onClick={() => setLabelId('label-b')}>
            Change id
          </button>
          <button type="button" onClick={() => setShowLabel(false)}>
            Remove label
          </button>
        </>
      );
    }

    render(() => <App />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-a');

    fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-b');

    fireEvent.click(screen.getByRole('button', { name: 'Remove label' }));
    expect(progressbar).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Progress.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Progress.Label />)).toThrow(
        'Base UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
