import { createSignal } from 'solid-js';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { defineSsrFixtures } from '../../test/defineSsrFixtures';

/*
 * NavigationMenu's native Item, Icon and Link on the server path, with literal and reactive inputs
 * written out (a spread makes the props a proxy, which takes the slow path). A kept-mounted content
 * with no portal renders inline, so its links render on the server too.
 * `navigationMenu.hydration.test.tsx` toggles a link's `active` twice after hydration and checks
 * every part against the same tree rendered on the client.
 */

export const [active, setActive] = createSignal(false);

export default defineSsrFixtures(import.meta.url, {
  menu: () => (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item data-testid="item-a" value="a">
          <NavigationMenu.Trigger>
            Products
            <NavigationMenu.Icon data-testid="icon-a" />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <NavigationMenu.Link data-testid="link-reactive" href="#one" active={active()}>
              One
            </NavigationMenu.Link>
            <NavigationMenu.Link data-testid="link-literal" href="#two" active closeOnClick>
              Two
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item data-testid="item-b">
          <NavigationMenu.Link data-testid="link-plain" href="#three">
            Three
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  ),
});
