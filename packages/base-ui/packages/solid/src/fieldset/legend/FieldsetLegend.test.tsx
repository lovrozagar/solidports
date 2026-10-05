import { createSignal, Show } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { createRenderer, describeConformance, flushMicrotasks, isJSDOM } from '#test-utils';
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

  it('throws a descriptive error when rendered outside <Fieldset.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: a throwing component also reports REACTIVITY_HALTED through `console.warn`.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Fieldset.Legend />)).toThrow(
        'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
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
});
