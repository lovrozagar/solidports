import { createRenderer, describeConformance } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { screen, waitFor } from '@solidjs/testing-library';

describe('<PreviewCard.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Backdrop, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) => render(() => <PreviewCard.Root open>{node(props!)}</PreviewCard.Root>),
  }));

  it('sets `pointer-events: none` style', async () => {
    const { user } = render(() => (
      <PreviewCard.Root>
        <PreviewCard.Trigger delay={0} closeDelay={0}>
          Open
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Backdrop data-testid="backdrop" />
          <PreviewCard.Positioner>
            <PreviewCard.Popup />
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ));

    await user.hover(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).to.equal('none');
    });
  });
});
