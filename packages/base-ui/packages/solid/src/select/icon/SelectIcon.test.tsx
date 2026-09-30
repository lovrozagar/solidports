import { createRenderer, describeConformance } from '#test-utils';
import { Select } from '@solidports/base-ui/select';

describe('<Select.Icon />', () => {
  const { render } = createRenderer();

  describeConformance(Select.Icon, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node, props) {
      return render(() => <Select.Root open>{node(props!)}</Select.Root>);
    },
  }));
});
