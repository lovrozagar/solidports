import { createRenderer, describeConformance } from '#test-utils';
import { Accordion } from '@solidports/base-ui/accordion';

describe('<Accordion.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(Accordion.Trigger, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render: (node, props) =>
      render(() => (
        <Accordion.Root>
          <Accordion.Item>{node(props!)}</Accordion.Item>
        </Accordion.Root>
      )),
    testComponentPropWith: 'button',
  }));
});
