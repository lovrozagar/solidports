import { createRenderer, describeConformance } from '#test-utils';
import { Progress } from '@solidports/base-ui/progress';

describe('<Progress.Label />', () => {
  const { render } = createRenderer();

  describeConformance(Progress.Label, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => render(() => <Progress.Root value={40}>{node(props!)}</Progress.Root>),
  }));
});
