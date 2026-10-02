import { createRenderer, describeConformance } from '#test-utils';
import { Progress } from '@solidports/base-ui/progress';
import { screen } from '@solidjs/testing-library';
import { spy } from 'sinon';
import { expect, vi } from 'vitest';

describe('<Progress.Value />', () => {
  const { render } = createRenderer();

  describeConformance(Progress.Value, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => render(() => <Progress.Root value={40}>{node(props!)}</Progress.Root>),
  }));

  describe('prop: children', () => {
    it('renders the value when children is not provided', async () => {
      render(() => (
        <Progress.Root value={30}>
          <Progress.Value data-testid="value" />
        </Progress.Root>
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
        <Progress.Root value={30} format={format}>
          <Progress.Value data-testid="value" />
        </Progress.Root>
      ));

      const value = screen.getByTestId('value');
      expect(value).to.have.text(formatValue(30));
    });

    describe('it accepts a render function', () => {
      it('numerical value', async () => {
        const renderSpy = spy();
        const format: Intl.NumberFormatOptions = {
          currency: 'USD',
          style: 'currency',
        };
        function formatValue(v: number) {
          return new Intl.NumberFormat(undefined, format).format(v);
        }
        render(() => (
          <Progress.Root value={30} format={format}>
            <Progress.Value data-testid="value">{renderSpy}</Progress.Value>
          </Progress.Root>
        ));
        expect(renderSpy.lastCall.args[0]).to.deep.equal(formatValue(30));
        expect(renderSpy.lastCall.args[1]).to.deep.equal(30);
      });

      it.each([null, Number.NaN])('indeterminate value %s', async (value) => {
        const renderSpy = vi.fn();
        const format: Intl.NumberFormatOptions = {
          style: 'currency',
          currency: 'USD',
        };
        render(() => (
          <Progress.Root value={value} format={format}>
            <Progress.Value data-testid="value">{renderSpy}</Progress.Value>
          </Progress.Root>
        ));
        expect(renderSpy.mock.lastCall?.[0]).to.deep.equal('indeterminate');
        expect(renderSpy.mock.lastCall?.[1]).to.deep.equal(value);
      });
    });
  });
});
