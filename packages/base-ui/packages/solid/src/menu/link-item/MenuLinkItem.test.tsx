import { act, createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { createRouter, memoryHistory, useLocation } from '@solidjs/router';
import { screen, waitFor } from '@solidjs/testing-library';
import { expect } from 'vitest';

describe('<Menu.LinkItem />', () => {
  const { render } = createRenderer();

  describeConformance(Menu.LinkItem, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render: (node, props) => {
      return render(() => <Menu.Root open>{node(props!)}</Menu.Root>);
    },
  }));

  describe('rendering links', () => {
    function One() {
      return <div>page one</div>;
    }
    function Two() {
      return <div>page two</div>;
    }
    function LocationDisplay() {
      const location = useLocation();
      return <div data-testid="location">{location.pathname}</div>;
    }

    // Solid: @solidjs/router intercepts plain anchors, so `href` stands in for React Router's <Link>.
    it.skipIf(isJSDOM)('react-router <Link> activates with Enter and Space', async () => {
      const TestRouter = createRouter({
        history: memoryHistory('/'),
        routes: [
          {
            component: (props) => (
              <>
                {props.children}
                <LocationDisplay />

                <Menu.Root open>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.LinkItem href="/">link 1</Menu.LinkItem>
                        <Menu.LinkItem href="/two">link 2</Menu.LinkItem>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </>
            ),
            children: [
              { path: '/', component: One },
              { path: '/two', component: Two },
            ],
          },
        ],
      });

      const { user } = render(() => <TestRouter />);

      const link1 = () => screen.getAllByRole('menuitem')[0];
      const link2 = () => screen.getAllByRole('menuitem')[1];

      const locationDisplay = screen.getByTestId('location');

      expect(screen.getByText(/page one/i)).not.to.equal(null);

      expect(locationDisplay).to.have.text('/');

      await act(() => {
        link2().focus();
      });

      await waitFor(() => {
        expect(link2()).toHaveFocus();
      });

      await user.keyboard('[Enter]');

      expect(locationDisplay).to.have.text('/two');

      expect(screen.getByText(/page two/i)).not.to.equal(null);

      await act(() => {
        link1().focus();
      });

      await waitFor(() => {
        expect(link1()).toHaveFocus();
      });

      await user.keyboard('[Enter]');

      expect(screen.getByText(/page one/i)).not.to.equal(null);

      expect(locationDisplay).to.have.text('/');

      await act(() => {
        link2().focus();
      });

      await waitFor(() => {
        expect(link2()).toHaveFocus();
      });

      await user.keyboard('[Space]');

      expect(locationDisplay).to.have.text('/two');

      expect(screen.getByText(/page two/i)).not.to.equal(null);

      await act(() => {
        link1().focus();
      });

      await waitFor(() => {
        expect(link1()).toHaveFocus();
      });

      await user.keyboard('[Space]');

      expect(screen.getByText(/page one/i)).not.to.equal(null);

      expect(locationDisplay).to.have.text('/');
    });

    it.skipIf(isJSDOM)(
      'does not navigate when Space is pressed during an active typeahead session',
      async () => {
        const TestRouter = createRouter({
          history: memoryHistory('/'),
          routes: [
            {
              component: (props) => (
                <>
                  {props.children}
                  <LocationDisplay />

                  <Menu.Root open>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.LinkItem href="/">Item One</Menu.LinkItem>
                          <Menu.LinkItem href="/two">Item Two</Menu.LinkItem>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                </>
              ),
              children: [
                { path: '/', component: One },
                { path: '/two', component: Two },
              ],
            },
          ],
        });

        const { user } = render(() => <TestRouter />);

        const [link1, link2] = screen.getAllByRole('menuitem');
        const locationDisplay = screen.getByTestId('location');

        await act(() => {
          link1.focus();
        });

        await waitFor(() => {
          expect(link1).toHaveFocus();
        });

        await user.keyboard('Item T');

        await waitFor(() => {
          expect(link2).toHaveFocus();
        });

        expect(locationDisplay).to.have.text('/');

        await user.keyboard('[Space]');
        expect(locationDisplay).to.have.text('/');
      },
    );
  });
});
