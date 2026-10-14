import { createSignal, For, Show } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { act, createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import ssrFixtures from './FieldsetLegend.ssr-fixtures';

describe('<Fieldset.Legend />', () => {
  const { render } = createRenderer();

  describeConformance(Fieldset.Legend, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Fieldset.Root>{node(props!)}</Fieldset.Root>),
  }));

  it('should set aria-labelledby on the fieldset automatically', () => {
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('legend').id,
    );
  });

  it('should set aria-labelledby on the fieldset with custom id', () => {
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend id="legend-id" />
      </Fieldset.Root>
    ));

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-id');
  });

  it('updates and clears the legend association', async () => {
    function App() {
      const [legendId, setLegendId] = createSignal('legend-a');
      const [showLegend, setShowLegend] = createSignal(true);

      return (
        <>
          <Fieldset.Root>
            <Show when={showLegend()}>
              <Fieldset.Legend id={legendId()}>Legend</Fieldset.Legend>
            </Show>
          </Fieldset.Root>
          <button type="button" onClick={() => setLegendId('legend-b')}>
            Change id
          </button>
          <button type="button" onClick={() => setShowLegend(false)}>
            Remove legend
          </button>
        </>
      );
    }

    render(() => <App />);

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-a');
    fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-b');
    fireEvent.click(screen.getByRole('button', { name: 'Remove legend' }));
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-labelledby');
  });

  // Solid: a `For` disposes its rows inside its mapping computation, so the legend's unmount
  // cleanup writes its root's legend id from an owned scope.
  it('unmounts with its root when a For removes or re-keys the row', async () => {
    const [rows, setRows] = createSignal(['a', 'b']);
    render(() => (
      <For each={rows()}>
        {(item) => (
          <Fieldset.Root>
            <Fieldset.Legend id={`legend-${item}`}>Legend</Fieldset.Legend>
          </Fieldset.Root>
        )}
      </For>
    ));

    expect(screen.getAllByRole('group')).toHaveLength(2);
    await act(() => setRows(['a']));
    expect(screen.getAllByRole('group')).toHaveLength(1);
    await act(() => setRows(['c']));
    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-c');
  });

  it('clears the legend association when a For inside the root removes it', async () => {
    const [rows, setRows] = createSignal(['a']);
    render(() => (
      <Fieldset.Root>
        <For each={rows()}>
          {(item) => <Fieldset.Legend id={`legend-${item}`}>Legend</Fieldset.Legend>}
        </For>
      </Fieldset.Root>
    ));

    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-a');
    await act(() => setRows([]));
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Fieldset.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Solid: the uncaught render error also reaches `reportError` where the platform has one.
    const reportErrorSpy =
      typeof globalThis.reportError === 'function'
        ? vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
        : undefined;

    try {
      // Solid: the render throws synchronously rather than rejecting.
      expect(() => render(() => <Fieldset.Legend />)).toThrow(
        'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
      );
    } finally {
      await flushMicrotasks();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      reportErrorSpy?.mockRestore();
    }
  });

  it.skipIf(isJSDOM)('does not set `aria-labelledby` during SSR when legend is absent', () => {
    renderServer(ssrFixtures, 'noLegend');

    expect(screen.getByTestId('fieldset')).not.toHaveAttribute('aria-labelledby');
  });

  it.skipIf(isJSDOM)(
    'sets `aria-labelledby` after hydration without a custom legend id',
    async () => {
      const { hydrate } = renderServer(ssrFixtures, 'withLegend');

      const fieldset = screen.getByTestId('fieldset');
      const legend = screen.getByTestId('legend');

      expect(legend.id).not.toBe('');
      expect(fieldset).not.toHaveAttribute('aria-labelledby');

      hydrate();

      await waitFor(() => {
        expect(screen.getByTestId('fieldset')).toHaveAttribute('aria-labelledby', legend.id);
      });
    },
  );

  it('reflects the disabled state', async () => {
    await render(() => (
      <Fieldset.Root disabled>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('legend')).toHaveAttribute('data-disabled');
  });
});
