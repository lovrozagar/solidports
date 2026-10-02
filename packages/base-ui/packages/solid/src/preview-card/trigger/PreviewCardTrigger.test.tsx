import { createRenderer, describeConformance } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { expect, vi } from 'vitest';

describe('<PreviewCard.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(PreviewCard.Trigger, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: (node, props) => render(() => <PreviewCard.Root open>{node(props!)}</PreviewCard.Root>),
  }));

  it('throws without PreviewCard.Root or a handle', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <PreviewCard.Trigger />)).toThrow(
        'Base UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
