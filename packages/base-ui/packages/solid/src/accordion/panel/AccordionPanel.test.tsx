import { createRenderer, describeConformance } from '#test-utils';
import { Accordion } from '@solidports/base-ui/accordion';

describe('<Accordion.Panel />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Accordion.Panel keepMounted {...props} ref={props.ref} />,
    () => ({
      refInstanceof: window.HTMLDivElement,
      render: (node, props) =>
        render(() => (
          <Accordion.Root>
            <Accordion.Item>{node(props!)}</Accordion.Item>
          </Accordion.Root>
        )),
    }),
  );
});
