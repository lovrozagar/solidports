import { createRenderer, describeConformance } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';

describe('<PreviewCard.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Trigger, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: (node, props) => render(() => <PreviewCard.Root open>{node(props!)}</PreviewCard.Root>),
  }));
});
