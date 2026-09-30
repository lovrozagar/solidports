import { createRenderer, describeConformance } from '#test-utils';
import { Slider } from '@solidports/base-ui/slider';
import { screen } from '@solidjs/testing-library';
import { expect } from 'chai';
import { spy } from 'sinon';

describe('<Slider.Value />', () => {
  const { render } = createRenderer();

  describeConformance(Slider.Value, () => ({
    refInstanceof: window.HTMLOutputElement,
    render: (node, props) => {
      return render(() => <Slider.Root>{node(props!)}</Slider.Root>);
    },
  }));

  it('renders a single value', async () => {
    render(() => (
      <Slider.Root defaultValue={40}>
        <Slider.Value data-testid="output" />
      </Slider.Root>
    ));

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).to.have.text('40');
  });

  it('renders a range', async () => {
    render(() => (
      <Slider.Root defaultValue={[40, 65]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>
    ));

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).to.have.text('40 – 65');
  });

  it('renders all thumb values', async () => {
    render(() => (
      <Slider.Root defaultValue={[40, 60, 80, 95]}>
        <Slider.Value data-testid="output" />
      </Slider.Root>
    ));

    const sliderValue = screen.getByTestId('output');

    expect(sliderValue).to.have.text('40 – 60 – 80 – 95');
  });

  describe('prop: children', () => {
    it('accepts a render function', async () => {
      const format: Intl.NumberFormatOptions = {
        currency: 'USD',
        style: 'currency',
      };
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, format).format(v);
      }
      const renderSpy = spy();
      render(() => (
        <Slider.Root defaultValue={[40, 60]} format={format}>
          <Slider.Value data-testid="output">{renderSpy}</Slider.Value>
        </Slider.Root>
      ));

      expect(renderSpy.lastCall.args[0]).to.deep.equal([formatValue(40), formatValue(60)]);
      expect(renderSpy.lastCall.args[1]).to.deep.equal([40, 60]);
    });
  });
});
