import { createRenderer, describeConformance } from '#test-utils';
import { Meter } from '@solidports/base-ui/meter';

describe('<Meter.Track />', () => {
  const { render } = createRenderer();

  describeConformance(Meter.Track, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Meter.Root value={30}>{node(props!)}</Meter.Root>),
  }));
});
