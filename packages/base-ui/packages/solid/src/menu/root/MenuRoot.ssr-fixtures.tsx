import { children, omit } from 'solid-js';
import { Button } from '@solidports/base-ui/button';
import { Menu } from '@solidports/base-ui/menu';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

function ClosedMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger
        data-testid="trigger"
        render={(props) => (
          <button type="button" {...props}>
            Account
          </button>
        )}
      />
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Item>Profile</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// A design system's parts: each wraps a Base UI part and spreads its props through.
function AppMenu(props: Menu.Root.Props) {
  return <Menu.Root {...props} />;
}

function AppMenuTrigger(props: Menu.Trigger.Props) {
  return <Menu.Trigger data-slot="menu-trigger" {...props} />;
}

// Resolves its children, as a button that styles icon-only content differently does, and passes
// `render` and `nativeButton` through explicitly.
function AppButton(props: Button.Props & { variant?: string | undefined }) {
  const content = children(() => props.children);
  const rest = omit(props, 'children', 'class', 'variant');
  const iconOnly = () => content.toArray().length === 0;
  return (
    <Button
      data-slot="button"
      {...rest}
      render={props.render}
      nativeButton={props.nativeButton}
      data-variant={props.variant}
      class={iconOnly() ? 'icon-button' : 'button'}
    >
      <span data-slot="button-content">{content()}</span>
    </Button>
  );
}

function AppMenuContent(props: Menu.Popup.Props) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={4}>
        <Menu.Popup data-slot="menu-content" {...props} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function WrappedMenu() {
  return (
    <AppMenu>
      <AppMenuTrigger render={(props) => <AppButton variant="outline" {...props}>
            Account
          </AppButton>} />
      <AppMenuContent>
        <Menu.Item>Profile</Menu.Item>
      </AppMenuContent>
    </AppMenu>
  );
}

export default defineSsrFixtures(import.meta.url, {
  filterableIndicators: () => (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Columns</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter" />
              <Menu.List>
                <Menu.CheckboxItem defaultChecked>
                  <Menu.CheckboxItemIndicator>✓</Menu.CheckboxItemIndicator>
                  Status
                </Menu.CheckboxItem>
                <Menu.RadioGroup defaultValue="name">
                  <Menu.RadioItem value="name">
                    <Menu.RadioItemIndicator>•</Menu.RadioItemIndicator>
                    Name
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  ),
  wrapped: () => <WrappedMenu />,
  wrappedFilterProvider: () => (
    <Menu.FilterProvider>
      <WrappedMenu />
    </Menu.FilterProvider>
  ),
  renderTrigger: () => <ClosedMenu />,
  filterProvider: () => (
    <Menu.FilterProvider>
      <ClosedMenu />
    </Menu.FilterProvider>
  ),
  plainTrigger: () => (
    <Menu.Root>
      <Menu.Trigger data-testid="trigger">Account</Menu.Trigger>
    </Menu.Root>
  ),
  submenuTrigger: () => (
    <Menu.Root defaultOpen>
      <Menu.Trigger data-testid="trigger">Account</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Item>Profile</Menu.Item>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Settings</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  ),
});
