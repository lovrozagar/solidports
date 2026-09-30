import { createRenderer, describeConformance } from '#test-utils';
import { Accordion } from '@solidports/base-ui/accordion';

describe('<Accordion.Item />', () => {
  const { render } = createRenderer();

  describeConformance(Accordion.Item, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Accordion.Root>{node(props!)}</Accordion.Root>),
  }));
});
