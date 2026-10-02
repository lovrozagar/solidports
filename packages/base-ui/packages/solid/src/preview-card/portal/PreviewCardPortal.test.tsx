import { describe } from 'vitest';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { createRenderer, describeConformance } from '#test-utils';

describe('<PreviewCard.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Portal, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <PreviewCard.Root open>
          {node({ keepMounted: true, ...props } as NonNullable<typeof props>)}
        </PreviewCard.Root>
      ));
    },
  }));
});
