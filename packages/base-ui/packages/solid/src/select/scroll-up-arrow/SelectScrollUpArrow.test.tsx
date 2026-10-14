import { describe } from 'vitest';
import { Select } from '@solidports/base-ui/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.ScrollUpArrow />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props: any) => <Select.ScrollUpArrow {...props} ref={props.ref} keepMounted />,
    () => ({
      refInstanceof: window.HTMLDivElement,
      render(node, props) {
        return render(() => (
          <Select.Root open>
            <Select.Positioner>{node(props!)}</Select.Positioner>
          </Select.Root>
        ));
      },
    }),
  );
});
