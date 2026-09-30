import { createRenderer, describeConformance } from '#test-utils';
import { Avatar } from '@solidports/base-ui/avatar';

describe('<Avatar.Root />', () => {
  const { render } = createRenderer();

  describeConformance(Avatar.Root, () => ({
    refInstanceof: window.HTMLSpanElement,
    render,
  }));
});
