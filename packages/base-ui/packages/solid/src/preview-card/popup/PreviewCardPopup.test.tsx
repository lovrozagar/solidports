import { createRenderer, describeConformance } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { screen } from '@solidjs/testing-library';
import { expect } from 'chai';

describe('<Popover.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Popup, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>{node(props!)}</PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      )),
  }));

  it('should render the children', async () => {
    render(() => (
      <PreviewCard.Root open>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));

    expect(screen.getByText('Content')).not.to.equal(null);
  });
});
