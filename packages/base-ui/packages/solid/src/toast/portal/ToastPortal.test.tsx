import { createRenderer, describeConformance } from '#test-utils';
import { Toast } from '@solidports/base-ui/toast';

describe('<Toast.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(Toast.Portal, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));
});
