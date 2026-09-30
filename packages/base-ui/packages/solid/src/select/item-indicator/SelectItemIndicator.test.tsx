import { createRenderer, describeConformance } from '#test-utils';
import { Select } from '@solidports/base-ui/select';

describe('<Select.ItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(Select.ItemIndicator, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node, props) {
      return render(() => (
        <Select.Root open>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Positioner>
            <Select.Item>{node(props!)}</Select.Item>
          </Select.Positioner>
        </Select.Root>
      ));
    },
  }));
});
