import { createRenderer, describeConformance } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { screen } from '@solidjs/testing-library';
import { expect } from 'chai';

describe('<Menu.RadioGroup />', () => {
  const { render } = createRenderer();

  describeConformance(Menu.RadioGroup, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('renders a div with the `group` role', async () => {
    render(() => <Menu.RadioGroup />);
    expect(screen.getByRole('group')).toBeVisible();
  });
});
