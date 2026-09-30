import { createRenderer, describeConformance } from '#test-utils';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';

describe('<NavigationMenu.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(NavigationMenu.Viewport, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => <NavigationMenu.Root>{node(props!)}</NavigationMenu.Root>),
  }));
});
