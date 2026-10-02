import { createRenderer, describeConformance } from '#test-utils';
import { PreviewCard } from '@solidports/base-ui/preview-card';
import { screen } from '@solidjs/testing-library';
import { expect, vi } from 'vitest';

describe('<PreviewCard.Popup />', () => {
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

  it('throws a descriptive error when rendered outside <PreviewCard.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <PreviewCard.Popup />)).to.throw(
        'Base UI: PreviewCardRootContext is missing. PreviewCard parts must be placed within <PreviewCard.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('throws a descriptive error when rendered outside <PreviewCard.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <PreviewCard.Root open>
            <PreviewCard.Portal>
              <PreviewCard.Popup />
            </PreviewCard.Portal>
          </PreviewCard.Root>
        )),
      ).to.throw(
        'Base UI: PreviewCardPositionerContext is missing. PreviewCardPositioner parts must be placed within <PreviewCard.Positioner>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

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
