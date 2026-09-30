import { createRenderer, describeConformance } from '#test-utils';
import { Accordion } from '@solidports/base-ui/accordion';

describe('<Accordion.Header />', () => {
  const { render } = createRenderer();

  describeConformance(Accordion.Header, () => ({
    refInstanceof: window.HTMLHeadingElement,
    render: (node, props) =>
      render(() => (
        <Accordion.Root>
          <Accordion.Item>{node(props!)}</Accordion.Item>
        </Accordion.Root>
      )),
  }));
});
