import { act, createRenderer, describeConformance } from '#test-utils';
import { Meter } from '@solidports/base-ui/meter';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { createSignal } from 'solid-js';
import { spy } from 'sinon';

describe('<Meter.Value />', () => {
  const { render } = createRenderer();

  describeConformance(Meter.Value, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => render(() => <Meter.Root value={30}>{node(props!)}</Meter.Root>),
  }));

  describe('prop: children', () => {
    it('renders the value when children is not provided', async () => {
      render(() => (
        <Meter.Root value={30}>
          <Meter.Value data-testid="value" />
        </Meter.Root>
      ));

      const value = screen.getByTestId('value');
      expect(value).to.have.text((0.3).toLocaleString(undefined, { style: 'percent' }));
    });

    it('renders a formatted value when a format is provided', async () => {
      const format: Intl.NumberFormatOptions = {
        currency: 'USD',
        style: 'currency',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      render(() => (
        <Meter.Root value={30} format={format}>
          <Meter.Value data-testid="value" />
        </Meter.Root>
      ));

      const value = screen.getByTestId('value');
      expect(value).to.have.text(formatValue(30));
    });

    it('accepts a render function', async () => {
      const renderSpy = spy();
      const format: Intl.NumberFormatOptions = {
        currency: 'USD',
        style: 'currency',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      render(() => (
        <Meter.Root value={30} format={format}>
          <Meter.Value data-testid="value">{renderSpy}</Meter.Value>
        </Meter.Root>
      ));

      expect(renderSpy.lastCall.args[0]).to.deep.equal(formatValue(30));
      expect(renderSpy.lastCall.args[1]).to.deep.equal(30);
    });

    it('passes updated arguments to the render function when value changes', async () => {
      const renderSpy = spy();
      const [value, setValue] = createSignal(30);

      render(() => (
        <Meter.Root value={value()}>
          <Meter.Value>{renderSpy}</Meter.Value>
        </Meter.Root>
      ));

      expect(renderSpy.lastCall.args[0]).to.deep.equal(
        (0.3).toLocaleString(undefined, { style: 'percent' }),
      );
      expect(renderSpy.lastCall.args[1]).to.deep.equal(30);

      act(() => setValue(60));

      expect(renderSpy.lastCall.args[0]).to.deep.equal(
        (0.6).toLocaleString(undefined, { style: 'percent' }),
      );
      expect(renderSpy.lastCall.args[1]).to.deep.equal(60);
    });
  });
});
