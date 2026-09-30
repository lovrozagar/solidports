import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { Meter } from '@solidports/base-ui/meter';
import { screen } from '@solidjs/testing-library';
import { expect } from 'chai';

describe('<Meter.Indicator />', () => {
  const { render } = createRenderer();

  describeConformance(Meter.Indicator, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Meter.Root value={30}>{node(props!)}</Meter.Root>),
  }));

  describe.skipIf(isJSDOM)('internal styles', () => {
    it('sets positioning styles', async () => {
      render(() => (
        <Meter.Root value={33} style={{ width: '100px' }}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      const indicator = screen.getByTestId('indicator');

      expect(indicator).toHaveComputedStyle({
        left: '0px',
        width: '33px',
      });
    });

    it('sets zero width when value is 0', async () => {
      render(() => (
        <Meter.Root value={0} style={{ width: '100px' }}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      const indicator = screen.getByTestId('indicator');

      expect(indicator).toHaveComputedStyle({
        insetInlineStart: '0px',
        width: '0px',
      });
    });
  });
});
