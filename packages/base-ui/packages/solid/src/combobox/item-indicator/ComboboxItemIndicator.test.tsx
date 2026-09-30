import { createRenderer, describeConformance } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';

describe('<Combobox.ItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Combobox.ItemIndicator keepMounted {...props} ref={props.ref} />,
    () => ({
      refInstanceof: window.HTMLSpanElement,
      render(node, props) {
        return render(() => (
          <Combobox.Root>
            <Combobox.Item>{node(props!)}</Combobox.Item>
          </Combobox.Root>
        ));
      },
    }),
  );
});
