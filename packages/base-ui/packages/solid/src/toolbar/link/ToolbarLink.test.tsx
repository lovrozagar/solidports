import { createRenderer, describeConformance } from '#test-utils';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { screen } from '@solidjs/testing-library';
import { expect } from 'chai';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { NOOP } from '../../utils/noop';
import { ToolbarRootContext } from '../root/ToolbarRootContext';

const testCompositeContext: CompositeRootContext = {
  highlightItemOnHover: () => false,
  highlightedIndex: () => 0,
  onHighlightedIndexChange: NOOP,
  relayKeyboardEvent: NOOP,
};

const testToolbarContext: ToolbarRootContext = {
  disabled: () => false,
  orientation: () => 'horizontal',
  setItemArray: NOOP,
};

describe('<Toolbar.Link />', () => {
  const { render } = createRenderer();

  describeConformance(Toolbar.Link, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: (node, props) => {
      return render(() => (
        <ToolbarRootContext value={testToolbarContext}>
          <CompositeRootContext value={testCompositeContext}>
            {node(props!)}
          </CompositeRootContext>
        </ToolbarRootContext>
      ));
    },
    testRenderPropWith: 'a',
  }));

  describe('ARIA attributes', () => {
    it('renders an anchor', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Link data-testid="link" href="https://base-ui.com" />
        </Toolbar.Root>
      ));

      expect(screen.getByTestId('link')).to.equal(screen.getByRole('link'));
    });
  });
});
