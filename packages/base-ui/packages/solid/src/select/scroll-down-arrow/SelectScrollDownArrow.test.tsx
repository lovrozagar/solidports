import { expect, vi, describe, it } from 'vitest';
import { Select } from '@solidports/base-ui/select';
import { fireEvent, screen } from '@solidjs/testing-library';
import { act, createRenderer, describeConformance } from '#test-utils';

describe('<Select.ScrollDownArrow />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props: any) => <Select.ScrollDownArrow {...props} ref={props.ref} keepMounted />,
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
