import { createRenderer, describeConformance } from '#test-utils';
import { Toolbar } from '@solidports/base-ui/toolbar';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
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
};

describe('<Toolbar.Group />', () => {
  const { render } = createRenderer();

  describeConformance(Toolbar.Group, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => {
      return render(() => (
        <ToolbarRootContext value={testToolbarContext}>
          <CompositeRootContext value={testCompositeContext}>{node(props!)}</CompositeRootContext>
        </ToolbarRootContext>
      ));
    },
  }));

  describe('ARIA attributes', () => {
    it('renders a group', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group data-testid="group" />
        </Toolbar.Root>
      ));

      expect(screen.getByTestId('group')).to.equal(screen.getByRole('group'));
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links in the group', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group disabled>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input defaultValue="" />
          </Toolbar.Group>
        </Toolbar.Root>
      ));

      [screen.getByRole('button'), screen.getByRole('textbox')].forEach((toolbarItem) => {
        expect(toolbarItem).to.have.attribute('aria-disabled', 'true');
        expect(toolbarItem).to.have.attribute('data-disabled');
      });

      expect(screen.getByText('Link')).to.not.have.attribute('data-disabled');
      expect(screen.getByText('Link')).to.not.have.attribute('aria-disabled');
    });
  });
});
