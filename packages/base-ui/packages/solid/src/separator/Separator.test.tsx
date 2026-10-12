import { createRenderer, describeConformance } from '#test-utils';
import { Separator } from '@solidports/base-ui/separator';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';

describe('<Separator />', () => {
  const { render } = createRenderer();

  describeConformance(Separator, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('renders a div with the `separator` role', async () => {
    render(() => <Separator />);
    expect(screen.getByRole('separator')).toBeVisible();
  });

  describe('prop: orientation', () => {
    it.each([{ orientation: 'horizontal' }, { orientation: 'vertical' }] as const)(
      'sets aria-orientation="$orientation"',
      async ({ orientation }) => {
        await render(() => <Separator orientation={orientation} />);

        expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', orientation);
      },
    );
  });
});
