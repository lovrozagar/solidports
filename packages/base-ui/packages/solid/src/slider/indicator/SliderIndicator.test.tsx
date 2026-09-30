import { createRenderer, describeConformance } from '#test-utils';
import { Slider } from '@solidports/base-ui/slider';

describe('<Slider.Indicator />', () => {
  const { render } = createRenderer();

  describeConformance(Slider.Indicator, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => {
      return render(() => <Slider.Root>{node(props!)}</Slider.Root>);
    },
  }));
});
