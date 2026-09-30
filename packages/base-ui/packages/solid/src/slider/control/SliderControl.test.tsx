import { createRenderer, describeConformance } from '#test-utils';
import { Slider } from '@solidports/base-ui/slider';

describe('<Slider.Control />', () => {
  const { render } = createRenderer();

  describeConformance(Slider.Control, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => {
      return render(() => <Slider.Root>{node(props!)}</Slider.Root>);
    },
  }));
});
