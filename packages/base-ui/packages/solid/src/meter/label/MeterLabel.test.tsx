import { createRenderer, describeConformance } from '#test-utils';
import { Meter } from '@solidports/base-ui/meter';

describe('<Meter.Label />', () => {
  const { render } = createRenderer();

  describeConformance(Meter.Label, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => render(() => <Meter.Root value={50}>{node(props!)}</Meter.Root>),
  }));
});
