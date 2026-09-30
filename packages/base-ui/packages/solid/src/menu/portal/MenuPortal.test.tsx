import { createRenderer, describeConformance } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';

describe('<Menu.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Menu.Portal {...props} keepMounted ref={props.ref} />,
    () => ({
      refInstanceof: window.HTMLDivElement,
      render(node, props) {
        return render(() => <Menu.Root>{node(props!)}</Menu.Root>);
      },
    }),
  );
});
