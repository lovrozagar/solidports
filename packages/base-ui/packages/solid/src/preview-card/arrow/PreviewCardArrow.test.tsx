import { createRenderer, describeConformance } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';

describe('<PreviewCard.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Arrow, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => (
        <PreviewCard.Root open>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>{node(props!)}</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      )),
  }));
});
