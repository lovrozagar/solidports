import { expect, vi } from 'vitest';
import { createSignal, For, Show } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { act, createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
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

  // Solid: a `For` disposes its rows inside its mapping computation, so the label's unmount
  // cleanup writes its root's label id from an owned scope.
  it('unmounts with its root when a For removes or re-keys the row', async () => {
    const [rows, setRows] = createSignal(['a', 'b']);
    render(() => (
      <For each={rows()}>
        {(item) => (
          <Meter.Root value={50}>
            <Meter.Label id={`label-${item}`}>Label</Meter.Label>
          </Meter.Root>
        )}
      </For>
    ));

    expect(screen.getAllByRole('meter')).toHaveLength(2);
    await act(() => setRows(['a']));
    expect(screen.getAllByRole('meter')).toHaveLength(1);
    await act(() => setRows(['c']));
    expect(screen.getByRole('meter')).toHaveAttribute('aria-labelledby', 'label-c');
  });

  it('clears the label association when a For inside the root removes it', async () => {
    const [rows, setRows] = createSignal(['a']);
    render(() => (
      <Meter.Root value={50}>
        <For each={rows()}>{(item) => <Meter.Label id={`label-${item}`}>Label</Meter.Label>}</For>
      </Meter.Root>
    ));

    expect(screen.getByRole('meter')).toHaveAttribute('aria-labelledby', 'label-a');
    await act(() => setRows([]));
    expect(screen.getByRole('meter')).not.toHaveAttribute('aria-labelledby');
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
