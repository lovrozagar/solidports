import { describe } from 'vitest';
import { Select } from '@solidports/base-ui/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.Label />', () => {
  const { render } = createRenderer();

  describeConformance(Select.Label, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Select.Root>
          {node(props!)}
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>
      ));
    },
  }));
});
