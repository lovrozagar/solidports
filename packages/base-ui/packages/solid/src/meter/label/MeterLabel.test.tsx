import { expect, vi } from 'vitest';
import { createSignal, Show } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { Meter } from '@solidports/base-ui/meter';

describe('<Meter.Label />', () => {
  const { render } = createRenderer();

  describeConformance(Meter.Label, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => render(() => <Meter.Root value={50}>{node(props!)}</Meter.Root>),
  }));

  it('updates and clears the meter label association', async () => {
    function App() {
      const [labelId, setLabelId] = createSignal('label-a');
      const [showLabel, setShowLabel] = createSignal(true);

      return (
        <>
          <Meter.Root value={50}>
            <Show when={showLabel()}>
              <Meter.Label id={labelId()}>Battery level</Meter.Label>
            </Show>
          </Meter.Root>
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

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-labelledby', 'label-a');

    fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    expect(meter).toHaveAttribute('aria-labelledby', 'label-b');

    fireEvent.click(screen.getByRole('button', { name: 'Remove label' }));
    expect(meter).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Meter.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Meter.Label />)).toThrow(
        'Base UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
