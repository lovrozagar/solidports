import { createRenderer, describeConformance } from '#test-utils';
import { Slider } from '@solidports/base-ui/slider';

describe('<Slider.Track />', () => {
  const { render } = createRenderer();

  describeConformance(Slider.Track, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => {
      return render(() => <Slider.Root>{node(props!)}</Slider.Root>);
    },
  }));
});
