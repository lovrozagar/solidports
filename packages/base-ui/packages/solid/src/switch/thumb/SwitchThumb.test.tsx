import { createRenderer, describeConformance } from '#test-utils';
import { Switch } from '@solidports/base-ui/switch';
import { SwitchRootContext } from '../root/SwitchRootContext';

const testContext: SwitchRootContext = {
  checked: () => false,
  dirty: () => false,
  disabled: () => false,
  filled: () => false,
  focused: () => false,
  readOnly: () => false,
  required: () => false,
  touched: () => false,
  valid: () => null,
};

describe('<Switch.Thumb />', () => {
  const { render } = createRenderer();

  describeConformance(Switch.Thumb, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node, props) => {
      return render(() => (
        <SwitchRootContext.Provider value={testContext}>{node(props!)}</SwitchRootContext.Provider>
      ));
    },
  }));
});
