import { Menu } from '@solidports/base-ui/menu';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  emptyState: () => (
    <Menu.FilterProvider>
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" />
              <Menu.Empty data-testid="empty">No actions found</Menu.Empty>
              <Menu.List />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  ),
  relationships: () => (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal keepMounted>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" />
              <Menu.List>
                <Menu.Item>Rename</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  ),
  submenu: () => (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal keepMounted>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" />
              <Menu.List>
                <Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>More actions</Menu.SubmenuTrigger>
                    <Menu.Portal keepMounted>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Input aria-label="Filter more actions" />
                          <Menu.List>
                            <Menu.Item>Share</Menu.Item>
                          </Menu.List>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.FilterProvider>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  ),
});
