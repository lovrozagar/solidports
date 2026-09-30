import { createRenderer, describeConformance } from '#test-utils';
import { Input } from '@solidports/base-ui/input';

describe('<Input />', () => {
  const { render } = createRenderer();

  describeConformance(Input, () => ({
    refInstanceof: window.HTMLInputElement,
    render,
  }));
});
