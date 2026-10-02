import { createRenderer, describeConformance } from '#test-utils';
import { Drawer } from '@solidports/base-ui/drawer';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';

describe('<Drawer.Content />', () => {
  const { render } = createRenderer();

  describeConformance(Drawer.Content, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>{node(props!)}</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
    },
  }));

  it('does not add public swipe-ignore attributes', async () => {
    render(() => (
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content data-testid="content">Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));

    expect(screen.getByTestId('content')).not.toHaveAttribute('data-swipe-ignore');
    expect(screen.getByTestId('content')).not.toHaveAttribute('data-base-ui-swipe-ignore');
  });
});
