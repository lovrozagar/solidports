import { createRenderer, describeConformance } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';

describe('<Combobox.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(Combobox.Arrow, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Portal>
            <Combobox.Positioner>{node(props!)}</Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
    },
  }));
});
