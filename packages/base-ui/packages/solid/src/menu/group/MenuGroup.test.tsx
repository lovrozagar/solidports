import { createRenderer, describeConformance } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';

describe('<Menu.Group />', () => {
  const { render } = createRenderer();

  describeConformance(Menu.Group, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('renders a div with the `group` role', async () => {
    render(() => <Menu.Group />);
    expect(screen.getByRole('group')).toBeVisible();
  });
});
