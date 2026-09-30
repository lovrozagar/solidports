import { createRenderer, describeConformance } from '#test-utils';
import { Collapsible } from '@solidports/base-ui/collapsible';

describe('<Collapsible.Trigger />', () => {
  const { render } = createRenderer();
  describeConformance(Collapsible.Trigger, () => ({
    button: true,
    refInstanceof: window.HTMLButtonElement,
    render: (node, props) => render(() => <Collapsible.Root>{node(props!)}</Collapsible.Root>),
    testComponentPropWith: 'button',
  }));
});
