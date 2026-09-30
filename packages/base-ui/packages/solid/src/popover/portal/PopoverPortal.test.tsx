import { createRenderer, describeConformance } from '#test-utils';
import { Popover } from '@solidports/base-ui/popover';

describe('<Popover.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(Popover.Portal, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => <Popover.Root open>{node(props!)}</Popover.Root>);
    },
  }));
});
