import { createRenderer, describeConformance } from '#test-utils';
import { Tabs } from '@solidports/base-ui/tabs';

describe('<Tabs.Tab />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Tabs.Tab {...props} ref={props.ref} value="1" />,
    () => ({
      button: true,
      refInstanceof: window.HTMLButtonElement,
      render: (node, props) => {
        return render(() => (
          <Tabs.Root>
            <Tabs.List>{node(props!)}</Tabs.List>
          </Tabs.Root>
        ));
      },
      testComponentPropWith: 'button',
    }),
  );
});
