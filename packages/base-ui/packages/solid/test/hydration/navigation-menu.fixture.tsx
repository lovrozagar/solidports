import { NavigationMenu } from '@solidports/base-ui/navigation-menu';

/** A trigger with an element child next to its text, rendered on the server and hydrated. */
export function NavigationMenuFixture() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="guides">
          <NavigationMenu.Trigger>
            Guides
            <span data-testid="chevron" />
          </NavigationMenu.Trigger>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
