import { createRenderer, describeConformance } from '#test-utils';
import { Progress } from '@solidports/base-ui/progress';

describe('<Progress.Track />', () => {
  const { render } = createRenderer();

  describeConformance(Progress.Track, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <Progress.Root value={40}>{node(props!)}</Progress.Root>),
  }));
});
